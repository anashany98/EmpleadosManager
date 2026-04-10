import request from 'supertest';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import vehicleRoutes from '../routes/vehicleRoutes';
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
        vehicle: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        }
    }
}));

const app = express();
app.use(express.json());
app.use('/api/vehicles', vehicleRoutes);

describe('VehicleController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should list all vehicles', async () => {
        vi.mocked(prisma.vehicle.findMany).mockResolvedValue([
            { id: '1', plate: '1234ABC', make: 'Toyota', model: 'Corolla' }
        ] as never);

        const res = await request(app).get('/api/vehicles');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].plate).toBe('1234ABC');
    });

    it('should create a vehicle', async () => {
        const newVehicle = { plate: '5678DEF', make: 'Ford', model: 'Focus' };
        vi.mocked(prisma.vehicle.create).mockResolvedValue({ id: '2', ...newVehicle } as never);

        const res = await request(app).post('/api/vehicles').send(newVehicle);

        expect(res.status).toBe(200);
        expect(res.body.data.plate).toBe('5678DEF');
        expect(prisma.vehicle.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                plate: '5678DEF'
            })
        });
    });

    it('should update a vehicle', async () => {
        vi.mocked(prisma.vehicle.update).mockResolvedValue({ id: '1', plate: '1234ABC', currentMileage: 50000 } as never);

        const res = await request(app).put('/api/vehicles/1').send({ currentMileage: 50000 });

        expect(res.status).toBe(200);
        expect(res.body.data.currentMileage).toBe(50000);
    });

    it('should delete a vehicle', async () => {
        vi.mocked(prisma.vehicle.delete).mockResolvedValue({ id: '1' } as never);

        const res = await request(app).delete('/api/vehicles/1');

        expect(res.status).toBe(200);
    });
});
