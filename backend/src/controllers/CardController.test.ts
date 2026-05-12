import request from 'supertest';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import cardRoutes from '../routes/cardRoutes';
import { prisma } from '../lib/prisma';

vi.mock('../middlewares/authMiddleware', () => ({
    protect: (req: { user?: unknown }, _res: unknown, next: () => void) => {
        req.user = { id: 'user-123', role: 'admin', permissions: {} };
        next();
    },
    checkPermission: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

vi.mock('../lib/prisma', () => ({
    prisma: {
        card: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        },
        employee: {
            findUnique: vi.fn()
        }
    }
}));

const app = express();
app.use(express.json());
app.use('/api/cards', cardRoutes);

describe('CardController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should list all cards', async () => {
        vi.mocked(prisma.card.findMany).mockResolvedValue([
            { id: '1', alias: 'Visa Juan', panLast4: '1234' }
        ] as never);

        const res = await request(app).get('/api/cards');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });

    it('should create a card', async () => {
        const newCard = { alias: 'Visa Repsol', panLast4: '4321', provider: 'Repsol' };
        vi.mocked(prisma.card.create).mockResolvedValue({ id: '2', ...newCard } as never);

        const res = await request(app).post('/api/cards').send(newCard);

        expect(res.status).toBe(200);
        expect(res.body.data.alias).toBe('Visa Repsol');
    });

    it('should delete a card', async () => {
        vi.mocked(prisma.card.findUnique).mockResolvedValue({ id: '1' } as never);
        vi.mocked(prisma.card.delete).mockResolvedValue({ id: '1' } as never);

        const res = await request(app).delete('/api/cards/1');
        expect(res.status).toBe(200);
    });

    it('should sanitize readonly and relation fields when updating a card assignment', async () => {
        vi.mocked(prisma.card.findUnique).mockResolvedValue({
            id: '1',
            companyId: null,
            employee: null
        } as never);
        vi.mocked(prisma.employee.findUnique).mockResolvedValue({
            companyId: 'company-1'
        } as never);
        vi.mocked(prisma.card.update).mockResolvedValue({
            id: '1',
            alias: 'Visa Juan',
            panLast4: '1234',
            provider: 'VISA',
            type: 'CREDIT',
            employeeId: 'emp-1',
            companyId: 'company-1'
        } as never);

        const res = await request(app).put('/api/cards/1').send({
            id: '1',
            alias: 'Visa Juan',
            panLast4: '1234',
            provider: 'VISA',
            type: 'CREDIT',
            limit: 0,
            currency: 'EUR',
            expiryDate: null,
            employeeId: 'emp-1',
            companyId: null,
            status: 'ACTIVE',
            pin: null,
            createdAt: '2026-04-23T13:22:16.108Z',
            updatedAt: '2026-04-23T13:22:16.108Z',
            employee: null,
            company: null
        });

        expect(res.status).toBe(200);
        expect(prisma.card.update).toHaveBeenCalledWith({
            where: { id: '1' },
            data: {
                alias: 'Visa Juan',
                panLast4: '1234',
                provider: 'VISA',
                type: 'CREDIT',
                limit: 0,
                currency: 'EUR',
                expiryDate: null,
                employeeId: 'emp-1',
                companyId: 'company-1',
                status: 'ACTIVE',
                pin: null
            }
        });
    });
});
