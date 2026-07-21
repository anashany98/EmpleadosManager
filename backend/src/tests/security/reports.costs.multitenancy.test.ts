// CRIT-001: CostReportService ignora el filtro de empresa y devuelve
// nóminas, DNI descifrado y costes de cualquier tenant.
//
// Antes del fix, el servicio solo usaba `companyId` para la clave
// de caché, pero el `where` de Prisma sobre `payrollImportBatch`
// no incluía la empresa. Cualquier admin/HR con permisos de
// informes podía ver agregados de otro tenant filtrando por año/mes.
//
// Tras el fix:
//   - El `where` sobre `payrollImportBatch` exige
//     `createdBy.employee.companyId` para usuarios no globales.
//   - La cache key para admin global se diferencia de las de tenant.
//   - Hay un post-filter defensivo: aunque el `where` traiga datos
//     de otro tenant por inconsistencia, se descartan antes de
//     descifrar el DNI.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/prisma', () => ({
    prisma: {
        payrollImportBatch: { findMany: vi.fn() },
        payrollRow: { groupBy: vi.fn() },
        employee: { findMany: vi.fn() }
    }
}));

vi.mock('../../services/CacheService', () => ({
    CacheService: {
        wrap: vi.fn(async (_key, fn) => fn()),
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn()
    }
}));

vi.mock('../../services/EncryptionService', () => ({
    EncryptionService: {
        decrypt: vi.fn((val) => (val ? `decrypted_${val}` : null))
    }
}));

vi.mock('../../utils/cacheKeys', () => ({
    CacheKeys: {
        costs: (companyId: string, year: number, month?: number) =>
            `costs:${companyId}:${year}:${month ?? 'all'}`
    }
}));

import { prisma } from '../../lib/prisma';
import { CostReportService } from '../../services/reports/CostReportService';

const mocked = prisma as unknown as {
    payrollImportBatch: { findMany: ReturnType<typeof vi.fn> };
    payrollRow: { groupBy: ReturnType<typeof vi.fn> };
    employee: { findMany: ReturnType<typeof vi.fn> };
};

const ACTOR_A = { id: 'u-A', role: 'admin', companyId: 'company-A' };
const GLOBAL_ADMIN = { id: 'u-G', role: 'admin', companyId: null };

describe('CRIT-001 — CostReportService tenant isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('filtra payrollImportBatch por companyId del actor (vía createdBy.employee.companyId)', async () => {
        mocked.payrollImportBatch.findMany.mockResolvedValue([
            { id: 'batch-A1' }
        ]);
        mocked.payrollRow.groupBy.mockResolvedValue([]);
        mocked.employee.findMany.mockResolvedValue([]);

        await CostReportService.getCompanyCostData(2026, 3, { companyId: ACTOR_A.companyId });

        expect(mocked.payrollImportBatch.findMany).toHaveBeenCalledTimes(1);
        const arg = mocked.payrollImportBatch.findMany.mock.calls[0][0];
        expect(arg.where).toMatchObject({
            year: 2026,
            month: 3,
            createdBy: { employee: { companyId: 'company-A' } }
        });
    });

    it('la cache key de un admin de empresa no coincide con la del admin global', async () => {
        const { CacheService } = await import('../../services/CacheService');
        mocked.payrollImportBatch.findMany.mockResolvedValue([]);
        mocked.payrollRow.groupBy.mockResolvedValue([]);
        mocked.employee.findMany.mockResolvedValue([]);

        await CostReportService.getCompanyCostData(2026, undefined, { companyId: 'company-A' });
        await CostReportService.getCompanyCostData(2026, undefined, { companyId: null, isGlobalAdmin: true });

        const calls = (CacheService.wrap as any).mock.calls;
        const keyA = calls[0][0];
        const keyGlobal = calls[1][0];
        expect(keyA).toBe('costs:company-A:2026:all');
        expect(keyGlobal).toBe('costs:__global__:2026:all');
        expect(keyA).not.toBe(keyGlobal);
    });

    it('descarta agregados de empleados que no pertenecen al tenant aunque el where se cuele', async () => {
        // Simulamos un `where` mal escrito que devuelve agregados de OTRO tenant
        mocked.payrollImportBatch.findMany.mockResolvedValue([
            { id: 'batch-shared' }
        ]);
        mocked.payrollRow.groupBy.mockResolvedValue([
            { employeeId: 'emp-A', _sum: { bruto: 1000, ssEmpresa: 200, ssTrabajador: 50, irpf: 100, neto: 850 } },
            { employeeId: 'emp-B', _sum: { bruto: 9999, ssEmpresa: 999, ssTrabajador: 99, irpf: 999, neto: 8901 } }
        ]);
        mocked.employee.findMany.mockResolvedValue([
            { id: 'emp-A', name: 'Alice', dni: 'dni-A-encrypted', department: 'Eng', companyId: 'company-A' },
            { id: 'emp-B', name: 'Bob',   dni: 'dni-B-encrypted', department: 'Ops', companyId: 'company-B' }
        ]);

        const result = await CostReportService.getCompanyCostData(2026, 3, { companyId: 'company-A' });

        // Solo Alice (de company-A) debe aparecer. Bob se filtra post-where.
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Alice');
        expect(result[0].dni).toBe('decrypted_dni-A-encrypted');
        // El DNI de Bob NO se descifra (no aparece en el output)
        const { EncryptionService } = await import('../../services/EncryptionService');
        const decryptCalls = (EncryptionService.decrypt as any).mock.calls;
        decryptCalls.forEach((call: any[]) => {
            expect(call[0]).not.toBe('dni-B-encrypted');
        });
    });

    it('un admin global ve empleados de todos los tenants sin filtrar', async () => {
        mocked.payrollImportBatch.findMany.mockResolvedValue([
            { id: 'batch-shared' }
        ]);
        mocked.payrollRow.groupBy.mockResolvedValue([
            { employeeId: 'emp-A', _sum: { bruto: 1000, ssEmpresa: 200, ssTrabajador: 50, irpf: 100, neto: 850 } },
            { employeeId: 'emp-B', _sum: { bruto: 9999, ssEmpresa: 999, ssTrabajador: 99, irpf: 999, neto: 8901 } }
        ]);
        mocked.employee.findMany.mockResolvedValue([
            { id: 'emp-A', name: 'Alice', dni: 'dni-A-encrypted', department: 'Eng', companyId: 'company-A' },
            { id: 'emp-B', name: 'Bob',   dni: 'dni-B-encrypted', department: 'Ops', companyId: 'company-B' }
        ]);

        const result = await CostReportService.getCompanyCostData(2026, 3, {
            companyId: GLOBAL_ADMIN.companyId,
            isGlobalAdmin: true
        });

        expect(result).toHaveLength(2);
        // El where del admin global no debe filtrar por companyId
        const arg = mocked.payrollImportBatch.findMany.mock.calls[0][0];
        expect(arg.where.createdBy).toBeUndefined();
    });

    it('devuelve [] si no hay batches del tenant en el periodo', async () => {
        mocked.payrollImportBatch.findMany.mockResolvedValue([]);
        const result = await CostReportService.getCompanyCostData(2026, 3, { companyId: 'company-A' });
        expect(result).toEqual([]);
        expect(mocked.payrollRow.groupBy).not.toHaveBeenCalled();
    });

    it('un usuario no global sin companyId recibe [] (safeguard) sin tocar Prisma', async () => {
        const result = await CostReportService.getCompanyCostData(2026, 3, { companyId: null });
        expect(result).toEqual([]);
        expect(mocked.payrollImportBatch.findMany).not.toHaveBeenCalled();
        expect(mocked.payrollRow.groupBy).not.toHaveBeenCalled();
    });
});
