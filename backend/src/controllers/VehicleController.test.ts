import request from 'supertest';
import express from 'express';
import vehicleRoutes from '../routes/vehicleRoutes';
import { prisma } from '../lib/prisma';

// Mock Auth Middleware
jest.mock('../middlewares/authMiddleware', () => ({
    protect: (req: any, res: any, next: any) => {
        req.user = { id: 'user-123', role: 'admin', permissions: {} }; // Default Admin
        next();
    },
    checkPermission: (module: string, level: string) => (req: any, res: any, next: any) => next()
}));

// Mock Prisma
jest.mock('../lib/prisma', () => ({
    prisma: {
        vehicle: {
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
app.use('/api/vehicles', vehicleRoutes);

describe('VehicleController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should list all vehicles', async () => {
        (prisma.vehicle.findMany as jest.Mock).mockResolvedValue([
            { id: '1', plate: '1234ABC', make: 'Toyota', model: 'Corolla' }
        ]);

        const res = await request(app).get('/api/vehicles');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].plate).toBe('1234ABC');
    });

    it('should create a vehicle', async () => {
        const newVehicle = { plate: '5678DEF', make: 'Ford', model: 'Focus' };
        (prisma.vehicle.create as jest.Mock).mockResolvedValue({ id: '2', ...newVehicle });

        const res = await request(app).post('/api/vehicles').send(newVehicle);

        expect(res.status).toBe(201);
        expect(res.body.data.plate).toBe('5678DEF');
        expect(prisma.vehicle.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                plate: '5678DEF'
            })
        });
    });

    it('should update a vehicle', async () => {
        (prisma.vehicle.update as jest.Mock).mockResolvedValue({ id: '1', plate: '1234ABC', currentMileage: 50000 });

        const res = await request(app).put('/api/vehicles/1').send({ currentMileage: 50000 });

        expect(res.status).toBe(200);
        expect(res.body.data.currentMileage).toBe(50000);
    });

    it('should delete a vehicle', async () => {
        (prisma.vehicle.delete as jest.Mock).mockResolvedValue({ id: '1' });

        const res = await request(app).delete('/api/vehicles/1');

        expect(res.status).toBe(200);
    });
});
