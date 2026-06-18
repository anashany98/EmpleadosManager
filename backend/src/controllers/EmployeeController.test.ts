import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { EmployeeController } from './EmployeeController';
import { prisma } from '../lib/prisma';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
    prisma: {
        $transaction: vi.fn(async (callback) => callback({
            employee: {
                create: vi.fn()
            },
            employeeVacationBalance: {
                findUnique: vi.fn(),
                upsert: vi.fn()
            },
            vacation: {
                findMany: vi.fn()
            }
        })),
        employee: {
            count: vi.fn(),
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn()
        },
        employeeVacationBalance: {
            findUnique: vi.fn(),
            upsert: vi.fn()
        },
        vacation: {
            findMany: vi.fn()
        },
        auditLog: {
            findMany: vi.fn(),
            create: vi.fn()
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
        (prisma.employeeVacationBalance.findUnique as any).mockResolvedValue(null);
        (prisma.vacation.findMany as any).mockResolvedValue([]);
        (prisma.$transaction as any).mockImplementation(async (callback: any) => callback({
            employee: {
                create: prisma.employee.create
            },
            employeeVacationBalance: {
                findUnique: prisma.employeeVacationBalance.findUnique,
                upsert: prisma.employeeVacationBalance.upsert
            },
            vacation: {
                findMany: prisma.vacation.findMany
            }
        }));
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
            const payload = (res.json as any).mock.calls[0][0];
            expect(payload.success).toBe(true);
            expect(payload.data.data[0]).not.toHaveProperty('socialSecurityNumber');
            expect(payload.data.data[0]).not.toHaveProperty('iban');
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

            (prisma.employee.findUnique as any).mockResolvedValue({
                id: 'emp-other',
                companyId: 'company-1',
                emergencyContacts: []
            });

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

    describe('update', () => {
        it('rejects employee self-update outside contact/emergency scope', async () => {
            const req = mockRequest({
                user: { id: 'user-1', role: 'employee', employeeId: 'emp-1' },
                params: { id: 'emp-1' },
                body: { annualGrossSalary: 99999 }
            });
            const res = mockResponse();

            (prisma.employee.findUnique as any).mockResolvedValue({ id: 'emp-1', companyId: 'company-1' });

            await EmployeeController.update(req, res);

            expect(prisma.employee.update).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('allows employee self-update for contact fields', async () => {
            const req = mockRequest({
                user: { id: 'user-1', role: 'employee', employeeId: 'emp-1' },
                params: { id: 'emp-1' },
                body: { phone: '600123123', city: 'Palma' }
            });
            const res = mockResponse();

            (prisma.employee.findUnique as any).mockResolvedValue({ id: 'emp-1', companyId: 'company-1' });
            (prisma.employee.update as any).mockResolvedValue({
                id: 'emp-1',
                companyId: 'company-1',
                phone: '600123123',
                city: 'Palma',
                emergencyContacts: []
            });

            await EmployeeController.update(req, res);

            expect(prisma.employee.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'emp-1' },
                data: expect.objectContaining({
                    phone: '600123123',
                    city: 'Palma'
                })
            }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true
            }));
        });
    });

    describe('getVacationBalance', () => {
        it('returns the computed annual vacation balance', async () => {
            const req = mockRequest({
                user: { id: 'admin-1', role: 'admin' },
                params: { id: 'emp-1' },
                query: { year: '2026' }
            });
            const res = mockResponse();

            (prisma.employee.findUnique as any).mockResolvedValue({
                id: 'emp-1',
                companyId: null,
                entryDate: new Date('2025-01-01'),
                createdAt: new Date('2025-01-01')
            });
            (prisma.employeeVacationBalance.findUnique as any).mockResolvedValue({
                employeeId: 'emp-1',
                year: 2026,
                annualQuotaDays: 30,
                carriedOverDays: 5,
                importedUsedDays: 7
            });
            (prisma.vacation.findMany as any).mockResolvedValue([
                {
                    type: 'VACATION',
                    startDate: new Date('2026-08-01'),
                    endDate: new Date('2026-08-03'),
                    status: 'APPROVED'
                }
            ]);

            await EmployeeController.getVacationBalance(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    year: 2026,
                    totalEntitledDays: 35,
                    approvedUsedDays: 3,
                    availableDays: 25
                })
            }));
        });
    });

    describe('updatePrivateNotes', () => {
        it('updates private notes and records a history entry', async () => {
            const req = mockRequest({
                user: { id: 'admin-1', role: 'admin' },
                params: { id: 'emp-1' },
                body: { note: 'Nueva nota interna' }
            });
            const res = mockResponse();

            (prisma.employee.findUnique as any).mockResolvedValue({
                id: 'emp-1',
                companyId: null,
                privateNotes: 'Nota anterior'
            });
            (prisma.employee.update as any).mockResolvedValue({
                id: 'emp-1',
                privateNotes: 'Nueva nota interna'
            });

            await EmployeeController.updatePrivateNotes(req, res);

            expect(prisma.employee.update).toHaveBeenCalledWith({
                where: { id: 'emp-1' },
                data: { privateNotes: 'Nueva nota interna' },
                select: { id: true, privateNotes: true }
            });
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({ privateNotes: 'Nueva nota interna' })
            }));
        });
    });

    describe('updateVacationBalance', () => {
        it('updates the selected annual vacation balance and returns the recalculated summary', async () => {
            const req = mockRequest({
                user: { id: 'admin-1', role: 'admin' },
                params: { id: 'emp-1' },
                body: {
                    year: 2026,
                    annualQuotaDays: 30,
                    carriedOverDays: 6,
                    importedUsedDays: 4
                }
            });
            const res = mockResponse();

            (prisma.employee.findUnique as any).mockResolvedValue({
                id: 'emp-1',
                companyId: null,
                entryDate: new Date('2024-01-01'),
                createdAt: new Date('2024-01-01'),
                name: 'John Doe'
            });
            (prisma.employeeVacationBalance.findUnique as any)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({
                    employeeId: 'emp-1',
                    year: 2026,
                    annualQuotaDays: 30,
                    carriedOverDays: 6,
                    importedUsedDays: 4
                });
            (prisma.employeeVacationBalance.upsert as any).mockResolvedValue({
                employeeId: 'emp-1',
                year: 2026,
                annualQuotaDays: 30,
                carriedOverDays: 6,
                importedUsedDays: 4
            });
            (prisma.vacation.findMany as any).mockResolvedValue([]);

            await EmployeeController.updateVacationBalance(req, res);

            expect(prisma.employeeVacationBalance.upsert).toHaveBeenCalledWith(expect.objectContaining({
                create: expect.objectContaining({
                    employeeId: 'emp-1',
                    year: 2026,
                    annualQuotaDays: 30,
                    carriedOverDays: 6,
                    importedUsedDays: 4
                })
            }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    totalEntitledDays: 36,
                    availableDays: 32
                })
            }));
        });
    });

    describe('getPrivateNotesHistory', () => {
        it('returns parsed note history entries', async () => {
            const req = mockRequest({
                user: { id: 'admin-1', role: 'admin' },
                params: { id: 'emp-1' }
            });
            const res = mockResponse();

            (prisma.employee.findUnique as any).mockResolvedValue({
                id: 'emp-1',
                companyId: null,
                privateNotes: 'Nota actual',
                updatedAt: new Date('2026-04-24T09:00:00.000Z')
            });
            (prisma.auditLog.findMany as any).mockResolvedValue([
                {
                    id: 'log-1',
                    createdAt: new Date('2026-04-24T10:00:00.000Z'),
                    metadata: JSON.stringify({
                        note: 'Nueva nota interna',
                        previousNote: 'Nota anterior'
                    }),
                    user: {
                        email: 'admin@test.local',
                        employee: {
                            firstName: 'Ana',
                            lastName: 'Admin',
                            name: 'Ana Admin'
                        }
                    }
                }
            ]);

            await EmployeeController.getPrivateNotesHistory(req, res);

            expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: {
                    entity: 'EMPLOYEE',
                    entityId: 'emp-1',
                    action: 'PRIVATE_NOTE_UPDATE'
                }
            }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.arrayContaining([
                    expect.objectContaining({
                        note: 'Nueva nota interna',
                        authorName: 'Ana Admin'
                    })
                ])
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
