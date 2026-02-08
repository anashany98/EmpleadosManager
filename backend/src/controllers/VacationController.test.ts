import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { VacationController } from './VacationController';
import { prisma } from '../lib/prisma';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
    prisma: {
        vacation: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        },
        employee: {
            findUnique: vi.fn(),
            findFirst: vi.fn()
        }
    }
}));

// Mock services
vi.mock('../services/NotificationService', () => ({
    NotificationService: {
        notifyAdmins: vi.fn(),
        notifyUser: vi.fn()
    }
}));

vi.mock('../services/AnomalyService', () => ({
    AnomalyService: {
        detectVacation: vi.fn()
    }
}));

vi.mock('../services/EmailService', () => ({
    EmailService: {
        sendMail: vi.fn()
    }
}));

vi.mock('../services/HolidayService', () => ({
    HolidayService: {
        getWorkingDays: vi.fn().mockResolvedValue(5)
    }
}));

vi.mock('../services/StorageService', () => ({
    StorageService: {
        provider: 'local',
        saveBuffer: vi.fn().mockResolvedValue({ key: 'mock-key' }),
        deleteFile: vi.fn().mockResolvedValue(undefined)
    }
}));

// Helper to create mock request/response
const mockRequest = (options: { user?: any; params?: any; body?: any; query?: any }) => ({
    params: options.params || {},
    body: options.body || {},
    query: options.query || {},
    user: options.user
}) as unknown as Request;

const mockResponse = () => {
    const res: Partial<Response> = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
    };
    return res as Response;
};

describe('VacationController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAll', () => {
        it('should return all vacations for admin', async () => {
            const req = mockRequest({
                user: { id: 'admin-1', role: 'admin', email: 'admin@test.com' }
            });
            const res = mockResponse();

            const mockVacations = [
                { id: 'v1', employeeId: 'e1', startDate: new Date(), endDate: new Date(), status: 'PENDING' },
                { id: 'v2', employeeId: 'e2', startDate: new Date(), endDate: new Date(), status: 'APPROVED' }
            ];
            (prisma.vacation.findMany as any).mockResolvedValue(mockVacations);

            await VacationController.getAll(req, res);

            expect(prisma.vacation.findMany).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: mockVacations
            }));
        });

        it('should reject non-admin users', async () => {
            const req = mockRequest({
                user: { id: 'user-1', role: 'employee', email: 'user@test.com' }
            });
            const res = mockResponse();

            await VacationController.getAll(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should reject unauthenticated requests', async () => {
            const req = mockRequest({});
            const res = mockResponse();

            await VacationController.getAll(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('getByEmployee', () => {
        it('should allow employee to see their own vacations', async () => {
            const empId = 'emp-123';
            const req = mockRequest({
                user: { id: 'user-1', role: 'employee', employeeId: empId },
                params: { employeeId: empId }
            });
            const res = mockResponse();

            const mockVacations = [
                { id: 'v1', employeeId: empId, startDate: new Date(), status: 'PENDING' }
            ];
            (prisma.vacation.findMany as any).mockResolvedValue(mockVacations);

            await VacationController.getByEmployee(req, res);

            expect(prisma.vacation.findMany).toHaveBeenCalledWith({
                where: { employeeId: empId },
                orderBy: { startDate: 'desc' }
            });
            expect(res.json).toHaveBeenCalledWith(mockVacations);
        });

        it('should allow manager to see subordinate vacations', async () => {
            const managerId = 'manager-1';
            const subordinateId = 'emp-123';
            const req = mockRequest({
                user: { id: 'user-1', role: 'employee', employeeId: managerId },
                params: { employeeId: subordinateId }
            });
            const res = mockResponse();

            (prisma.employee.findUnique as any).mockResolvedValue({ managerId: managerId });
            (prisma.vacation.findMany as any).mockResolvedValue([]);

            await VacationController.getByEmployee(req, res);

            expect(prisma.vacation.findMany).toHaveBeenCalled();
        });

        it('should reject unauthorized access to other employee vacations', async () => {
            const req = mockRequest({
                user: { id: 'user-1', role: 'employee', employeeId: 'emp-1' },
                params: { employeeId: 'emp-other' }
            });
            const res = mockResponse();

            (prisma.employee.findUnique as any).mockResolvedValue({ managerId: 'someone-else' });

            await VacationController.getByEmployee(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });
});
