import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({ prisma: { reportSchedule: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } } }));
vi.mock('./reports', () => ({ ReportService: {
    getObraSummary: vi.fn().mockResolvedValue({ obras: [] }),
    getObraEmployeeBreakdown: vi.fn().mockResolvedValue([]),
    getMedicalReviewsReport: vi.fn().mockResolvedValue({ rows: [] }),
    getTrainingsReport: vi.fn().mockResolvedValue({ rows: [] }),
    getMonthlyTerminations: vi.fn().mockResolvedValue([]),
    getCompanyCostData: vi.fn().mockResolvedValue([]),
    getAttendanceDailySummary: vi.fn().mockResolvedValue([])
} }));
vi.mock('./ExcelService', () => ({ ExcelService: {
    generateObraSummaryReport: vi.fn().mockResolvedValue(Buffer.from('xlsx')),
    generateObraEmployeeReport: vi.fn().mockResolvedValue(Buffer.from('xlsx')),
    generateMedicalReviewsReport: vi.fn().mockResolvedValue(Buffer.from('xlsx')),
    generateTrainingsReport: vi.fn().mockResolvedValue(Buffer.from('xlsx')),
    generateTerminationReport: vi.fn().mockResolvedValue(Buffer.from('xlsx')),
    generateCostReport: vi.fn().mockResolvedValue(Buffer.from('xlsx')),
    generateAttendanceSummaryReport: vi.fn().mockResolvedValue(Buffer.from('xlsx'))
} }));
vi.mock('./EmailService', () => ({ EmailService: { sendMail: vi.fn() } }));
vi.mock('./StorageService', () => ({ StorageService: { saveBuffer: vi.fn().mockResolvedValue({ key: 'report.xlsx' }) } }));
vi.mock('./AuditService', () => ({ AuditService: { log: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('./LoggerService', () => ({ createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) }));

import { prisma } from '../lib/prisma';
import { reportScheduler } from './ReportScheduler';
import { ReportService } from './reports';
const globalActor = { id: 'global', role: 'admin', companyId: null };

describe('scheduled report regressions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.reportSchedule.create).mockResolvedValue({ id: 's1' } as never);
        vi.mocked(prisma.reportSchedule.update).mockResolvedValue({} as never);
    });
    it.each([
        ['TERMINATIONS', 'getMonthlyTerminations'],
        ['OBRA_SUMMARY', 'getObraSummary'],
        ['OBRA_EMPLOYEES', 'getObraEmployeeBreakdown'],
        ['PRL_MEDICAL', 'getMedicalReviewsReport'],
        ['PRL_TRAINING', 'getTrainingsReport']
    ] as const)('creates and executes %s through the correct generator', async (reportType, method) => {
        const data = { name: 'Prueba', reportType, params: JSON.stringify({ year: 2026, from: '2026-08-01', to: '2026-08-31', department: 'Taller' }), companyId: 'A', frequency: 'WEEKLY', sendEmail: false, recipients: '[]' };
        await reportScheduler.createSchedule(data, globalActor);
        vi.mocked(prisma.reportSchedule.findUnique).mockResolvedValue({ ...data, id: 's1', isActive: true } as never);
        expect((await reportScheduler.generateReport('s1', globalActor)).success).toBe(true);
        expect(ReportService[method]).toHaveBeenCalled();
        const args = vi.mocked(ReportService[method]).mock.calls[0];
        const filters = method === 'getMonthlyTerminations' ? args[2] : args[0];
        expect(filters).toMatchObject({ companyId: 'A', department: 'Taller' });
        if (method !== 'getMonthlyTerminations') expect(filters).toMatchObject({ to: new Date('2026-08-31T23:59:59.999Z') });
    });

    it('persists the selected company and period while forcing a tenant actor scope', async () => {
        await reportScheduler.createSchedule({ name: 'Prueba', reportType: 'COSTS', params: '{"year":2026,"companyId":"B","department":"Taller"}', frequency: 'MONTHLY', sendEmail: false, recipients: '[]' }, { id: 'u1', role: 'hr', companyId: 'A' });
        const data = vi.mocked(prisma.reportSchedule.create).mock.calls[0][0].data;
        expect(data.companyId).toBe('A');
        expect(JSON.parse(data.params)).toMatchObject({ year: 2026, companyId: 'A', department: 'Taller' });
    });

    it('passes explicit global authorization to scheduled costs', async () => {
        vi.mocked(prisma.reportSchedule.findUnique).mockResolvedValue({ id: 's1', reportType: 'COSTS', params: '{"year":2026}', frequency: 'MONTHLY', isActive: true, companyId: null, sendEmail: false } as never);
        expect((await reportScheduler.generateReport('s1', globalActor)).success).toBe(true);
        expect(ReportService.getCompanyCostData).toHaveBeenCalledWith(2026, undefined, expect.objectContaining({ isGlobalAdmin: true }));
    });

    it('uses the same complete attendance day as the on-screen summary', async () => {
        vi.mocked(prisma.reportSchedule.findUnique).mockResolvedValue({ id: 's1', reportType: 'ATTENDANCE_SUMMARY', params: '{"startDate":"2026-10-05","endDate":"2026-10-05","department":"Taller"}', frequency: 'WEEKLY', isActive: true, companyId: 'A', sendEmail: false } as never);
        await reportScheduler.generateReport('s1', globalActor);
        expect(ReportService.getAttendanceDailySummary).toHaveBeenCalledWith(new Date('2026-10-05'), new Date('2026-10-05T23:59:59.999Z'), expect.objectContaining({ companyId: 'A', department: 'Taller' }));
    });

    it('rejects malformed schedule parameters at creation', async () => {
        await expect(reportScheduler.createSchedule({ name: 'Prueba', reportType: 'COSTS', params: 'not-json', frequency: 'DAILY', sendEmail: false, recipients: '[]' }, globalActor)).rejects.toThrow(/inválid/i);
        expect(prisma.reportSchedule.create).not.toHaveBeenCalled();
    });
});
