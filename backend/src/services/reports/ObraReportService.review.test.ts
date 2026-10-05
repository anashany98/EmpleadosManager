import { beforeEach, describe, expect, it, vi } from 'vitest';
const cache = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../lib/prisma', () => ({ prisma: {
    project: { findMany: vi.fn() }, obraExpense: { groupBy: vi.fn(), findMany: vi.fn() }, employeeProjectWork: { groupBy: vi.fn(), findMany: vi.fn() }
} }));
vi.mock('../CacheService', () => ({ CacheService: { wrap: vi.fn(async <T>(key: string, load: () => Promise<T>) => {
    if (cache.has(key)) return cache.get(key) as T;
    const value = await load(); cache.set(key, value); return value;
}) } }));
import { prisma } from '../../lib/prisma';
import { CacheService } from '../CacheService';
import { ObraReportService } from './ObraReportService';
import { ExcelService } from '../ExcelService';
import * as ExcelJS from 'exceljs';

function fixture<T>(value: unknown): T { return value as T; }
const from = new Date('2026-08-01T00:00:00Z');
const to = new Date('2026-08-31T23:59:59Z');

describe('ObraReportService', () => {
    beforeEach(() => {
        vi.clearAllMocks(); cache.clear();
        vi.mocked(prisma.project.findMany).mockReset().mockResolvedValue([]);
        vi.mocked(prisma.obraExpense.groupBy).mockReset().mockResolvedValue([]);
        vi.mocked(prisma.obraExpense.findMany).mockReset().mockResolvedValue([]);
        vi.mocked(prisma.employeeProjectWork.groupBy).mockReset().mockResolvedValue([]);
        vi.mocked(prisma.employeeProjectWork.findMany).mockReset().mockResolvedValue([]);
    });

    it('fails closed for an actor without a company or explicit global access', async () => {
        expect(await ObraReportService.getObraSummary()).toEqual({ obras: [], totalsByType: {}, horasTotales: 0, totalEmpleados: 0, budgets: { budget: 0, consumed: 0 } });
        expect(await ObraReportService.getObraEmployeeBreakdown()).toEqual([]);
        expect(prisma.project.findMany).not.toHaveBeenCalled();
        expect(prisma.obraExpense.findMany).not.toHaveBeenCalled();
        expect(CacheService.wrap).not.toHaveBeenCalled();
    });

    it('aggregates expenses, deduplicates employees and reconciles per-project totals and budgets', async () => {
        vi.mocked(prisma.project.findMany).mockResolvedValue(fixture([{ id: 'o1', code: 'O1', name: 'Obra A', budget: '1000', status: 'ACTIVE' }, { id: 'o2', code: 'O2', name: 'Obra B', budget: null, status: 'INACTIVE' }]));
        vi.mocked(prisma.obraExpense.groupBy).mockResolvedValue(fixture([
            { obraId: 'o1', type: 'PER_DIEM', _sum: { amount: '100.25' } }, { obraId: 'o1', type: 'TRANSPORT', _sum: { amount: '50.75' } },
            { obraId: 'o2', type: 'PER_DIEM', _sum: { amount: null } }
        ]));
        vi.mocked(prisma.employeeProjectWork.groupBy).mockResolvedValue(fixture([{ projectId: 'o1', _sum: { hours: 12.5 } }, { projectId: 'o2', _sum: { hours: null } }]));
        vi.mocked(prisma.employeeProjectWork.findMany).mockResolvedValue(fixture([{ projectId: 'o1', employeeId: 'e1' }, { projectId: 'o1', employeeId: 'e1' }, { projectId: 'o1', employeeId: 'e2' }, { projectId: 'o2', employeeId: 'e1' }]));
        const result = await ObraReportService.getObraSummary({ from, to, status: 'ACTIVE', isGlobalAdmin: true });
        expect(result).toMatchObject({ totalsByType: { PER_DIEM: 100.25, TRANSPORT: 50.75 }, horasTotales: 12.5, totalEmpleados: 2, budgets: { budget: 1000, consumed: 151 } });
        expect(result.obras[0]).toMatchObject({ hours: 12.5, empleadosCount: 2, consumed: 151, totals: { PER_DIEM: 100.25, TRANSPORT: 50.75 } });
        expect(result.obras[1]).toMatchObject({ hours: 0, empleadosCount: 1, consumed: 0 });
        expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'ACTIVE' } }));
        expect(prisma.obraExpense.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { obraId: { in: ['o1', 'o2'] }, date: { gte: from, lte: to } } }));
        expect(prisma.employeeProjectWork.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: { in: ['o1', 'o2'] }, AND: [{ endDate: { gte: from } }, { startDate: { lte: to } }] } }));
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await ExcelService.generateObraSummaryReport(result));
        expect(workbook.getWorksheet('Detalle por obra')!.getCell('E11').value).toBe(100.25);
        expect(workbook.getWorksheet('Detalle por obra')!.getCell('M11').value).toBe(0.151);
    });

    it('restricts project visibility and all aggregate queries to company relationships', async () => {
        vi.mocked(prisma.project.findMany).mockResolvedValue(fixture([{ id: 'o1', manager: { id: 'foreign-manager', name: 'Private name', companyId: 'B' } }]));
        const result = await ObraReportService.getObraSummary({ companyId: 'A', from });
        expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: expect.arrayContaining([
            { manager: { companyId: 'A' } }, { employeeWork: { some: { employee: { companyId: 'A' } } } }
        ]) }) }));
        expect(prisma.obraExpense.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: expect.arrayContaining([{ employee: { companyId: 'A' } }]) }) }));
        expect(prisma.employeeProjectWork.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ employee: { companyId: 'A' } }) }));
        expect(prisma.employeeProjectWork.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ employee: { companyId: 'A' } }) }));
        expect(result.obras[0].manager).toBeNull();
    });

    it('isolates tenant cache and honours explicit company selection by a global administrator', async () => {
        vi.mocked(prisma.project.findMany).mockResolvedValueOnce(fixture([{ id: 'a' }])).mockResolvedValueOnce(fixture([{ id: 'b' }])).mockResolvedValueOnce(fixture([{ id: 'global' }]));
        const a = await ObraReportService.getObraSummary({ companyId: 'A' });
        const b = await ObraReportService.getObraSummary({ companyId: 'B' });
        const global = await ObraReportService.getObraSummary({ isGlobalAdmin: true });
        expect([a.obras[0].id, b.obras[0].id, global.obras[0].id]).toEqual(['a', 'b', 'global']);
        expect(await ObraReportService.getObraSummary({ companyId: 'A', isGlobalAdmin: true })).toEqual(a);
        expect(prisma.project.findMany).toHaveBeenCalledTimes(3);
    });

    it('handles empty projects without issuing aggregate queries and propagates failures', async () => {
        expect(await ObraReportService.getObraSummary({ isGlobalAdmin: true, status: 'INVALID', to })).toEqual({ obras: [], totalsByType: {}, horasTotales: 0, totalEmpleados: 0, budgets: { budget: 0, consumed: 0 } });
        expect(prisma.obraExpense.groupBy).not.toHaveBeenCalled();
        expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
        vi.mocked(prisma.project.findMany).mockRejectedValueOnce(new Error('DB unavailable'));
        await expect(ObraReportService.getObraSummary({ companyId: 'A' })).rejects.toThrow('DB unavailable');
    });

    it('merges matching employee/project hours and expenses, retaining contractor and missing-data rows', async () => {
        vi.mocked(prisma.obraExpense.findMany).mockResolvedValue(fixture([
            { employeeId: 'e1', obraId: 'o1', employee: { name: 'Ana' }, obra: { name: 'Obra A', code: 'O1' }, type: 'PER_DIEM', amount: '20.5' },
            { employeeId: 'e1', obraId: 'o1', employee: { firstName: 'Ana', lastName: 'Pérez' }, obra: { name: 'Obra A', code: 'O1' }, type: 'PER_DIEM', amount: '10' },
            { employeeId: null, contractorId: 'c1', obraId: 'o1', contractor: { name: 'Autónomo' }, type: 'CONTRACTOR', amount: 100 },
            { employeeId: null, contractorId: null, obraId: 'o2', type: 'OTHER', amount: null }
        ]));
        vi.mocked(prisma.employeeProjectWork.findMany).mockResolvedValue(fixture([
            { employeeId: 'e1', projectId: 'o1', employee: { firstName: 'Ana', lastName: 'Pérez' }, project: { name: 'Obra A', code: 'O1' }, hours: 8 },
            { employeeId: 'e1', projectId: 'o1', hours: 2 }, { employeeId: 'e2', projectId: 'o1', employee: { name: 'Luis' }, project: { name: 'Obra A', code: 'O1' }, hours: 3 },
            { employeeId: 'e3', projectId: 'o3', hours: null }
        ]));
        const result = await ObraReportService.getObraEmployeeBreakdown({ isGlobalAdmin: true, from, to });
        expect(result[0]).toMatchObject({ employee: 'Ana', obra: 'Obra A', hours: 10, total: 30.5, byType: { PER_DIEM: 30.5 } });
        expect(result[1]).toMatchObject({ employee: 'Autónomo', obra: 'Obra eliminada', total: 100, byType: { CONTRACTOR: 100 } });
        expect(result.find((row) => row.employee === 'Luis')).toMatchObject({ total: 0, hours: 3 });
        expect(result.filter((row) => row.employee === 'Sin empleado')).toHaveLength(2);
        expect(prisma.obraExpense.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { date: { gte: from, lte: to } } }));
    });

    it('scopes employee breakdown and caches independently by company and date bounds', async () => {
        await ObraReportService.getObraEmployeeBreakdown({ companyId: 'A', from });
        await ObraReportService.getObraEmployeeBreakdown({ companyId: 'B', to });
        expect(prisma.obraExpense.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ date: { gte: from }, OR: expect.arrayContaining([{ employee: { companyId: 'A' } }]) }) }));
        expect(prisma.employeeProjectWork.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ employee: { companyId: 'A' }, AND: [{ endDate: { gte: from } }] }) }));
        expect(prisma.employeeProjectWork.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: expect.objectContaining({ employee: { companyId: 'B' }, AND: [{ startDate: { lte: to } }] }) }));
        expect(prisma.obraExpense.findMany).toHaveBeenCalledTimes(2);
    });
});
