import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { checkAccountLockout, recordFailedLogin, resetFailedLogin } from './accountLockout';
import { prisma } from '../lib/prisma';

vi.mock('../lib/prisma', () => ({
    prisma: {
        user: {
            findFirst: vi.fn(),
            update: vi.fn()
        }
    }
}));

vi.mock('../services/LoggerService', () => ({
    createLogger: () => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn()
    })
}));

describe('accountLockout', () => {
    const originalEnableAuthThrottling = process.env.ENABLE_AUTH_THROTTLING;

    beforeEach(() => {
        process.env.ENABLE_AUTH_THROTTLING = 'true';
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (originalEnableAuthThrottling === undefined) {
            delete process.env.ENABLE_AUTH_THROTTLING;
        } else {
            process.env.ENABLE_AUTH_THROTTLING = originalEnableAuthThrottling;
        }
    });

    it('checks lockout using identifier, not only email', async () => {
        const lockedUntil = new Date(Date.now() + 60_000);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: 'user-1',
            failedLoginAttempts: 5,
            lockedUntil
        } as any);

        const req = { body: { identifier: '12345678Z' } } as Request;
        const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        } as unknown as Response;
        const next = vi.fn() as NextFunction;

        await checkAccountLockout(req, res, next);

        expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                OR: expect.arrayContaining([
                    { dni: '12345678Z' },
                    { dni: '12345678z' }
                ])
            })
        }));
        expect(res.status).toHaveBeenCalledWith(423);
        expect(next).not.toHaveBeenCalled();
    });

    it('records failed attempts for DNI logins', async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: 'user-1',
            failedLoginAttempts: 1,
            lockedUntil: null
        } as any);

        await recordFailedLogin('12345678Z');

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: { failedLoginAttempts: 2 }
        });
    });

    it('resets failed attempts for identifier logins', async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: 'user-1',
            failedLoginAttempts: 3,
            lockedUntil: new Date()
        } as any);

        await resetFailedLogin('employee@example.com');

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: { failedLoginAttempts: 0, lockedUntil: null }
        });
    });
});
