import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { EmployeeController } from './EmployeeController';
import { prisma } from '../lib/prisma';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
    prisma: {
        employee: {
            count: vi.fn(),
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn()
        },
        medicalReview: {
            findMany: vi.fn(),
            create: vi.fn(),
            delete: vi.fn()
        },
        training: {
            findMany: vi.fn(),
            create: vi.fn(),
            delete: vi.fn()
        }
    }
}));

// Mock services
vi.mock('../services/AuditService', () => ({
    AuditService: {
        log: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../services/EncryptionService', () => ({
    EncryptionService: {
        encrypt: vi.fn((val) => val ? `encrypted_${val}` : null),
        decrypt: vi.fn((val) => val ? val.replace('encrypted_', '') : null)
    }
}));

// Helper to create mock request/response
const mockRequest = (options: { user?: any; params?: any; body?: any; query?: any; file?: any }) => ({
    params: options.params || {},
    body: options.body || {},
    query: options.query || {},
    file: options.file,
    user: options.user
}) as unknown as Request;

const mockResponse = () => {
    const res: Partial<Response> = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        setHeader: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis()
    };
    return res as Response;
};

describe('EmployeeController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAll', () => {
        it('should return all active employees', async () => {
            const req = mockRequest({
                user: { id: 'admin-1', role: 'admin' },
                query: {}
            });
            const res = mockResponse();

            const mockEmployees = [
                { id: 'e1', name: 'John Doe', active: true, socialSecurityNumber: 'encrypted_123', iban: 'encrypted_ES00' },
                { id: 'e2', name: 'Jane Doe', active: true, socialSecurityNumber: 'encrypted_456', iban: 'encrypted_ES01' }
            ];
            (prisma.employee.count as any).mockResolvedValue(2);
            (prisma.employee.findMany as any).mockResolvedValue(mockEmployees);

            await EmployeeController.getAll(req, res);

            expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { active: true }
            }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true
            }));
        });

        it('should support pagination', async () => {
            const req = mockRequest({
                user: { id: 'admin-1', role: 'admin' },
                query: { page: '2', limit: '10' }
            });
            const res = mockResponse();

            (prisma.employee.count as any).mockResolvedValue(25);
            (prisma.employee.findMany as any).mockResolvedValue([]);

            await EmployeeController.getAll(req, res);

            expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
                skip: 10,
                take: 10
            }));
        });
    });

    describe('getById', () => {
        it('should return employee details for admin', async () => {
            const req = mockRequest({
                user: { id: 'admin-1', role: 'admin' },
                params: { id: 'emp-1' }
            });
            const res = mockResponse();

            const mockEmployee = {
                id: 'emp-1',
                name: 'John Doe',
                socialSecurityNumber: 'encrypted_123',
                iban: 'encrypted_ES00',
                payrollRows: [],
                emergencyContacts: []
            };
            (prisma.employee.findUnique as any).mockResolvedValue(mockEmployee);

            await EmployeeController.getById(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true
            }));
        });

        it('should allow employee to view own profile', async () => {
            const req = mockRequest({
                user: { id: 'user-1', role: 'employee', employeeId: 'emp-1' },
                params: { id: 'emp-1' }
            });
            const res = mockResponse();

            const mockEmployee = {
                id: 'emp-1',
                name: 'Self',
                socialSecurityNumber: 'encrypted_123',
                iban: 'encrypted_ES00',
                payrollRows: [],
                emergencyContacts: []
            };
            (prisma.employee.findUnique as any).mockResolvedValue(mockEmployee);

            await EmployeeController.getById(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true
            }));
        });

        it('should reject employee viewing other profiles', async () => {
            const req = mockRequest({
                user: { id: 'user-1', role: 'employee', employeeId: 'emp-1' },
                params: { id: 'emp-other' } // Different employee
            });
            const res = mockResponse();

            await EmployeeController.getById(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should return 404 for non-existent employee', async () => {
            const req = mockRequest({
                user: { id: 'admin-1', role: 'admin' },
                params: { id: 'non-existent' }
            });
            const res = mockResponse();

            (prisma.employee.findUnique as any).mockResolvedValue(null);

            await EmployeeController.getById(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('getDepartments', () => {
        it('should return unique departments', async () => {
            const req = mockRequest({
                user: { id: 'admin-1', role: 'admin' }
            });
            const res = mockResponse();

            (prisma.employee.findMany as any).mockResolvedValue([
                { department: 'IT' },
                { department: 'RRHH' },
                { department: 'Finance' }
            ]);

            await EmployeeController.getDepartments(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.arrayContaining(['Finance', 'IT', 'RRHH'])
            }));
        });
    });

    describe('getMedicalReviews', () => {
        it('should return medical reviews for employee', async () => {
            const req = mockRequest({
                user: { id: 'admin-1', role: 'admin' },
                params: { id: 'emp-1' }
            });
            const res = mockResponse();

            const mockReviews = [
                { id: 'r1', date: new Date(), result: 'APTO' }
            ];
            (prisma.medicalReview.findMany as any).mockResolvedValue(mockReviews);

            await EmployeeController.getMedicalReviews(req, res);

            expect(prisma.medicalReview.findMany).toHaveBeenCalledWith({
                where: { employeeId: 'emp-1' },
                orderBy: { date: 'desc' }
            });
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: mockReviews
            }));
        });
    });
});
