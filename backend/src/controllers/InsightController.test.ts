import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { InsightController } from './InsightController';

vi.mock('../lib/prisma', () => ({
    prisma: {
        employee: {
            findMany: vi.fn()
        }
    }
}));

vi.mock('../services/LoggerService', () => ({
    createLogger: () => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    })
}));

const createResponse = () => {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
    };

    return res as unknown as Response;
};

describe('InsightController', () => {
    const controller = new InsightController();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.employee.findMany).mockResolvedValue([] as never);
    });

    it('applies authenticated company scope to dashboard birthday data', async () => {
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

        await controller.getUpcomingBirthdays(req, res);

        expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { active: true, companyId: 'company-1' }
        }));
    });

    it('rejects foreign company queries for dashboard insights', async () => {
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

        await controller.getUpcomingBirthdays(req, res);

        expect(prisma.employee.findMany).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: 'No autorizado para acceder a otra empresa',
            errors: null
        });
    });
});
