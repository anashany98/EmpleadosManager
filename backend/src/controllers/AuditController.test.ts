import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
import { AuditController } from './AuditController';
import { prisma } from '../lib/prisma';

vi.mock('../lib/prisma', () => ({
    prisma: {
        auditLog: {
            findMany: vi.fn()
        }
    }
}));

const createResponse = () => {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
    };

    return res as unknown as Response;
};

describe('AuditController.getRecentActivity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as never);
    });

    it('scopes recent activity to the authenticated company for scoped staff', async () => {
        const req = {
            query: {},
            user: {
                id: 'manager-1',
                email: 'manager@test.com',
                role: 'manager',
                companyId: 'company-1'
            }
        } as unknown as Request;
        const res = createResponse();

        await AuditController.getRecentActivity(req, res);

        expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                OR: expect.arrayContaining([
                    expect.objectContaining({ targetEmployee: { companyId: 'company-1' } }),
                    expect.objectContaining({ user: { employee: { companyId: 'company-1' } } })
                ])
            })
        }));
    });

    it('rejects foreign company activity requests from scoped staff', async () => {
        const req = {
            query: { companyId: 'company-2' },
            user: {
                id: 'manager-1',
                email: 'manager@test.com',
                role: 'manager',
                companyId: 'company-1'
            }
        } as unknown as Request;
        const res = createResponse();

        await AuditController.getRecentActivity(req, res);

        expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado para acceder a otra empresa' });
    });
});
