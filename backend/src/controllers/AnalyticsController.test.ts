import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
import { AnalyticsController } from './AnalyticsController';
import { AppError } from '../utils/AppError';
import { AnalyticsService } from '../services/AnalyticsService';

vi.mock('../services/AnalyticsService', () => ({
    AnalyticsService: {
        getMainKPIs: vi.fn()
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

describe('AnalyticsController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(AnalyticsService.getMainKPIs).mockResolvedValue({
            totalEmployees: 10,
            activeEmployees: 8,
            newHires: 1,
            departures: 1,
            turnoverRate: 10,
            avgTenure: 3,
            openPositions: null,
            pendingRequests: 2
        } as never);
    });

    it('uses the authenticated company for scoped users when no query override is provided', async () => {
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
        const next = vi.fn();

        await AnalyticsController.getKPIs(req, res, next);

        expect(AnalyticsService.getMainKPIs).toHaveBeenCalledWith({ companyId: 'company-1' });
        expect(next).not.toHaveBeenCalled();
    });

    it('blocks scoped users from forcing a foreign company', async () => {
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
        const next = vi.fn();

        await AnalyticsController.getKPIs(req, res, next);

        expect(AnalyticsService.getMainKPIs).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        expect((next.mock.calls[0][0] as AppError).statusCode).toBe(403);
    });

    it('allows global admins to query a specific company explicitly', async () => {
        const req = {
            query: { companyId: 'company-2' },
            user: {
                id: 'admin-1',
                email: 'admin@test.com',
                role: 'admin'
            }
        } as unknown as Request;
        const res = createResponse();
        const next = vi.fn();

        await AnalyticsController.getKPIs(req, res, next);

        expect(AnalyticsService.getMainKPIs).toHaveBeenCalledWith({ companyId: 'company-2' });
        expect(next).not.toHaveBeenCalled();
    });
});
