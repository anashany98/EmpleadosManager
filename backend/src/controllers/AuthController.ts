import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthService } from '../services/AuthService';
import crypto from 'crypto';
import { issueCsrfToken } from '../middlewares/csrfMiddleware';
import { createLogger } from '../services/LoggerService';
import { AuditService } from '../services/AuditService';
import { signAccessToken } from '../utils/accessTokens';
import { recordFailedLogin, resetFailedLogin } from '../middlewares/accountLockout';

const log = createLogger('AuthController');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET must be defined.');
}
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

const generateRefreshToken = () => crypto.randomBytes(40).toString('hex');

const hashToken = (token: string) =>
    crypto.createHash('sha256').update(token).digest('hex');

const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none';

const buildCookieOptions = (maxAge: number) => ({
    httpOnly: true,
    secure: COOKIE_SAMESITE === 'none' ? true : COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    domain: COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge
});

const clearCookieOptions = {
    httpOnly: true,
    secure: COOKIE_SAMESITE === 'none' ? true : COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    domain: COOKIE_DOMAIN || undefined,
    path: '/'
};

const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'csrf_token';

const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: FRONTEND_URL must be defined in production.');
}
export const AuthController = {
    login: async (req: Request, res: Response) => {
        const { email, dni, password, identifier } = req.body;
        const loginId = identifier || email || dni;

        try {
            if (!loginId || !password) {
                throw new AppError('Por favor, proporciona identificador y contraseña', 400);
            }

            const result = await AuthService.login(loginId, password);

            // Reset failed login counter on success
            await resetFailedLogin(loginId);

            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            await AuditService.logLoginSuccess(result.user.id, ipAddress, userAgent);

            res.cookie('access_token', result.accessToken, buildCookieOptions(60 * 60 * 1000)); // 1 hour
            res.cookie('refresh_token', result.refreshToken, buildCookieOptions(REFRESH_TOKEN_EXPIRES_IN));
            issueCsrfToken(res);

            const payload: any = { user: result.user };
            // In production, NEVER return tokens in response body (only via HttpOnly cookies)
            // RETURN_TOKENS flag is ignored in production for security
            if (process.env.NODE_ENV !== 'production' && process.env.RETURN_TOKENS === 'true') {
                payload.token = result.accessToken;
                payload.refreshToken = result.refreshToken;
            }
            return ApiResponse.success(res, payload, 'Sesión iniciada correctamente');
        } catch (error: any) {
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            await AuditService.logLoginFailed(loginId || 'unknown', error.message || 'Login failed', ipAddress, userAgent);
            // Record failed login attempt for account lockout
            if (loginId && error.statusCode === 401) {
                await recordFailedLogin(loginId);
            }
            log.error({ error }, 'Login failed');
            return ApiResponse.error(res, error.message || 'Error al iniciar sesión', error.statusCode || 500);
        }
    },

    refresh: async (req: Request, res: Response) => {
        try {
            const { refreshToken: refreshTokenBody } = req.body;
            const refreshToken = refreshTokenBody || (req as any).cookies?.refresh_token;

            if (!refreshToken) {
                throw new AppError('Refresh Token no proporcionado', 400);
            }

            // Find token in DB
            const hashed = hashToken(refreshToken);
            let storedToken = await prisma.refreshToken.findUnique({
                where: { token: hashed },
                include: { user: true }
            });

            // Legacy fallback: token stored in plain text
            if (!storedToken) {
                storedToken = await prisma.refreshToken.findUnique({
                    where: { token: refreshToken },
                    include: { user: true }
                });
                if (storedToken) {
                    await prisma.refreshToken.update({
                        where: { id: storedToken.id },
                        data: { token: hashed }
                    });
                }
            }

            if (!storedToken || storedToken.revoked || new Date() > new Date(storedToken.expiresAt)) {
                // Should we revoke the family if reused? For now just deny.
                throw new AppError('Refresh Token inválido o expirado', 401);
            }

            const user = storedToken.user;

            if (!user.isActive) {
                throw new AppError('Usuario deshabilitado. Contacte al administrador.', 403);
            }

            // Generate new Access Token
            const newAccessToken = signAccessToken({
                id: user.id,
                sessionVersion: user.sessionVersion || 0
            });

            // Rotate Refresh Token (Optional security best practice: create new RT, revoke old one)
            // For simplicity in this phase, we keep the RT valid until expiry, 
            // OR we can rotate it. Let's rotate it for "App Excellence".

            const newRefreshToken = generateRefreshToken();
            const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN);

            // Revoke old
            await prisma.refreshToken.update({
                where: { id: storedToken.id },
                data: { revoked: true }
            });

            // Create new
            await prisma.refreshToken.create({
                data: {
                    token: hashToken(newRefreshToken),
                    userId: user.id,
                    expiresAt: newExpiresAt
                }
            });

            res.cookie('access_token', newAccessToken, buildCookieOptions(15 * 60 * 1000));
            res.cookie('refresh_token', newRefreshToken, buildCookieOptions(REFRESH_TOKEN_EXPIRES_IN));
            issueCsrfToken(res);

            // By default, include tokens in response for client-side handling
            // In production, RETURN_TOKENS is forced to false, only cookies are used
            const includeTokens = process.env.NODE_ENV !== 'production' && process.env.RETURN_TOKENS === 'true';
            const payload: any = includeTokens
                ? { token: newAccessToken, refreshToken: newRefreshToken }
                : { message: 'Token renovado correctamente' };
            return ApiResponse.success(res, payload, 'Token renovado correctamente');

        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al renovar token', 401);
        }
    },

    logout: async (req: Request, res: Response) => {
        try {
            const { refreshToken: refreshTokenBody } = req.body;
            const refreshToken = refreshTokenBody || (req as any).cookies?.refresh_token;
            if (refreshToken) {
                try {
                    const hashed = hashToken(refreshToken);
                    let found = await prisma.refreshToken.findUnique({ where: { token: hashed } });
                    if (!found) {
                        found = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
                        if (found) {
                            await prisma.refreshToken.update({
                                where: { id: found.id },
                                data: { token: hashed }
                            });
                        }
                    }
                    if (found) {
                        await prisma.refreshToken.update({
                            where: { id: found.id },
                            data: { revoked: true }
                        });
                    }
                } catch (e) {
                    log.error({ e }, 'Error revoking token on logout');
                }
            }

            res.clearCookie('access_token', clearCookieOptions);
            res.clearCookie('refresh_token', clearCookieOptions);
            res.clearCookie(CSRF_COOKIE_NAME, { ...clearCookieOptions, httpOnly: false });
            return ApiResponse.success(res, null, 'Sesión cerrada correctamente');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al cerrar sesión', 500);
        }
    }
};
