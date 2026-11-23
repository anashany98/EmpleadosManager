import express from 'express';
import type { RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import obraRoutes from '../routes/obraRoutes';

vi.mock('../middlewares/authMiddleware', () => {
    const allow: RequestHandler = (_req, _res, next) => next();
    return {
        protect: (req: { user?: unknown }, _res: unknown, next: () => void) => {
            req.user = { id: 'admin-1', role: 'admin' };
            next();
        },
        requireGlobalAdmin: allow,
        checkPermission: () => allow
    };
});

vi.mock('../lib/prisma', () => ({ prisma: { project: { findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock('../services/AuditService', () => ({ AuditService: { logWithContext: vi.fn() } }));
vi.mock('../services/NotificationService', () => ({ NotificationService: { create: vi.fn() } }));
vi.mock('../services/CacheService', () => ({ CacheService: { invalidateByPrefix: vi.fn() } }));

const app = express();
app.use(express.json());
app.use('/api/obras', obraRoutes);

describe('PATCH /api/obras/:id', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(prisma.project.findUnique).mockResolvedValue({ id: 'obra-1', code: 'OLD' } as never);
    });

    it('updates the code by ID and preserves fields omitted from the request', async () => {
        vi.mocked(prisma.project.update).mockResolvedValue({ id: 'obra-1', code: 'NEW' } as never);

        const response = await request(app).patch('/api/obras/obra-1').send({ code: ' NEW ' });

        expect(response.status).toBe(200);
        expect(response.body.data.code).toBe('NEW');
        expect(prisma.project.update).toHaveBeenCalledWith({ where: { id: 'obra-1' }, data: { code: 'NEW' } });
    });

    it('returns a conflict when the new code is already in use', async () => {
        vi.mocked(prisma.project.update).mockRejectedValue({ code: 'P2002' });

        const response = await request(app).patch('/api/obras/obra-1').send({ code: 'DUPLICATE' });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe('Ya existe una obra con ese código');
    });

    it('rejects a blank code before updating the project', async () => {
        const response = await request(app).patch('/api/obras/obra-1').send({ code: '   ' });

        expect(response.status).toBe(400);
        expect(prisma.project.update).not.toHaveBeenCalled();
    });
});
