import request from 'supertest';
import express from 'express';
import cardRoutes from '../routes/cardRoutes';
import { prisma } from '../lib/prisma';

// Mock Auth Middleware
jest.mock('../middlewares/authMiddleware', () => ({
    protect: (req: any, res: any, next: any) => {
        req.user = { id: 'user-123', role: 'admin', permissions: {} };
        next();
    },
    checkPermission: (module: string, level: string) => (req: any, res: any, next: any) => next()
}));

// Mock Prisma
jest.mock('../lib/prisma', () => ({
    prisma: {
        card: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        }
    }
}));

const app = express();
app.use(express.json());
app.use('/api/cards', cardRoutes);

describe('CardController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should list all cards', async () => {
        (prisma.card.findMany as jest.Mock).mockResolvedValue([
            { id: '1', alias: 'Visa Juan', panLast4: '1234' }
        ]);

        const res = await request(app).get('/api/cards');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });

    it('should create a card', async () => {
        const newCard = { alias: 'Visa Repsol', panLast4: '4321', provider: 'Repsol' };
        (prisma.card.create as jest.Mock).mockResolvedValue({ id: '2', ...newCard });

        const res = await request(app).post('/api/cards').send(newCard);

        expect(res.status).toBe(201);
        expect(res.body.data.alias).toBe('Visa Repsol');
    });

    it('should delete a card', async () => {
        (prisma.card.delete as jest.Mock).mockResolvedValue({ id: '1' });

        const res = await request(app).delete('/api/cards/1');
        expect(res.status).toBe(200);
    });
});
