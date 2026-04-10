import request from 'supertest';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import calendarRoutes from '../routes/calendarRoutes';
import { prisma } from '../lib/prisma';

vi.mock('../middlewares/authMiddleware', () => ({
    protect: (req: { user?: unknown }, _res: unknown, next: () => void) => {
        req.user = { id: 'user-123', email: 'test@example.com', role: 'employee' };
        next();
    },
    checkPermission: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

vi.mock('../lib/prisma', () => ({
    prisma: {
        employee: {
            findFirst: vi.fn(),
            findUnique: vi.fn()
        },
        vacation: {
            findMany: vi.fn()
        },
        vehicle: {
            findMany: vi.fn()
        },
        user: {
            findFirst: vi.fn()
        }
    }
}));

const app = express();
app.use(express.json());
app.use('/api/calendar', calendarRoutes);

describe('CalendarController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return subscription link', async () => {
        vi.mocked(prisma.employee.findFirst).mockResolvedValue({ id: 'emp-123' } as never);

        const res = await request(app).get('/api/calendar/link');

        expect(res.status).toBe(200);
        expect(res.body.data.url).toContain('/api/calendar/feed');
        expect(res.body.data.url).toContain('u=emp-123');
    });

    it('should return 403 for invalid signature on feed', async () => {
        const res = await request(app).get('/api/calendar/feed?u=emp-123&s=invalid_sig');
        expect(res.status).toBe(403);
    });
});
