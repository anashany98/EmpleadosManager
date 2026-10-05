import { beforeEach, describe, expect, it, vi } from 'vitest';
const cache = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../lib/prisma', () => ({ prisma: {
    employee: { count: vi.fn(), findMany: vi.fn() }, employeeVacationBalance: { findMany: vi.fn() }, vacation: { count: vi.fn(), findMany: vi.fn() }
} }));
vi.mock('../CacheService', () => ({ CacheService: { wrap: vi.fn(async <T>(key: string, load: () => Promise<T>) => {
    if (cache.has(key)) return cache.get(key) as T;
    const value = await load(); cache.set(key, value); return value;
}) } }));
import { prisma } from '../../lib/prisma';
import { CacheService } from '../CacheService';
import { VacationReportService } from './VacationReportService';

function fixture<T>(value: unknown): T { return value as T; }
const start = new Date(2026, 7, 1);
const end = new Date(2026, 7, 31, 23, 59, 59);
const page = { page: 2, limit: 10, skip: 10, isPaginationRequested: true };
function absence(id: string, type: string, days: number | null, status = 'APPROVED', department: string | null = 'Taller', employeeId = 'e1') {
    return { id, type, days, status, startDate: start, endDate: end, employee: { id: employeeId, name: employeeId, department } };
}

describe('VacationReportService', () => {
    beforeEach(() => {
        vi.clearAllMocks(); cache.clear();
        vi.mocked(prisma.employee.findMany).mockReset().mockResolvedValue([]);
        vi.mocked(prisma.employee.count).mockReset().mockResolvedValue(2);
        vi.mocked(prisma.employeeVacationBalance.findMany).mockReset().mockResolvedValue([]);
        vi.mocked(prisma.vacation.count).mockReset().mockResolvedValue(2);
        vi.mocked(prisma.vacation.findMany).mockReset().mockResolvedValue([]);
    });

    it('calculates explicit and legacy quota balances, clips cross-year requests and excludes rejected requests', async () => {
        vi.mocked(prisma.employee.findMany).mockResolvedValue(fixture([
            { id: 'e1', name: 'Ana', department: 'Taller', vacationDaysTotal: 20, vacations: [
                { type: 'VACATION', status: 'APPROVED', startDate: new Date(2025, 11, 30), endDate: new Date(2026, 0, 3) },
                { type: 'VACATION', status: 'PENDING', startDate: new Date(2026, 11, 30), endDate: new Date(2027, 0, 2) },
                { type: 'VACATION', status: 'REJECTED', startDate: start, endDate: end }
            ] },
            { id: 'e2', name: 'Luis', department: null, vacationDaysTotal: null, vacations: [] },
            { id: 'e3', name: 'Eva', department: null, vacationDaysTotal: 22, vacations: [] }
        ]));
        vi.mocked(prisma.employeeVacationBalance.findMany).mockResolvedValue(fixture([{ employeeId: 'e1', annualQuotaDays: '25.5', carriedOverDays: '2.5', importedUsedDays: '1.25', advancedDays: '2' }]));
        const result = await VacationReportService.getVacationData(2026, { companyId: 'A', department: 'Taller' });
        expect(result.data[0]).toMatchObject({ annualQuotaDays: 25.5, carriedOverDays: 2.5, importedUsedDays: 1.25, approvedUsedDays: 3, pendingDays: 2, totalQuota: 28, usedDays: 4.25, remainingDays: 23.75, projectedRemainingDays: 23.75, requests: 3 });
        expect(result.data[1]).toMatchObject({ annualQuotaDays: 30, totalQuota: 30, remainingDays: 30, usedDays: 0 });
        expect(result.data[2].annualQuotaDays).toBe(22);
        expect(prisma.employeeVacationBalance.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { year: 2026, employee: { companyId: 'A', department: 'Taller' } } }));
        expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: 'A', department: 'Taller' }, include: { vacations: expect.objectContaining({ where: expect.objectContaining({ type: 'VACATION' }) }) } }));
    });

    it('isolates aggregated cache by department, company and year', async () => {
        vi.mocked(prisma.employee.findMany).mockResolvedValueOnce(fixture([{ id: 'e1', name: 'Ana', vacations: [] }])).mockResolvedValueOnce(fixture([{ id: 'e2', name: 'Luis', vacations: [] }])).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
        const a = await VacationReportService.getVacationData(2026, { companyId: 'A', department: 'Taller' });
        const b = await VacationReportService.getVacationData(2026, { companyId: 'A', department: 'Oficina' });
        await VacationReportService.getVacationData(2026, { companyId: 'B' });
        await VacationReportService.getVacationData(2027);
        expect(a.data[0].id).toBe('e1');
        expect(b.data[0].id).toBe('e2');
        expect(prisma.employee.findMany).toHaveBeenCalledTimes(4);
        expect(await VacationReportService.getVacationData(2026, { companyId: 'A', department: 'Taller' })).toEqual(a);
        expect(prisma.employee.findMany).toHaveBeenCalledTimes(4);
    });

    it('passes pagination to employee queries without caching pages', async () => {
        expect(await VacationReportService.getVacationData(2026, {}, page)).toEqual({ data: [], total: 2 });
        expect(CacheService.wrap).not.toHaveBeenCalled();
        expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
        vi.mocked(prisma.employeeVacationBalance.findMany).mockRejectedValueOnce(new Error('Balance database failure'));
        await expect(VacationReportService.getVacationData(2026, {}, page)).rejects.toThrow('Balance database failure');
    });

    it('queries detailed non-vacation absences with inclusive overlap, tenant and department', async () => {
        vi.mocked(prisma.vacation.findMany).mockResolvedValue(fixture([absence('v1', 'SICK', 2)]));
        const result = await VacationReportService.getDetailedAbsenceData(start, end, { companyId: 'A', department: 'Taller' }, page);
        const where = { startDate: { lte: end }, endDate: { gte: start }, type: { not: 'VACATION' }, employee: { companyId: 'A', department: 'Taller' } };
        expect(result).toMatchObject({ total: 2, data: [{ id: 'v1', type: 'SICK' }] });
        expect(prisma.vacation.count).toHaveBeenCalledWith({ where });
        expect(prisma.vacation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 10, take: 10, orderBy: { startDate: 'desc' } }));
        await VacationReportService.getDetailedAbsenceData(start, end);
    });

    it('classifies canonical SICK absences separately from vacation and other leave', async () => {
        vi.mocked(prisma.vacation.findMany).mockResolvedValue(fixture([
            absence('v1', 'VACATION', 3), absence('v2', 'SICK', 2), absence('v3', 'MEDICAL_APPOINTMENT', 1),
            absence('v4', 'OTHER', null, 'APPROVED', null, 'e2')
        ]));
        const result = await VacationReportService.getAbsencesByDepartment(start, end, { companyId: 'A' });
        expect(result[0]).toMatchObject({ department: 'Taller', totalAbsences: 3, totalDays: 6, employeeCount: 1, avgDaysPerAbsence: 2, vacationDays: 3, sickDays: 2, otherDays: 1 });
        expect(result[0].absences).toHaveLength(3);
        expect(result[1]).toMatchObject({ department: 'Sin asignar', totalAbsences: 1, totalDays: 0, employeeCount: 1 });
        expect(prisma.vacation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { startDate: { lte: end }, endDate: { gte: start }, employee: { companyId: 'A' } } }));
    });

    it('aggregates approved/rejected/pending request days and distinct employees', async () => {
        vi.mocked(prisma.vacation.findMany).mockResolvedValue(fixture([
            absence('v1', 'VACATION', 3, 'APPROVED'), absence('v2', 'VACATION', 2, 'REJECTED'), absence('v3', 'VACATION', 1, 'PENDING'),
            absence('v4', 'VACATION', null, 'APPROVED', null, 'e2')
        ]));
        const result = await VacationReportService.getUsageByDepartment(2026, { companyId: 'A' });
        expect(result[0]).toMatchObject({ department: 'Taller', totalRequestedDays: 6, totalApprovedDays: 3, totalRejectedDays: 2, approvedCount: 1, rejectedCount: 1, pendingCount: 1, employeeCount: 1, avgDaysPerEmployee: 6 });
        expect(result[1]).toMatchObject({ totalRequestedDays: 0, totalApprovedDays: 0, employeeCount: 1 });
    });

    it('returns empty aggregate arrays for empty absence data', async () => {
        expect(await VacationReportService.getAbsencesByDepartment(start, end)).toEqual([]);
        expect(await VacationReportService.getUsageByDepartment(2026)).toEqual([]);
    });
});
