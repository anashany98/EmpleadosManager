import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

const KIOSK_SECRET_HEADER = 'x-kiosk-secret';

function safeSecretEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function getConfiguredKioskSecret(): string | null {
    return process.env.KIOSK_DEVICE_SECRET || process.env.KIOSK_SECRET || null;
}

export function requireKioskSecretIfConfigured(req: Request, res: Response, next: NextFunction) {
    const configuredSecret = getConfiguredKioskSecret();
    if (!configuredSecret) {
        if (process.env.NODE_ENV === 'production') {
            return res.status(503).json({
                status: 'error',
                message: 'Kiosk secret is required in production'
            });
        }

        return next();
    }

    const providedSecret = req.header(KIOSK_SECRET_HEADER) || req.body?.secret;
    if (typeof providedSecret !== 'string' || !safeSecretEquals(providedSecret, configuredSecret)) {
        return res.status(401).json({
            status: 'error',
            message: 'Kiosk unauthorized'
        });
    }

    return next();
}

export const kioskIdentifyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many kiosk identify requests'
});

export const kioskClockLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many kiosk clock requests'
});
