import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/prisma', () => ({ prisma: { employmentPeriod: { findMany: vi.fn(), count: vi.fn() }, employee: { findMany: vi.fn() }, vacation: { findMany: vi.fn() } } }));
vi.mock('../CacheService', () => ({ CacheService: { wrap: vi.fn(async <T>(_key: string, load: () => Promise<T>) => load()) } }));
import { prisma } from '../../lib/prisma';
import { CacheService } from '../CacheService';
import { HRMetricsService } from './HRMetricsService';

function fixture<T>(value: unknown): T { return value as T; }

describe('HRMetricsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.employmentPeriod.findMany).mockReset().mockResolvedValue([]);
        vi.mocked(prisma.employmentPeriod.count).mockReset().mockResolvedValue(0);
        vi.mocked(prisma.employee.findMany).mockReset().mockResolvedValue([]);
        vi.mocked(prisma.vacation.findMany).mockReset().mockResolvedValue([]);
    });

    it('deduplicates active employees, calculates turnover and scopes every query', async () => {
        vi.mocked(prisma.employmentPeriod.findMany).mockResolvedValue(fixture([{ employeeId: 'e1' }, { employeeId: 'e1' }, { employeeId: 'e2' }]));
        vi.mocked(prisma.employmentPeriod.count).mockResolvedValueOnce(2).mockResolvedValueOnce(1);
        vi.mocked(prisma.vacation.findMany).mockResolvedValue(fixture([{ startDate: new Date(2026, 7, 3), endDate: new Date(2026, 7, 4), days: 2 }]));
        const result = await HRMetricsService.getKPIMetrics(2026, 8, { companyId: 'A' });
        expect(result).toEqual({ period: '8/2026', headcount: 2, hires: 2, exits: 1, turnoverRate: 75, absenteeismRate: 4.76, totalAbsenceDays: 2 });
        expect(prisma.employmentPeriod.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: 'A' }) }));
        expect(prisma.employmentPeriod.count).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ companyId: 'A', startDate: expect.any(Object) }) }));
        expect(prisma.employmentPeriod.count).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: expect.objectContaining({ companyId: 'A', endDate: expect.any(Object) }) }));
        expect(prisma.vacation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ employee: { companyId: 'A' }, status: 'APPROVED', type: { notIn: ['VACATION'] } }) }));
        expect(CacheService.wrap).toHaveBeenCalledWith('kpis:A:2026:8', expect.any(Function), 300);
    });

    it('counts only working absence days inside the month for requests crossing month boundaries', async () => {
        vi.mocked(prisma.employmentPeriod.findMany).mockResolvedValue(fixture([{ employeeId: 'e1' }]));
        vi.mocked(prisma.vacation.findMany).mockResolvedValue(fixture([
            { startDate: new Date(2026, 6, 29), endDate: new Date(2026, 7, 4), days: 7 },
            { startDate: new Date(2026, 7, 28), endDate: new Date(2026, 8, 2), days: 6 }
        ]));
        expect(await HRMetricsService.getKPIMetrics(2026, 8)).toMatchObject({ headcount: 1, totalAbsenceDays: 4, absenteeismRate: 19.05 });
    });

    it('handles an empty workforce without NaN and uses global cache scope', async () => {
        expect(await HRMetricsService.getKPIMetrics(2026, 2)).toEqual({ period: '2/2026', headcount: 0, hires: 0, exits: 0, turnoverRate: 0, absenteeismRate: 0, totalAbsenceDays: 0 });
        expect(CacheService.wrap).toHaveBeenCalledWith('kpis:global:2026:2', expect.any(Function), 300);
    });

    it('aggregates departmental workforce and clipped absence working days', async () => {
        vi.mocked(prisma.employee.findMany).mockResolvedValue(fixture([
            { department: 'Taller', vacations: [{ startDate: new Date(2026, 7, 3), endDate: new Date(2026, 7, 4), days: 2 }] },
            { department: 'Taller', vacations: [] },
            { department: null, vacations: [{ startDate: new Date(2026, 7, 29), endDate: new Date(2026, 8, 2), days: 5 }] }
        ]));
        expect(await HRMetricsService.getAbsenteeismByDepartment(2026, 8, { companyId: 'A' })).toEqual([
            { department: 'Taller', employees: 2, absenceDays: 2, potentialDays: 42, rate: 4.76 },
            { department: 'Sin asignar', employees: 1, absenceDays: 1, potentialDays: 21, rate: 4.76 }
        ]);
        expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: 'A' }), include: { vacations: { where: expect.objectContaining({ status: 'APPROVED', type: { notIn: ['VACATION'] } }) } } }));
    });

    it('returns an empty departmental report when nobody matches', async () => {
        expect(await HRMetricsService.getAbsenteeismByDepartment(2026, 8)).toEqual([]);
        expect(CacheService.wrap).toHaveBeenCalledWith('absenteeism:global:2026:8', expect.any(Function), 300);
    });

    it('uses each employee average payroll before computing gender and department gaps', async () => {
        vi.mocked(prisma.employee.findMany).mockResolvedValue(fixture([
            { gender: 'MALE', department: 'Taller', payrollRows: [{ bruto: '3000' }, { bruto: '1000' }] },
            { gender: 'MALE', department: 'Taller', payrollRows: [{ bruto: '4000' }] },
            { gender: 'FEMALE', department: 'Taller', payrollRows: [{ bruto: '1500' }] },
            { gender: 'FEMALE', department: null, payrollRows: [] },
            { gender: null, department: null, payrollRows: [{ bruto: '9999' }] }
        ]));
        const result = await HRMetricsService.getGenderGapData({ companyId: 'A' });
        expect(result.summary).toEqual({ maleCount: 2, femaleCount: 2, maleTotalBruto: 6000, femaleTotalBruto: 1500, maleAvgBruto: 3000, femaleAvgBruto: 750, gapPercentage: 75 });
        expect(result.rows[0]).toMatchObject({ department: 'Taller', maleCount: 2, femaleCount: 1, maleAvg: 3000, femaleAvg: 1500, gap: 50 });
        expect(result.rows[1]).toMatchObject({ department: 'Sin asignar', maleCount: 0, femaleCount: 1, maleAvg: 0, femaleAvg: 0, gap: 0 });
        expect(prisma.employee.findMany).toHaveBeenCalledWith({ where: { companyId: 'A' }, include: { payrollRows: { where: { status: 'OK' }, orderBy: { batch: { createdAt: 'desc' } }, take: 12 } } });
    });

    it('handles absent genders and no payroll records without division by zero', async () => {
        const result = await HRMetricsService.getGenderGapData();
        expect(result.rows).toEqual([]);
        expect(result.summary).toMatchObject({ maleAvgBruto: 0, femaleAvgBruto: 0, gapPercentage: 0 });
        vi.mocked(prisma.employee.findMany).mockRejectedValueOnce(new Error('Payroll read failure'));
        await expect(HRMetricsService.getGenderGapData()).rejects.toThrow('Payroll read failure');
    });

    it('filters equality payroll by the selected year and department without a twelve-record cap', async () => {
        await HRMetricsService.getGenderGapData({ year: 2025, department: 'Taller', companyId: 'A' });
        expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: 'A', department: 'Taller' }, include: { payrollRows: { where: { status: 'OK', batch: { year: 2025 } }, orderBy: { batch: { createdAt: 'desc' } } } } }));
    });

    it('supports a full year and separates department KPI cache keys', async () => {
        expect(await HRMetricsService.getKPIMetrics(2026, undefined, { companyId: 'A', department: 'Taller' })).toMatchObject({ period: 'Año 2026' });
        expect(prisma.employmentPeriod.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: 'A', employee: { department: 'Taller' }, startDate: { lte: new Date(2026, 11, 31, 23, 59, 59, 999) } }) }));
        expect(CacheService.wrap).toHaveBeenCalledWith('kpis:A:2026:0:"Taller"', expect.any(Function), 300);
    });
});
