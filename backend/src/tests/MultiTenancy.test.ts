// Move imports that depend on StorageService after the mock or mock them first
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock Services BEFORE importing controllers
vi.mock('../services/StorageService', () => ({
    StorageService: {
        saveBuffer: vi.fn(),
        getSignedDownloadUrl: vi.fn(),
        deleteFile: vi.fn()
    }
}));

vi.mock('../services/EmailService', () => ({
    EmailService: {
        sendMail: vi.fn()
    }
}));

vi.mock('../services/NotificationService', () => ({
    NotificationService: {
        notifyAdmins: vi.fn(),
        create: vi.fn()
    }
}));

vi.mock('../services/AnomalyService', () => ({
    AnomalyService: {
        detectVacation: vi.fn(),
        detectExpense: vi.fn()
    }
}));

vi.mock('../services/EncryptionService', () => ({
    EncryptionService: {
        encrypt: vi.fn((val) => val ? `encrypted_${val}` : null),
        decrypt: vi.fn((val) => val ? val.replace('encrypted_', '') : null)
    }
}));

vi.mock('../services/AuditService', () => ({
    AuditService: {
        log: vi.fn()
    }
}));

import { EmployeeController } from '../controllers/EmployeeController';
import { VacationController } from '../controllers/VacationController';
import { ExpenseController } from '../controllers/ExpenseController';
import { TimeEntryController } from '../controllers/TimeEntryController';
import { prisma } from '../lib/prisma';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
    prisma: {
        employee: {
            findMany: vi.fn(),
            count: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            delete: vi.fn(),
        },
        vacation: {
            findMany: vi.fn(),
        },
        expense: {
            findMany: vi.fn(),
        },
        timeEntry: {
            create: vi.fn(),
            findFirst: vi.fn()
        }
    }
}));

// Helper to create mock request/response
const mockRequest = (user: any, query: any = {}) => ({
    user,
    query,
    params: {},
    body: {}
}) as unknown as Request;

const mockResponse = () => {
    const res: Partial<Response> = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    };
    return res as Response;
};

describe('Multi-tenancy Security', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('EmployeeController.create', () => {
        it('should allow Admin to create employee in their OWN company', async () => {
            const user = { id: 'u1', role: 'admin', companyId: 'company-A' };
            const req = mockRequest(user);
            req.body = {
                dni: '12345678A',
                companyId: 'company-A', // Matching company
                name: 'New Employee'
            };
            const res = mockResponse();

            (prisma.employee.findUnique as any).mockResolvedValue(null); // No dup DNI/Subaccount
            (prisma.employee.create as any).mockResolvedValue({ id: 'new-1', ...req.body });

            await EmployeeController.create(req, res);


            // Verify success response wrapper: { success, message, data: { id: 'new-1' } }
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    id: 'new-1'
                })
            }));

            // Verify companyId enforcement manually
            const createCalls = (prisma.employee.create as any).mock.calls;
            expect(createCalls.length).toBe(1);
            const createArg = createCalls[0][0];

            // Check critical fields
            expect(createArg.data.companyId).toBe('company-A');
            expect(createArg.data.dni).toBe('12345678A');
        });

        it('should BLOCK Admin from creating employee in ANOTHER company', async () => {
            const user = { id: 'u1', role: 'admin', companyId: 'company-A' };
            const req = mockRequest(user);
            req.body = {
                dni: '12345678B',
                companyId: 'company-B', // Different company
                name: 'Intruder'
            };
            const res = mockResponse();

            await EmployeeController.create(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('EmployeeController.getAll', () => {
        it('should filter employees by companyId for standard admins', async () => {
            const user = { id: 'u1', role: 'admin', companyId: 'company-A' };
            const req = mockRequest(user);
            const res = mockResponse();

            (prisma.employee.findMany as any).mockResolvedValue([]);
            (prisma.employee.count as any).mockResolvedValue(0);

            await EmployeeController.getAll(req, res);

            // Verify that companyId was added to the prisma query
            expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    companyId: 'company-A'
                })
            }));
        });

        it('should NOT filter by companyId for Super Admins (no companyId)', async () => {
            const user = { id: 'u2', role: 'admin', companyId: null }; // Simulating superadmin without company
            const req = mockRequest(user);
            const res = mockResponse();

            (prisma.employee.findMany as any).mockResolvedValue([]);
            (prisma.employee.count as any).mockResolvedValue(0);

            await EmployeeController.getAll(req, res);

            // Verify that companyId was NOT added to the prisma query
            expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.not.objectContaining({
                    companyId: expect.anything()
                })
            }));
        });
    });

    describe('VacationController.getAll', () => {
        it('should filter vacations by employee companyId', async () => {
            const user = { id: 'u1', role: 'admin', companyId: 'company-B' };
            const req = mockRequest(user);
            const res = mockResponse();

            (prisma.vacation.findMany as any).mockResolvedValue([]);

            await VacationController.getAll(req, res);

            // Verify that the query filters employees by companyId
            expect(prisma.vacation.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    employee: {
                        companyId: 'company-B'
                    }
                })
            }));
        });
    });

    describe('ExpenseController.getAll', () => {
        it('should filter expenses by employee companyId', async () => {
            const user = { id: 'u1', role: 'admin', companyId: 'company-C' };
            const req = mockRequest(user);
            const res = mockResponse();

            (prisma.expense.findMany as any).mockResolvedValue([]);

            await ExpenseController.getAll(req, res);

            expect(prisma.expense.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    employee: {
                        companyId: 'company-C'
                    }
                })
            }));
        });
    });
    describe('TimeEntryController.createManual', () => {
        it('should BLOCK Admin from creating time entry for employee in ANOTHER company', async () => {
            const user = { id: 'u1', role: 'admin', companyId: 'company-A' };
            const req = mockRequest(user);
            req.body = {
                employeeId: 'emp-B', // Belongs to Company B
                type: 'IN',
                timestamp: new Date()
            };
            const res = mockResponse();

            // Mock employee lookup to return Company B
            (prisma.employee.findUnique as any).mockResolvedValue({ id: 'emp-B', companyId: 'company-B' });

            await TimeEntryController.createManual(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });
});
