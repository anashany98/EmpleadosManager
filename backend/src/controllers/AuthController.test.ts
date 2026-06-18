import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from './AuthController';
import { prisma } from '../lib/prisma';

vi.mock('../lib/prisma', () => ({
    prisma: (() => {
        const mock: any = {
            refreshToken: {
                findUnique: vi.fn(),
                update: vi.fn(),
                updateMany: vi.fn(),
                create: vi.fn()
            }
        };
        mock.$transaction = vi.fn(async (ops: any[]) => {
            for (const op of ops) {
                await op;
            }
            return [];
        });
        return mock;
    })()
}));

vi.mock('../services/LoggerService', () => ({
    createLogger: () => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    })
}));

vi.mock('../services/AuditService', () => ({
    AuditAction: {
        SECURITY_VIOLATION: 'SECURITY_VIOLATION'
    },
    AuditService: {
        logLoginSuccess: vi.fn(),
        logLoginFailed: vi.fn(),
        logSecurityEvent: vi.fn(),
        log: vi.fn()
    }
}));

vi.mock('../services/EmailService', () => ({
    EmailService: {
        sendMail: vi.fn()
    }
}));

const app = express();
app.use(cookieParser());
app.use(express.json());
app.post('/api/auth/refresh', AuthController.refresh);

describe('AuthController.refresh', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps sessionVersion when rotating the access token', async () => {
        vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
            id: 'refresh-token-1',
            token: 'hashed-token',
            revoked: false,
            expiresAt: new Date(Date.now() + 60_000),
            user: {
                id: 'user-1',
                sessionVersion: 9,
                isActive: true
            }
        } as never);
        vi.mocked(prisma.refreshToken.update).mockResolvedValue({ id: 'refresh-token-1' } as never);
        vi.mocked(prisma.refreshToken.create).mockResolvedValue({ id: 'refresh-token-2' } as never);

        const res = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: 'plain-refresh-token' });

        expect(res.status).toBe(200);

        const decoded = jwt.verify(res.body.data.token, process.env.JWT_SECRET || 'test-jwt-secret', { algorithms: ['HS256'] }) as {
            id: string;
            sessionVersion: number;
        };

        expect(decoded.id).toBe('user-1');
        expect(decoded.sessionVersion).toBe(9);
    });

    it('revokes ALL tokens and returns 401 when a revoked token is reused (family detection)', async () => {
        vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
            id: 'stolen-token',
            token: 'hashed-stolen',
            revoked: true, // Token was already revoked
            expiresAt: new Date(Date.now() + 60_000),
            userId: 'user-1',
            user: {
                id: 'user-1',
                sessionVersion: 5,
                isActive: true
            }
        } as never);
        vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 3 } as never);

        const res = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: 'stolen-refresh-token' });

        expect(res.status).toBe(401);
        expect(res.body.message).toContain('comprometida');

        // Verify ALL tokens were revoked
        expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
            where: { userId: 'user-1', revoked: false },
            data: { revoked: true }
        });

        // Verify security event was logged
        const { AuditService } = await import('../services/AuditService');
        expect(AuditService.logSecurityEvent).toHaveBeenCalledWith(
            'SECURITY_VIOLATION',
            expect.objectContaining({
                reason: expect.stringContaining('reuse'),
                userId: 'user-1'
            })
        );
    });

    it('rejects expired tokens without triggering family detection', async () => {
        vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
            id: 'expired-token',
            token: 'hashed-expired',
            revoked: false,
            expiresAt: new Date(Date.now() - 60_000), // Expired
            userId: 'user-1',
            user: {
                id: 'user-1',
                sessionVersion: 1,
                isActive: true
            }
        } as never);

        const res = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: 'expired-token' });

        expect(res.status).toBe(401);
        // Should NOT revoke all tokens for expired tokens
        expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
});
