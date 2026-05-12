import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { createLogger } from '../services/LoggerService';
import { isAuthThrottlingEnabled } from '../utils/authThrottling';

const log = createLogger('AccountLockout');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

function getLoginIdentifier(body: any): string | null {
    const raw = body?.identifier || body?.email || body?.dni;
    if (typeof raw !== 'string') {
        return null;
    }

    const trimmed = raw.trim();
    return trimmed || null;
}

async function findUserByLoginIdentifier(identifier: string) {
    const normalized = identifier.trim();
    const lower = normalized.toLowerCase();
    const upper = normalized.toUpperCase();

    return prisma.user.findFirst({
        where: {
            OR: [
                { email: normalized },
                { email: lower },
                { dni: normalized },
                { dni: lower },
                { dni: upper }
            ]
        },
        select: { id: true, failedLoginAttempts: true, lockedUntil: true }
    });
}

/**
 * Middleware that checks if an account is temporarily locked due to too many
 * failed login attempts. Must be placed BEFORE the login handler.
 *
 * Tracks failed attempts per email in the User table's `failedLoginAttempts`
 * and `lockedUntil` fields. These fields are expected to exist on the User model.
 */
export async function checkAccountLockout(req: Request, res: Response, next: NextFunction) {
    try {
        if (!isAuthThrottlingEnabled()) {
            return next();
        }

        const identifier = getLoginIdentifier(req.body);
        if (!identifier) {
            return next();
        }

        const user = await findUserByLoginIdentifier(identifier);

        if (!user) {
            // Don't reveal that the user doesn't exist
            return next();
        }

        // Check if account is currently locked
        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
            const remainingSeconds = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 1000);
            log.warn({ identifier, remainingSeconds }, 'Account locked, login rejected');
            return res.status(423).json({
                status: 423,
                message: `Cuenta bloqueada por seguridad. Intenta de nuevo en ${remainingSeconds} segundos.`
            });
        }

        // If lockout period has expired, reset the counter (the login handler will handle the rest)
        if (user.lockedUntil && new Date(user.lockedUntil) <= new Date()) {
            await prisma.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: 0, lockedUntil: null }
            });
        }

        return next();
    } catch (error) {
        log.error({ error }, 'Error checking account lockout');
        return next();
    }
}

/**
 * Records a failed login attempt and locks the account if the threshold is exceeded.
 * Should be called from the login handler when authentication fails.
 */
export async function recordFailedLogin(identifier: string): Promise<void> {
    try {
        if (!isAuthThrottlingEnabled()) {
            return;
        }

        const user = await findUserByLoginIdentifier(identifier);

        if (!user) return;

        const newAttemptCount = (user.failedLoginAttempts || 0) + 1;

        if (newAttemptCount >= MAX_FAILED_ATTEMPTS) {
            const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
            await prisma.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: newAttemptCount, lockedUntil }
            });
            log.warn({ identifier, attempts: newAttemptCount, lockedUntil }, 'Account locked due to failed attempts');
        } else {
            await prisma.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: newAttemptCount }
            });
        }
    } catch (error) {
        log.error({ error, identifier }, 'Error recording failed login');
    }
}

/**
 * Resets the failed login counter after a successful login.
 * Should be called from the login handler when authentication succeeds.
 */
export async function resetFailedLogin(identifier: string): Promise<void> {
    try {
        if (!isAuthThrottlingEnabled()) {
            return;
        }

        const user = await findUserByLoginIdentifier(identifier);
        if (!user || !user.failedLoginAttempts) {
            return;
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null }
        });
    } catch (error) {
        log.error({ error, identifier }, 'Error resetting failed login counter');
    }
}
