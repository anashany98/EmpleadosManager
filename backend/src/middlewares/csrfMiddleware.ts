import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'csrf_token';
const CSRF_HEADER_NAME = (process.env.CSRF_HEADER_NAME || 'x-csrf-token').toLowerCase();

const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none';
const CSRF_MAX_AGE_MS = parseInt(process.env.CSRF_MAX_AGE_MS || '') || 7 * 24 * 60 * 60 * 1000;

const buildCsrfCookieOptions = (maxAge: number) => ({
    httpOnly: false,
    secure: COOKIE_SAMESITE === 'none' ? true : COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    domain: COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge
});

const CSRF_EXEMPT_PATHS = [
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/auth/request-password-reset',
    '/api/auth/reset-password',
    '/api/kiosk'  // Kiosk is a public terminal, uses own auth or public endpoints
];

export const issueCsrfToken = (res: Response) => {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE_NAME, token, buildCsrfCookieOptions(CSRF_MAX_AGE_MS));
    return token;
};

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

    if (CSRF_EXEMPT_PATHS.some(p => req.path.startsWith(p))) return next();

    const cookieToken = (req as any).cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({ success: false, message: 'CSRF token inválido' });
    }

    return next();
};
