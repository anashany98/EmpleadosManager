import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

const KIOSK_SECRET_HEADER = 'x-kiosk-secret';

function getConfiguredKioskSecret(): string | null {
    return process.env.KIOSK_DEVICE_SECRET || process.env.KIOSK_SECRET || null;
}

export function requireKioskSecretIfConfigured(req: Request, res: Response, next: NextFunction) {
    const configuredSecret = getConfiguredKioskSecret();
    if (!configuredSecret) {
        return next();
    }

    const providedSecret = req.header(KIOSK_SECRET_HEADER) || req.body?.secret;
    if (providedSecret !== configuredSecret) {
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
