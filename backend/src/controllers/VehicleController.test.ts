import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import vehicleRoutes from '../routes/vehicleRoutes';

const mocks = vi.hoisted(() => ({
    prisma: {
        vehicle: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        },
        employee: {
            findUnique: vi.fn()
        },
        vehicleLog: {
            create: vi.fn(),
            findUnique: vi.fn(),
            delete: vi.fn()
        },
        vehicleDocument: {
            findUnique: vi.fn(),
            create: vi.fn(),
            delete: vi.fn()
        }
    }
}));

vi.mock('../middlewares/authMiddleware', () => ({
    protect: (req: { user?: unknown }, _res: unknown, next: () => void) => {
        req.user = { id: 'user-123', role: 'admin', permissions: {} };
        next();
    },
    checkPermission: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

vi.mock('../lib/prisma', () => ({
    prisma: mocks.prisma
}));

vi.mock('../services/AuditService', () => ({
    AuditService: {
        log: vi.fn().mockResolvedValue(undefined)
    }
}));

const app = express();
app.use(express.json());
app.use('/api/vehicles', vehicleRoutes);

const testDocumentDir = path.join(process.cwd(), 'uploads', 'vehicle-documents');
const testDocumentName = 'vehicle-controller-test.pdf';
const testDocumentPath = path.join(testDocumentDir, testDocumentName);

describe('VehicleController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.prisma.employee.findUnique.mockResolvedValue(null);
        mocks.prisma.vehicle.findUnique.mockResolvedValue(null);
        mocks.prisma.vehicleDocument.findUnique.mockResolvedValue(null);
    });

    afterEach(() => {
        if (fs.existsSync(testDocumentPath)) {
            fs.unlinkSync(testDocumentPath);
        }
    });

    it('should list all vehicles', async () => {
        mocks.prisma.vehicle.findMany.mockResolvedValue([
            { id: '1', plate: '1234ABC', make: 'Toyota', model: 'Corolla', logs: [], _count: { logs: 0 } }
        ]);

        const res = await request(app).get('/api/vehicles');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].plate).toBe('1234ABC');
    });

    it('should include vehicle documents when listing vehicles', async () => {
        mocks.prisma.vehicle.findMany.mockResolvedValue([
            {
                id: '1',
                plate: '1234ABC',
                make: 'Toyota',
                model: 'Corolla',
                documents: [{ id: 'doc-1', type: 'ITV', name: 'itv.pdf' }],
                logs: [],
                _count: { logs: 0 }
            }
        ]);

        const res = await request(app).get('/api/vehicles');

        expect(res.status).toBe(200);
        expect(res.body.data[0].documents).toHaveLength(1);
        expect(mocks.prisma.vehicle.findMany).toHaveBeenCalledWith(expect.objectContaining({
            include: expect.objectContaining({
                documents: { orderBy: { createdAt: 'desc' } }
            })
        }));
    });

    it('should create a vehicle and normalize the plate', async () => {
        mocks.prisma.vehicle.create.mockResolvedValue({
            id: '2',
            plate: '5678DEF',
            make: 'Ford',
            model: 'Focus',
            companyId: null,
            employeeId: null,
            logs: []
        });

        const res = await request(app).post('/api/vehicles').send({
            plate: '5678 def',
            make: 'Ford',
            model: 'Focus'
        });

        expect(res.status).toBe(200);
        expect(res.body.data.plate).toBe('5678DEF');
        expect(mocks.prisma.vehicle.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                plate: '5678DEF'
            })
        }));
    });

    it('should attach employee company when creating an assigned vehicle', async () => {
        mocks.prisma.employee.findUnique.mockResolvedValue({ companyId: 'company-1' });
        mocks.prisma.vehicle.create.mockResolvedValue({
            id: '2',
            plate: '5678DEF',
            make: 'Ford',
            model: 'Focus',
            companyId: 'company-1',
            employeeId: 'employee-1',
            logs: []
        });

        const res = await request(app).post('/api/vehicles').send({
            plate: '5678DEF',
            make: 'Ford',
            model: 'Focus',
            employeeId: 'employee-1'
        });

        expect(res.status).toBe(200);
        expect(mocks.prisma.vehicle.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                companyId: 'company-1',
                employeeId: 'employee-1'
            })
        }));
    });

    it('should update a vehicle', async () => {
        mocks.prisma.vehicle.findUnique.mockResolvedValue({
            id: '1',
            plate: '1234ABC',
            companyId: null,
            employeeId: null,
            employee: null,
            company: null
        });
        mocks.prisma.vehicle.update.mockResolvedValue({ id: '1', plate: '1234ABC', currentMileage: 50000, logs: [] });

        const res = await request(app).put('/api/vehicles/1').send({ currentMileage: 50000 });

        expect(res.status).toBe(200);
        expect(res.body.data.currentMileage).toBe(50000);
    });

    it('should add a vehicle log entry', async () => {
        mocks.prisma.vehicle.findUnique.mockResolvedValue({
            id: '1',
            plate: '1234ABC',
            companyId: null,
            employeeId: null,
            employee: null,
            company: null
        });
        mocks.prisma.vehicleLog.create.mockResolvedValue({
            id: 'log-1',
            vehicleId: '1',
            type: 'MAINTENANCE',
            title: 'Cambio de aceite'
        });

        const res = await request(app).post('/api/vehicles/1/logs').send({
            type: 'MAINTENANCE',
            title: 'Cambio de aceite'
        });

        expect(res.status).toBe(200);
        expect(res.body.data.type).toBe('MAINTENANCE');
    });

    it('should deactivate a vehicle instead of deleting it', async () => {
        mocks.prisma.vehicle.findUnique.mockResolvedValue({
            id: '1',
            plate: '1234ABC',
            companyId: null,
            employeeId: null,
            employee: null,
            company: null
        });
        mocks.prisma.vehicle.update.mockResolvedValue({ id: '1', status: 'INACTIVE' });

        const res = await request(app).delete('/api/vehicles/1');

        expect(res.status).toBe(200);
        expect(mocks.prisma.vehicle.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: '1' },
            data: { status: 'INACTIVE' }
        }));
        expect(mocks.prisma.vehicle.delete).not.toHaveBeenCalled();
    });

    it('should download a vehicle document through the protected route', async () => {
        fs.mkdirSync(testDocumentDir, { recursive: true });
        fs.writeFileSync(testDocumentPath, 'pdf-content');

        mocks.prisma.vehicle.findUnique.mockResolvedValue({
            id: '1',
            plate: '1234ABC',
            companyId: null,
            employeeId: null,
            employee: null,
            company: null
        });
        mocks.prisma.vehicleDocument.findUnique.mockResolvedValue({
            id: 'doc-1',
            vehicleId: '1',
            type: 'INSURANCE',
            name: 'seguro.pdf',
            fileUrl: `/uploads/vehicle-documents/${testDocumentName}`
        });

        const res = await request(app).get('/api/vehicles/1/documents/doc-1/download');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/pdf');
    });
});
