import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cache = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../lib/prisma', () => ({ prisma: { timeEntry: { count: vi.fn(), findMany: vi.fn() }, employee: { count: vi.fn(), findMany: vi.fn() } } }));
vi.mock('../CacheService', () => ({ CacheService: { wrap: vi.fn(async <T>(key: string, load: () => Promise<T>) => {
    if (cache.has(key)) return cache.get(key) as T;
    const value = await load();
    cache.set(key, value);
    return value;
}) } }));

import { prisma } from '../../lib/prisma';
import { CacheService } from '../CacheService';
import { EncryptionService } from '../EncryptionService';
import { AttendanceReportService } from './AttendanceReportService';

const start = new Date('2026-08-01T00:00:00Z');
const end = new Date('2026-08-31T23:59:59Z');
const page = { page: 2, limit: 1, skip: 1, isPaginationRequested: true };
function fixture<T>(value: unknown): T { return value as T; }
function entry(employeeId: string, day: number, hour: number, type: string, employee: object = {}) {
    return { employeeId, timestamp: new Date(Date.UTC(2026, 7, day, hour)), type, employee };
}

describe('AttendanceReportService: filtering, summaries and cache isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.timeEntry.findMany).mockReset();
        vi.mocked(prisma.employee.findMany).mockReset();
        cache.clear();
        vi.mocked(prisma.timeEntry.count).mockResolvedValue(3);
        vi.mocked(prisma.employee.count).mockResolvedValue(3);
        vi.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([]);
    });
    afterEach(() => vi.useRealTimers());

    it('applies date, tenant, department and pagination to raw data and count queries', async () => {
        vi.mocked(prisma.timeEntry.findMany).mockResolvedValue(fixture([{ id: 'entry2' }]));
        const result = await AttendanceReportService.getAttendanceData(start, end, { companyId: 'A', department: 'Taller' }, page);
        expect(result).toEqual({ data: [{ id: 'entry2' }], total: 3 });
        const where = { timestamp: { gte: start, lte: end }, employee: { companyId: 'A', department: 'Taller' } };
        expect(prisma.timeEntry.count).toHaveBeenCalledWith({ where });
        expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 1, take: 1, orderBy: [{ timestamp: 'asc' }] }));
        expect(CacheService.wrap).toHaveBeenCalledWith(expect.any(String), expect.any(Function), 60);
    });

    it('never reuses cached rows across pages, departments or different times on the same date', async () => {
        vi.mocked(prisma.timeEntry.findMany)
            .mockResolvedValueOnce(fixture([{ id: 'first' }]))
            .mockResolvedValueOnce(fixture([{ id: 'second' }]))
            .mockResolvedValueOnce(fixture([{ id: 'other-department' }]))
            .mockResolvedValueOnce(fixture([{ id: 'later' }]));
        const firstPage = { ...page, page: 1, skip: 0 };
        const first = await AttendanceReportService.getAttendanceData(start, end, { companyId: 'A', department: 'Taller' }, firstPage);
        const second = await AttendanceReportService.getAttendanceData(start, end, { companyId: 'A', department: 'Taller' }, page);
        const department = await AttendanceReportService.getAttendanceData(start, end, { companyId: 'A', department: 'Oficina' }, firstPage);
        const later = await AttendanceReportService.getAttendanceData(new Date('2026-08-01T12:00:00Z'), end, { companyId: 'A', department: 'Taller' }, firstPage);
        expect([first.data, second.data, department.data, later.data]).toEqual([[{ id: 'first' }], [{ id: 'second' }], [{ id: 'other-department' }], [{ id: 'later' }]]);
        expect(prisma.timeEntry.findMany).toHaveBeenCalledTimes(4);
        expect(await AttendanceReportService.getAttendanceData(start, end, { companyId: 'A', department: 'Taller' }, firstPage)).toEqual(first);
        expect(prisma.timeEntry.findMany).toHaveBeenCalledTimes(4);
    });

    it('reads full raw exports without cache and propagates database errors', async () => {
        await AttendanceReportService.getAttendanceData(start, end);
        expect(CacheService.wrap).not.toHaveBeenCalled();
        expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ skip: expect.anything(), take: expect.anything() }));
        vi.mocked(prisma.timeEntry.findMany).mockRejectedValueOnce(new Error('Database unavailable'));
        await expect(AttendanceReportService.getAttendanceData(start, end, { department: 'Taller' })).rejects.toThrow('Database unavailable');
    });

    it('pairs work, break and lunch events and keeps isolated employee totals', async () => {
        const employees = [
            { id: 'e1', name: 'Legacy', firstName: 'Ana', lastName: 'Pérez', dni: EncryptionService.encrypt('12345678Z'), department: 'Taller' },
            { id: 'e2', name: null, firstName: null, lastName: null, dni: null, department: null },
            { id: 'e3', name: 'Sin fichajes', dni: 'plain', department: null }
        ];
        vi.mocked(prisma.employee.findMany).mockResolvedValue(fixture(employees));
        vi.mocked(prisma.timeEntry.findMany).mockResolvedValue(fixture([
            entry('e1', 3, 8, 'IN'), entry('e1', 3, 10, 'BREAK_START'), entry('e1', 3, 11, 'BREAK_END'),
            entry('e1', 3, 13, 'LUNCH_START'), entry('e1', 3, 14, 'LUNCH_END'), entry('e1', 3, 16, 'OUT'),
            entry('e1', 4, 8, 'IN'), entry('e1', 4, 9, 'OUT'), entry('e2', 3, 8, 'OUT'), entry('e2', 3, 9, 'IN')
        ]));
        const result = await AttendanceReportService.getAttendanceByEmployee(start, end, { companyId: 'A', department: 'Taller' });
        expect(result.total).toBe(3);
        expect(result.data[0]).toMatchObject({ employeeId: 'e1', employeeName: 'Ana Pérez', employeeDni: '12345678Z', totalHours: 7, daysWorked: 2, totalEntries: 8 });
        expect(result.data[1]).toMatchObject({ employeeId: 'e2', employeeName: 'Empleado', employeeDni: null, totalHours: 0, daysWorked: 1 });
        expect(result.data[2]).toMatchObject({ totalHours: 0, daysWorked: 0, totalEntries: 0, firstEntry: null, lastEntry: null });
        expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: 'A', department: 'Taller' }) }));
        expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { employeeId: { in: ['e1', 'e2', 'e3'] }, timestamp: { gte: start, lte: end } } }));
    });

    it('paginates employee summaries while reporting the full matching employee count', async () => {
        vi.mocked(prisma.employee.findMany).mockResolvedValue(fixture([{ id: 'e2', name: 'Luis', dni: null }]));
        const result = await AttendanceReportService.getAttendanceByEmployee(start, end, {}, page);
        expect(result.data).toHaveLength(1);
        expect(result.total).toBe(3);
        expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 1, take: 1 }));
        expect(prisma.employee.count).toHaveBeenCalled();
    });

    it('marks unmatched historical events incomplete and treats an active current shift separately', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-04T14:00:00Z'));
        const employee = { id: 'e1', firstName: 'Ana', lastName: 'Pérez', name: 'Legacy', dni: 'cipher', department: 'Taller' };
        vi.mocked(prisma.timeEntry.findMany).mockResolvedValue(fixture([
            entry('e1', 3, 8, 'OUT', employee), entry('e1', 3, 9, 'IN', employee), entry('e1', 3, 10, 'BREAK_START', employee),
            entry('e1', 3, 11, 'BREAK_END', employee), entry('e1', 3, 12, 'LUNCH_START', employee), entry('e1', 3, 13, 'LUNCH_END', employee),
            entry('e1', 4, 8, 'IN', employee), entry('e2', 3, 8, 'IN', { name: null }), entry('e2', 3, 12, 'OUT', { name: null })
        ]));
        const result = await AttendanceReportService.getAttendanceDailySummary(start, end, { companyId: 'A', employeeId: 'e1' });
        expect(result[0]).toMatchObject({ employeeName: 'Ana Pérez', employeeDni: 'cipher', department: 'Taller', date: '2026-08-03', totalHours: 2, status: 'INCOMPLETE' });
        expect(result[0].segments.map((segment: { type: string }) => segment.type)).toEqual(['BREAK', 'LUNCH', 'ACTIVE']);
        expect(result[1]).toMatchObject({ totalHours: 0, status: 'COMPLETE', date: '2026-08-04', segments: [{ start: new Date('2026-08-04T08:00:00Z'), end: null, type: 'ACTIVE' }] });
        expect(result[2]).toMatchObject({ employeeName: 'Empleado', totalHours: 4, department: null });
        expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { timestamp: { gte: start, lte: end }, employeeId: 'e1', employee: { companyId: 'A' } } }));
    });

    it('paginates consolidated daily rows without cutting IN/OUT pairs', async () => {
        const employee = { name: 'Ana' };
        vi.mocked(prisma.timeEntry.findMany).mockResolvedValue(fixture([
            entry('e1', 3, 8, 'IN', employee), entry('e1', 3, 16, 'OUT', employee),
            entry('e1', 4, 8, 'IN', employee), entry('e1', 4, 16, 'OUT', employee)
        ]));
        const result = await AttendanceReportService.getAttendanceDailySummary(start, end, {}, page);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ date: '2026-08-04', totalHours: 8, status: 'COMPLETE' });
        expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ skip: expect.anything() }));
    });

    it('returns empty grouped reports for empty data', async () => {
        expect(await AttendanceReportService.getAttendanceByEmployee(start, end)).toEqual({ data: [], total: 0 });
        expect(await AttendanceReportService.getAttendanceDailySummary(start, end)).toEqual([]);
    });
});
