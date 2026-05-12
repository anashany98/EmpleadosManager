import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import overtimeRoutes from './overtimeRoutes';
import { errorMiddleware } from '../middlewares/errorMiddleware';
import { prisma } from '../lib/prisma';

const {
    mockGetRates,
    mockUpdateRates,
    mockGetByEmployee,
    mockCreateOvertime,
    mockImportOvertime,
    mockDeleteOvertime
} = vi.hoisted(() => ({
    mockGetRates: vi.fn((_req, res) => res.status(200).json([{ category: 'A' }])),
    mockUpdateRates: vi.fn((_req, res) => res.status(200).json({ ok: true })),
    mockGetByEmployee: vi.fn((_req, res) => res.status(200).json([{ id: 'ot-1' }])),
    mockCreateOvertime: vi.fn((_req, res) => res.status(201).json({ id: 'ot-1' })),
    mockImportOvertime: vi.fn((_req, res) => res.status(200).json({ imported: 1 })),
    mockDeleteOvertime: vi.fn((_req, res) => res.status(200).json({ ok: true }))
}));

vi.mock('../lib/prisma', () => ({
    prisma: {
        employee: {
            findUnique: vi.fn()
        },
        overtimeEntry: {
            findUnique: vi.fn()
        }
    }
}));

vi.mock('../controllers/OvertimeController', () => ({
    RateController: {
        getAll: mockGetRates,
        update: mockUpdateRates
    },
    OvertimeController: {
        getByEmployee: mockGetByEmployee,
        create: mockCreateOvertime,
        importOvertime: mockImportOvertime,
        delete: mockDeleteOvertime
    }
}));

function createApp(user: Record<string, unknown>) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        (req as any).user = user;
        next();
    });
    app.use('/api/overtime', overtimeRoutes);
    app.use(errorMiddleware);
    return app;
}

describe('overtimeRoutes authorization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('blocks employees from creating overtime entries with read-only employee access', async () => {
        vi.mocked(prisma.employee.findUnique).mockResolvedValue({
            id: 'emp-1',
            companyId: 'company-1'
        } as never);

        const app = createApp({
            id: 'user-employee',
            role: 'employee',
            employeeId: 'emp-self',
            companyId: 'company-1',
            permissions: { employees: 'read' }
        });

        const res = await request(app)
            .post('/api/overtime')
            .send({ employeeId: 'emp-1', hours: 2, rate: 10 });

        expect(res.status).toBe(403);
        expect(mockCreateOvertime).not.toHaveBeenCalled();
    });

    it('blocks company admins from creating overtime for another company', async () => {
        vi.mocked(prisma.employee.findUnique).mockResolvedValue({
            id: 'emp-2',
            companyId: 'company-2'
        } as never);

        const app = createApp({
            id: 'user-admin',
            role: 'admin',
            companyId: 'company-1',
            permissions: { employees: 'write' }
        });

        const res = await request(app)
            .post('/api/overtime')
            .send({ employeeId: 'emp-2', hours: 2, rate: 10 });

        expect(res.status).toBe(403);
        expect(mockCreateOvertime).not.toHaveBeenCalled();
    });

    it('reserves overtime rate updates for global admins', async () => {
        const app = createApp({
            id: 'user-admin',
            role: 'admin',
            companyId: 'company-1',
            permissions: { employees: 'write' }
        });

        const res = await request(app)
            .post('/api/overtime/rates')
            .send({ category: 'A', overtimeRate: 12, holidayOvertimeRate: 15 });

        expect(res.status).toBe(403);
        expect(mockUpdateRates).not.toHaveBeenCalled();
    });

    it('allows global admins to update overtime rates', async () => {
        const app = createApp({
            id: 'user-global-admin',
            role: 'admin',
            permissions: { employees: 'write' }
        });

        const res = await request(app)
            .post('/api/overtime/rates')
            .send({ category: 'A', overtimeRate: 12, holidayOvertimeRate: 15 });

        expect(res.status).toBe(200);
        expect(mockUpdateRates).toHaveBeenCalled();
    });
});
