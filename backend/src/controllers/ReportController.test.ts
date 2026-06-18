import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
import { ReportController } from './ReportController';
import { ReportService } from '../services/ReportService';
import { AuditService } from '../services/AuditService';

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

vi.mock('../services/AuditService', () => ({
    AuditService: {
        log: vi.fn().mockResolvedValue(undefined)
    },
    AuditAction: {
        DATA_EXPORT: 'DATA_EXPORT'
    },
    AuditEntity: {
        PAYROLL: 'PAYROLL'
    }
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

    it('writes an audit log entry on successful report access', async () => {
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

        expect(AuditService.log).toHaveBeenCalledTimes(1);
        const callArgs = vi.mocked(AuditService.log).mock.calls[0];
        expect(callArgs[0]).toBe('DATA_EXPORT');
        expect(callArgs[1]).toBe('PAYROLL');
        expect(callArgs[2]).toBe('report:attendance');
        expect(callArgs[4]).toBe('manager-1'); // userId
        const metadata = callArgs[3] as Record<string, unknown>;
        expect(metadata.report).toBe('attendance');
        expect(metadata.companyId).toBe('company-1');
        expect(metadata.format).toBe('json');
    });

    it('does NOT write an audit log when authorization fails', async () => {
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

        expect(AuditService.log).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('audit failures do not break the report response', async () => {
        vi.mocked(AuditService.log).mockRejectedValueOnce(new Error('DB down'));
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

        await expect(ReportController.getAttendance(req, res)).resolves.toBeUndefined();
        // Report should still be sent to the client
        expect(res.json).toHaveBeenCalled();
    });
});
