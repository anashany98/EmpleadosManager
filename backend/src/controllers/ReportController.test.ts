import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
import { ReportController } from './ReportController';
import { ReportService } from '../services/ReportService';

vi.mock('../services/ReportService', () => ({
    ReportService: {
        getAttendanceData: vi.fn()
    }
}));

vi.mock('../services/ExcelService', () => ({
    ExcelService: {
        generateAttendanceReport: vi.fn()
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
        json: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        setHeader: vi.fn()
    };

    return res as unknown as Response;
};

describe('ReportController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(ReportService.getAttendanceData).mockResolvedValue({ data: [], total: 0 } as never);
    });

    it('forces the authenticated company when scoped users omit companyId', async () => {
        const req = {
            query: {
                start: '2025-01-01',
                end: '2025-01-31'
            },
            user: {
                id: 'manager-1',
                email: 'manager@test.com',
                role: 'manager',
                companyId: 'company-1'
            }
        } as unknown as Request;
        const res = createResponse();

        await ReportController.getAttendance(req, res);

        expect(ReportService.getAttendanceData).toHaveBeenCalledTimes(1);
        expect(vi.mocked(ReportService.getAttendanceData).mock.calls[0]?.[2]).toEqual({
            companyId: 'company-1',
            department: undefined
        });
    });

    it('rejects foreign company queries from scoped users', async () => {
        const req = {
            query: {
                start: '2025-01-01',
                end: '2025-01-31',
                companyId: 'company-2'
            },
            user: {
                id: 'manager-1',
                email: 'manager@test.com',
                role: 'manager',
                companyId: 'company-1'
            }
        } as unknown as Request;
        const res = createResponse();

        await ReportController.getAttendance(req, res);

        expect(ReportService.getAttendanceData).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado para acceder a otra empresa' });
    });
});
