import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { EmailService } from '../services/EmailService';
import crypto from 'crypto';
import { issueCsrfToken } from '../middlewares/csrfMiddleware';
import { validatePassword } from '../utils/passwordPolicy';
import { AuthService } from '../services/AuthService';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';

const log = createLogger('AuthController');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET must be defined.');
}
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // Short lived
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

const generateRefreshToken = () => {
    return crypto.randomBytes(40).toString('hex');
};

const hashToken = (token: string) =>
    crypto.createHash('sha256').update(token).digest('hex');

const generateTempPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%*_-';
    const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
    const body = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    return `${pick(upper)}${pick(lower)}${pick(numbers)}${pick(symbols)}${body}`;
};

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
const ensureCsrfCookie = (req: Request, res: Response) => {
    const existing = (req as any).cookies?.[CSRF_COOKIE_NAME];
    if (!existing) issueCsrfToken(res);
};

export const AuthController = {
    login: async (req: Request, res: Response) => {
        try {
            const { email, dni, password, identifier } = req.body;
            const loginId = identifier || email || dni;

            if (!loginId || !password) {
                throw new AppError('Por favor, proporciona identificador y contraseña', 400);
            }

            const result = await AuthService.login(loginId, password);

            // Set HttpOnly cookies
            res.cookie('access_token', result.accessToken, buildCookieOptions(15 * 60 * 1000));
            res.cookie('refresh_token', result.refreshToken, buildCookieOptions(REFRESH_TOKEN_EXPIRES_IN));
            issueCsrfToken(res);

            const payload: any = { user: result.user };
            if (process.env.RETURN_TOKENS === 'true') {
                payload.token = result.accessToken;
                payload.refreshToken = result.refreshToken;
            }
            return ApiResponse.success(res, payload, 'Sesión iniciada correctamente');
        } catch (error: any) {
            log.error({ error }, 'Login failed');
            return ApiResponse.error(res, error.message || 'Error al iniciar sesión', error.statusCode || 500);
        }
    },

    // Generar/Habilitar Acceso para Empleado
    generateAccess: async (req: Request, res: Response) => {
        try {
            const { user: requester } = req as AuthenticatedRequest;
            if (!requester || requester.role !== 'admin') {
                throw new AppError('No autorizado', 403);
            }
            const { employeeId } = req.body;

            if (!employeeId) throw new AppError('ID de empleado requerido', 400);

            const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
            if (!employee) throw new AppError('Empleado no encontrado', 404);
            if (!employee.dni) throw new AppError('El empleado no tiene DNI registrado', 400);
            // if (!employee.email) throw new AppError('El empleado no tiene email personal para enviar las credenciales', 400);


            // Generate Random Password
            const tempPassword = generateTempPassword();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Check if user exists linked to this employee or DNI
            let user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { employeeId: employee.id },
                        { dni: employee.dni }
                    ]
                }
            });

            if (user) {
                // Update existing user
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        password: hashedPassword,
                        dni: employee.dni, // Ensure synced
                        employeeId: employee.id
                    }
                });
            } else {
                // Create new user
                const empEmail = employee.email || `${employee.dni}@system.local`;
                // Check if email is taken by another user (shouldn't happen 1:1 usually but check safety)
                const existingEmail = await prisma.user.findUnique({ where: { email: empEmail } });

                if (existingEmail) {
                    // Determine if we should link or fail. 
                    // Failing is safer to avoid account hijacking or confusion.
                    // But if the email matches, maybe it IS the user?
                    if (existingEmail.dni && existingEmail.dni !== employee.dni) {
                        throw new AppError('El email del empleado ya está asociado a otro usuario con diferente DNI', 400);
                    }
                    // If email exists but no DNI, maybe we upgrade it?
                    // Let's UPDATE it to link it.
                    user = await prisma.user.update({
                        where: { id: existingEmail.id },
                        data: {
                            dni: employee.dni,
                            employeeId: employee.id,
                            password: hashedPassword
                        }
                    });
                } else {
                    user = await prisma.user.create({
                        data: {
                            email: empEmail,
                            dni: employee.dni,
                            password: hashedPassword,
                            role: 'user', // Default role
                            employeeId: employee.id,
                            permissions: JSON.stringify({ dashboard: 'read', calendar: 'read' }) // Default permissions?
                        }
                    });
                }
            }

            if (employee.email) {
                const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
                const html = `
                    <p>Hola ${employee.name},</p>
                    <p>Se ha habilitado tu acceso al portal del empleado.</p>
                    <p><strong>Usuario (DNI):</strong> ${employee.dni}</p>
                    <p><strong>Contraseña temporal:</strong> ${tempPassword}</p>
                    <p>Accede aquí: <a href="${loginUrl}">${loginUrl}</a></p>
                    <p>Por seguridad, cambia la contraseña tras iniciar sesión.</p>
                `;

                await EmailService.sendMail(
                    employee.email,
                    'Credenciales de Acceso - Portal del Empleado',
                    html
                );

                return ApiResponse.success(res, { email: employee.email, hasEmail: true }, 'Acceso generado. Credenciales enviadas por correo.');
            }

            if (process.env.NODE_ENV === 'production') {
                throw new AppError('El empleado no tiene email. No se pueden entregar credenciales de forma segura.', 400);
            }

            // Dev only: return password if no email
            if (process.env.NODE_ENV === 'development') {
                return ApiResponse.success(res, {
                    hasEmail: false,
                    password: tempPassword,
                    username: employee.dni
                }, 'Acceso generado. Copia la contraseña (SOLO DESARROLLO).');
            }

            return ApiResponse.success(res, { hasEmail: false }, 'Acceso generado. El empleado no tiene email, contacta al administrador.');

        } catch (error: any) {
            log.error({ error }, 'Error generating access');
            return ApiResponse.error(res, error.message || 'Error al generar acceso', error.statusCode || 500);
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

            // Generate new Access Token
            const newAccessToken = jwt.sign({ id: user.id }, JWT_SECRET, {
                expiresIn: ACCESS_TOKEN_EXPIRES_IN,
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

            const payload: any = { token: newAccessToken, refreshToken: newRefreshToken };
            if (process.env.RETURN_TOKENS !== 'true') {
                delete payload.token;
                delete payload.refreshToken;
            }
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
                // Revoke token if provided
                // Try catch in case it doesn't exist or is already deleted
                try {
                    // We don't delete, we revoke (soft delete principle for audit)
                    // But if we want to save space we could delete. Let's revoke.
                    // First find it to make sure it exists to avoid error on update
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
    },

    // --- SELF SERVICE PASSWORD RESET ---

    requestPasswordReset: async (req: Request, res: Response) => {
        try {
            const { identifier } = req.body;
            if (!identifier) throw new AppError('DNI o Email requerido', 400);
            const trimmedId = identifier.trim();
            // 1. Find Employee by DNI or Email (case-safe for DNI)
            const employee = await prisma.employee.findFirst({
                where: {
                    OR: [
                        { dni: trimmedId },
                        { dni: trimmedId.toUpperCase() },
                        { email: trimmedId }
                    ]
                }
            });

            if (!employee) {
                // Security: Don't reveal if user exists. Fake success.
                // But for debugging, we might log it.
                log.debug({ identifier: trimmedId }, 'Password reset requested but no employee found');
                return ApiResponse.success(res, null, 'Si los datos coinciden, recibirás un correo con las instrucciones.');
            }

            if (!employee.email) {
                throw new AppError('El empleado no tiene un correo electrónico registrado. Contacta con RRHH.', 400);
            }

            // 2. Generate Reset Token (Short lived JWT)
            // Payload contains employee ID, so we know who to activate/reset
            const resetToken = jwt.sign({
                sub: employee.id,
                dni: employee.dni,
                type: 'PASSWORD_RESET'
            }, JWT_SECRET, { expiresIn: '15m' });

            // 3. "Send" Email
            const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

            const html = `
                <p>Hola ${employee.name},</p>
                <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
                <p>Haz clic en el siguiente enlace para continuar:</p>
                <p><a href="${resetLink}">${resetLink}</a></p>
                <p>Este enlace caduca en 15 minutos.</p>
                <p>Si no solicitaste este cambio, ignora este mensaje.</p>
            `;

            await EmailService.sendMail(
                employee.email,
                'Restablecimiento de contraseña',
                html
            );

            return ApiResponse.success(res, null, 'Si los datos coinciden, recibirás un correo con las instrucciones.');

        } catch (error: any) {
            log.error({ error }, 'Error processing password reset request');
            return ApiResponse.error(res, error.message || 'Error al procesar la solicitud', 500);
        }
    },

    resetPassword: async (req: Request, res: Response) => {
        try {
            const { token, newPassword } = req.body;

            if (!token || !newPassword) {
                throw new AppError('Token y nueva contraseña requeridos', 400);
            }

            const policy = validatePassword(newPassword);
            if (!policy.ok) {
                throw new AppError(policy.message || 'Contraseña no válida', 400);
            }

            // 1. Verify Token
            let payload: any;
            try {
                payload = jwt.verify(token, JWT_SECRET);
            } catch (e) {
                throw new AppError('El enlace ha expirado o es inválido', 400);
            }

            if (payload.type !== 'PASSWORD_RESET' || !payload.sub) {
                throw new AppError('Token inválido', 400);
            }

            const employeeId = payload.sub;

            // 2. Find Employee
            const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
            if (!employee) throw new AppError('Empleado no encontrado', 404);

            // 3. Find or Create User
            let user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { employeeId: employee.id },
                        { dni: employee.dni }
                    ]
                }
            });

            const hashedPassword = await bcrypt.hash(newPassword, 10);

            if (user) {
                // Update existing user
                await prisma.user.update({
                    where: { id: user.id },
                    data: { password: hashedPassword }
                });
            } else {
                // Create new user (Activation flow)
                await prisma.user.create({
                    data: {
                        email: employee.email || `${employee.dni}@system.local`, // Fallback
                        dni: employee.dni,
                        password: hashedPassword,
                        role: 'employee', // Default role
                        employeeId: employee.id,
                        permissions: JSON.stringify({}) // Default empty permissions
                    }
                });
            }

            return ApiResponse.success(res, null, 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.');

        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al restablecer contraseña', 400); // 400 likely for token errors
        }
    },

    getMe: async (req: Request, res: Response) => {
        try {
            ensureCsrfCookie(req, res);
            // user is attached to req by protect middleware
            const { user } = req as AuthenticatedRequest;
            if (!user) {
                throw new AppError('No estás autenticado', 401);
            }

            return ApiResponse.success(res, user);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al obtener usuario', error.statusCode || 401);
        }
    }
};
