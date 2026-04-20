import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from './AuthController';
import { prisma } from '../lib/prisma';

vi.mock('../lib/prisma', () => ({
    prisma: {
        refreshToken: {
            findUnique: vi.fn(),
            update: vi.fn(),
            create: vi.fn()
        }
    }
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
    AuditService: {
        logLoginSuccess: vi.fn(),
        logLoginFailed: vi.fn(),
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

        const decoded = jwt.verify(res.body.data.token, process.env.JWT_SECRET || 'test-jwt-secret') as {
            id: string;
            sessionVersion: number;
        };

        expect(decoded.id).toBe('user-1');
        expect(decoded.sessionVersion).toBe(9);
    });
});
