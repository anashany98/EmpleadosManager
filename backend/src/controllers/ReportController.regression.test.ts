import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../services/ReportService', () => ({ ReportService: {
    getAttendanceDailySummary: vi.fn().mockResolvedValue([]),
    getVacationData: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    getDetailedAbsenceData: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    getCompanyCostData: vi.fn().mockResolvedValue([]),
    getKPIMetrics: vi.fn().mockResolvedValue({}),
    getAbsenteeismByDepartment: vi.fn().mockResolvedValue([]),
    getObraSummary: vi.fn().mockResolvedValue({ obras: [] })
} }));
vi.mock('../services/ExcelService', () => ({ ExcelService: {
    generateVacationReport: vi.fn().mockResolvedValue(Buffer.from('xlsx')),
    generateDetailedAbsenceReport: vi.fn().mockResolvedValue(Buffer.from('xlsx'))
} }));
vi.mock('../services/LoggerService', () => ({ createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) }));
vi.mock('../services/AuditService', () => ({ AuditService: { log: vi.fn() }, AuditAction: { DATA_EXPORT: 'DATA_EXPORT' }, AuditEntity: { PAYROLL: 'PAYROLL' } }));
import { ReportController } from './ReportController';
import { ReportService } from '../services/ReportService';

function request(query: object): Request { return { query, user: { id: 'u1', role: 'admin', companyId: 'A' } } as unknown as Request; }
function response(): Response { return { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn(), setHeader: vi.fn() } as unknown as Response; }

describe('report controller regressions', () => {
    beforeEach(() => vi.clearAllMocks());
    it('includes the full final attendance date and passes the department', async () => {
        await ReportController.getAttendanceSummary(request({ start: '2026-10-05', end: '2026-10-05', department: 'Taller' }), response());
        expect(ReportService.getAttendanceDailySummary).toHaveBeenCalledWith(new Date('2026-10-05T00:00:00Z'), new Date('2026-10-05T23:59:59.999Z'), expect.objectContaining({ companyId: 'A', department: 'Taller' }));
    });
    it.each([{ start: 'not-a-date', end: '2026-10-05' }, { start: '2026-10-06', end: '2026-10-05' }])('rejects an invalid attendance date range %j', async (query) => {
        const res = response();
        await ReportController.getAttendanceSummary(request(query), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(ReportService.getAttendanceDailySummary).not.toHaveBeenCalled();
    });
    it('uses the inclusive end date for obra costs', async () => {
        await ReportController.getObras(request({ from: '2026-08-01', to: '2026-08-31' }), response());
        expect(ReportService.getObraSummary).toHaveBeenCalledWith(expect.objectContaining({ to: new Date('2026-08-31T23:59:59.999Z') }));
    });
    it.each(['getVacations', 'getDetailedAbsences'] as const)('%s does not silently cap the full report or Excel at 500', async (method) => {
        const service = method === 'getVacations' ? ReportService.getVacationData : ReportService.getDetailedAbsenceData;
        for (const format of ['json', 'xlsx']) {
            await ReportController[method](request({ year: '2026', start: '2026-08-01', end: '2026-08-31', format }), response());
            expect(vi.mocked(service).mock.calls.at(-1)?.at(-1)).toBeUndefined();
        }
    });
    it('keeps JSON pagination but exports every matching vacation when a page is specified', async () => {
        await ReportController.getVacations(request({ year: '2026', page: '2', limit: '10' }), response());
        expect(ReportService.getVacationData).toHaveBeenLastCalledWith(2026, expect.anything(), expect.objectContaining({ skip: 10, limit: 10 }));
        await ReportController.getVacations(request({ year: '2026', page: '2', limit: '10', format: 'xlsx' }), response());
        expect(ReportService.getVacationData).toHaveBeenLastCalledWith(2026, expect.anything(), undefined);
    });
    it('passes departments to costs and KPIs', async () => {
        await ReportController.getCosts(request({ year: '2026', month: '8', department: 'Taller' }), response());
        expect(ReportService.getCompanyCostData).toHaveBeenCalledWith(2026, 8, expect.objectContaining({ department: 'Taller' }));
        await ReportController.getKPIs(request({ year: '2026', month: '8', department: 'Taller' }), response());
        expect(ReportService.getKPIMetrics).toHaveBeenCalledWith(2026, 8, expect.objectContaining({ department: 'Taller' }));
    });
});
