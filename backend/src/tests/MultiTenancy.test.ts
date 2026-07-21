import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../services/StorageService', () => ({
    StorageService: { saveBuffer: vi.fn(), getSignedDownloadUrl: vi.fn(), deleteFile: vi.fn() }
}));
vi.mock('../services/EmailService', () => ({
    EmailService: { sendMail: vi.fn() }
}));
vi.mock('../services/NotificationService', () => ({
    NotificationService: { notifyAdmins: vi.fn(), create: vi.fn() }
}));
vi.mock('../services/AnomalyService', () => ({
    AnomalyService: { detectVacation: vi.fn(), detectExpense: vi.fn() }
}));
vi.mock('../services/EncryptionService', () => ({
    EncryptionService: {
        encrypt: vi.fn((val) => val ? `encrypted_${val}` : null),
        decrypt: vi.fn((val) => val ? val.replace('encrypted_', '') : null)
    }
}));
vi.mock('../services/AuditService', () => ({
    AuditService: { log: vi.fn(), logSecurityEvent: vi.fn() }
}));

import { EmployeeController } from '../controllers/EmployeeController';
import { prisma } from '../lib/prisma';

vi.mock('../lib/prisma', () => ({
    prisma: (() => {
        const mock: any = {
            employee: {
                findMany: vi.fn(),
                count: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                findUnique: vi.fn(),
                findFirst: vi.fn(),
                delete: vi.fn(),
            },
            vacation: { findMany: vi.fn(), count: vi.fn() },
            expense: { findMany: vi.fn(), count: vi.fn() },
            employeeVacationBalance: { findUnique: vi.fn(), upsert: vi.fn() },
            auditLog: { create: vi.fn(), findMany: vi.fn() },
        };
        mock.$transaction = vi.fn(async (cb: any) => cb(mock));
        return mock;
    })()
}));

const mockReq = (user: any, params: any = {}, body: any = {}) => ({
    user, params, body, query: {}
}) as unknown as Request;

const mockRes = () => {
    const res: Partial<Response> = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        // MED-007: handleControllerError añade X-Request-Id
        // para correlación de errores en producción. El mock
        // necesita el método aunque el test no lo inspeccione.
        setHeader: vi.fn().mockReturnThis(),
    };
    return res as Response;
};

describe('Multi-tenant isolation (extended)', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('EmployeeController.update', () => {
        it('should BLOCK cross-company update via canManageEmployee', async () => {
            const user = { id: 'u1', role: 'admin', companyId: 'company-A', employeeId: null, permissions: {} };
            const req = mockReq(user, { id: 'emp-B' }, { name: 'Hacked' });
            const res = mockRes();

            // Target employee belongs to company-B
            (prisma.employee.findUnique as any).mockResolvedValue({
                id: 'emp-B',
                companyId: 'company-B'
            });

            await EmployeeController.update(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should ALLOW same-company update', async () => {
            const user = { id: 'u1', role: 'admin', companyId: 'company-A', employeeId: null, permissions: {} };
            const req = mockReq(user, { id: 'emp-A' }, { name: 'Updated' });
            const res = mockRes();

            (prisma.employee.findUnique as any).mockResolvedValue({
                id: 'emp-A',
                companyId: 'company-A',
                name: 'Old Name',
                firstName: 'Old',
                lastName: 'Name'
            });
            (prisma.employee.update as any).mockResolvedValue({
                id: 'emp-A',
                name: 'Updated',
                companyId: 'company-A'
            });

            await EmployeeController.update(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true
            }));
        });

        it('should ALLOW self-edit for own employee record', async () => {
            const user = { id: 'u1', role: 'employee', companyId: 'company-A', employeeId: 'emp-A', permissions: {} };
            const req = mockReq(user, { id: 'emp-A' }, { phone: '600123456' });
            const res = mockRes();

            (prisma.employee.findUnique as any).mockResolvedValue({
                id: 'emp-A',
                companyId: 'company-A'
            });
            (prisma.employee.update as any).mockResolvedValue({
                id: 'emp-A',
                phone: '600123456'
            });

            await EmployeeController.update(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true
            }));
        });

        it('should BLOCK self-edit from changing forbidden fields', async () => {
            const user = { id: 'u1', role: 'employee', companyId: 'company-A', employeeId: 'emp-A', permissions: {} };
            const req = mockReq(user, { id: 'emp-A' }, { salary: 99999, phone: '600123456' });
            const res = mockRes();

            (prisma.employee.findUnique as any).mockResolvedValue({
                id: 'emp-A',
                companyId: 'company-A'
            });

            await EmployeeController.update(req, res);

            // Should reject because 'salary' is not in SELF_EDITABLE_EMPLOYEE_FIELDS
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('EmployeeController.delete', () => {
        it('should BLOCK cross-company delete', async () => {
            const user = { id: 'u1', role: 'admin', companyId: 'company-A' };
            const req = mockReq(user, { id: 'emp-B' });
            const res = mockRes();

            (prisma.employee.findUnique as any).mockResolvedValue({
                id: 'emp-B',
                companyId: 'company-B',
                name: 'Target'
            });

            await EmployeeController.delete(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('EmployeeController.getById', () => {
        it('should BLOCK cross-company read', async () => {
            const user = { id: 'u1', role: 'admin', companyId: 'company-A', employeeId: null, permissions: {} };
            const req = mockReq(user, { id: 'emp-B' });
            const res = mockRes();

            (prisma.employee.findUnique as any).mockResolvedValue({
                id: 'emp-B',
                companyId: 'company-B'
            });

            await EmployeeController.getById(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should ALLOW global admin to read any employee', async () => {
            const user = { id: 'u1', role: 'admin', companyId: null, employeeId: null, permissions: {} };
            const req = mockReq(user, { id: 'emp-B' });
            const res = mockRes();

            (prisma.employee.findUnique as any).mockResolvedValue({
                id: 'emp-B',
                companyId: 'company-B',
                name: 'Employee B',
                dni: 'encrypted_12345678A'
            });

            await EmployeeController.getById(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true
            }));
        });
    });
});
