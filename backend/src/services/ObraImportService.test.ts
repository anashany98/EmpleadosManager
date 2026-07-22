import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObraImportService } from './ObraImportService';

vi.mock('../lib/prisma', () => ({
    prisma: {
        project: {
            findMany: vi.fn(),
        },
        employee: {
            findMany: vi.fn(),
        },
    },
}));

import { prisma } from '../lib/prisma';

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ObraImportService.parseExcelDate', () => {
    it('returns null for null/undefined/empty', () => {
        expect(ObraImportService.parseExcelDate(null)).toBeNull();
        expect(ObraImportService.parseExcelDate(undefined)).toBeNull();
        expect(ObraImportService.parseExcelDate('')).toBeNull();
    });

    it('parses Date objects', () => {
        const d = new Date('2026-03-15');
        expect(ObraImportService.parseExcelDate(d)?.toISOString()).toBe(d.toISOString());
    });

    it('returns null for invalid Date', () => {
        expect(ObraImportService.parseExcelDate(new Date('invalid'))).toBeNull();
    });

    it('parses Excel serial date numbers', () => {
        // Excel serial 46023 = 2026-01-01
        const result = ObraImportService.parseExcelDate(46023);
        expect(result).not.toBeNull();
        expect(result!.getFullYear()).toBe(2026);
        expect(result!.getMonth()).toBe(0); // January
        expect(result!.getDate()).toBe(1);
    });

    it('parses DD/MM/YYYY strings', () => {
        const result = ObraImportService.parseExcelDate('15/03/2026');
        expect(result).not.toBeNull();
        expect(result!.getFullYear()).toBe(2026);
        expect(result!.getUTCMonth()).toBe(2); // March (0-indexed)
        expect(result!.getUTCDate()).toBe(15);
    });

    it('parses DD-MM-YYYY strings', () => {
        const result = ObraImportService.parseExcelDate('01-01-2026');
        expect(result).not.toBeNull();
        expect(result!.getUTCFullYear()).toBe(2026);
    });

    it('parses 2-digit years (>=100 means 20xx)', () => {
        const result = ObraImportService.parseExcelDate('15/03/26');
        expect(result).not.toBeNull();
        expect(result!.getUTCFullYear()).toBe(2026);
    });

    it('parses ISO date strings', () => {
        const result = ObraImportService.parseExcelDate('2026-06-15');
        expect(result).not.toBeNull();
        expect(result!.getFullYear()).toBe(2026);
    });

    it('returns null for garbage strings', () => {
        expect(ObraImportService.parseExcelDate('not-a-date')).toBeNull();
    });
});

describe('ObraImportService.parseAmount', () => {
    it('returns null for null/undefined/empty', () => {
        expect(ObraImportService.parseAmount(null)).toBeNull();
        expect(ObraImportService.parseAmount(undefined)).toBeNull();
        expect(ObraImportService.parseAmount('')).toBeNull();
    });

    it('parses integer numbers', () => {
        expect(ObraImportService.parseAmount(100)).toBe(100);
    });

    it('parses decimal numbers', () => {
        expect(ObraImportService.parseAmount(150.50)).toBe(150.50);
    });

    it('parses strings with comma as decimal separator', () => {
        expect(ObraImportService.parseAmount('150,50')).toBe(150.50);
    });

    it('parses strings with dot as decimal separator', () => {
        expect(ObraImportService.parseAmount('150.50')).toBe(150.50);
    });

    it('returns null for zero', () => {
        expect(ObraImportService.parseAmount(0)).toBeNull();
    });

    it('returns null for negative numbers', () => {
        expect(ObraImportService.parseAmount(-50)).toBeNull();
    });

    it('rounds to 2 decimal places', () => {
        expect(ObraImportService.parseAmount('100.999')).toBe(101);
        expect(ObraImportService.parseAmount('100.111')).toBe(100.11);
    });

    it('trims whitespace in strings', () => {
        expect(ObraImportService.parseAmount('  250.00  ')).toBe(250);
    });
});

describe('ObraImportService.validate', () => {
    const baseRules = {
        obra_code: 'CodigoObra',
        type: 'Tipo',
        date: 'Fecha',
        amount: 'Importe'
    };

    it('marks row as INVALID when obra_code is missing', async () => {
        mockPrisma.project.findMany.mockResolvedValue([]);
        mockPrisma.employee.findMany.mockResolvedValue([]);

        const rows = [{ Tipo: 'PER_DIEM', Fecha: '01/01/2026', Importe: 100 }];
        const result = await ObraImportService.validate(rows, baseRules);

        expect(result.valid).toHaveLength(0);
        expect(result.invalid).toHaveLength(1);
        expect(result.invalid[0].warnings).toContain('MISSING_OBRA_CODE');
    });

    it('marks row as INVALID for invalid type', async () => {
        mockPrisma.project.findMany.mockResolvedValue([]);
        mockPrisma.employee.findMany.mockResolvedValue([]);

        const rows = [{ CodigoObra: 'OBR-001', Tipo: 'INVALID_TYPE', Fecha: '01/01/2026', Importe: 100 }];
        const result = await ObraImportService.validate(rows, baseRules);

        expect(result.invalid).toHaveLength(1);
        expect(result.invalid[0].warnings).toContain('INVALID_TYPE');
    });

    it('marks row as INVALID for missing date', async () => {
        mockPrisma.project.findMany.mockResolvedValue([]);
        mockPrisma.employee.findMany.mockResolvedValue([]);

        const rows = [{ CodigoObra: 'OBR-001', Tipo: 'PER_DIEM', Importe: 100 }];
        const result = await ObraImportService.validate(rows, baseRules);

        expect(result.invalid).toHaveLength(1);
        expect(result.invalid[0].warnings).toContain('INVALID_DATE');
    });

    it('marks row as INVALID for missing/zero amount', async () => {
        mockPrisma.project.findMany.mockResolvedValue([]);
        mockPrisma.employee.findMany.mockResolvedValue([]);

        const rows = [{ CodigoObra: 'OBR-001', Tipo: 'PER_DIEM', Fecha: '01/01/2026', Importe: 0 }];
        const result = await ObraImportService.validate(rows, baseRules);

        expect(result.invalid).toHaveLength(1);
        expect(result.invalid[0].warnings).toContain('INVALID_AMOUNT');
    });

    it('marks row as INVALID when obra not found in DB', async () => {
        mockPrisma.project.findMany.mockResolvedValue([]);
        mockPrisma.employee.findMany.mockResolvedValue([]);

        const rows = [{ CodigoObra: 'NONEXISTENT', Tipo: 'PER_DIEM', Fecha: '01/01/2026', Importe: 100 }];
        const result = await ObraImportService.validate(rows, baseRules);

        expect(result.invalid).toHaveLength(1);
        expect(result.invalid[0].warnings).toContain('OBRA_NOT_FOUND');
    });

    it('marks row as INVALID when obra is inactive', async () => {
        mockPrisma.project.findMany.mockResolvedValue([
            { id: 'obra-1', code: 'OBR-001', status: 'INACTIVE' }
        ]);
        mockPrisma.employee.findMany.mockResolvedValue([]);

        const rows = [{ CodigoObra: 'OBR-001', Tipo: 'PER_DIEM', Fecha: '01/01/2026', Importe: 100 }];
        const result = await ObraImportService.validate(rows, baseRules);

        expect(result.invalid).toHaveLength(1);
        expect(result.invalid[0].warnings).toContain('OBRA_INACTIVE');
    });

    it('validates a correct row with active obra', async () => {
        mockPrisma.project.findMany.mockResolvedValue([
            { id: 'obra-1', code: 'OBR-001', status: 'ACTIVE' }
        ]);
        mockPrisma.employee.findMany.mockResolvedValue([]);

        const rows = [{ CodigoObra: 'OBR-001', Tipo: 'PER_DIEM', Fecha: '15/03/2026', Importe: 250 }];
        const result = await ObraImportService.validate(rows, baseRules);

        expect(result.valid).toHaveLength(1);
        expect(result.invalid).toHaveLength(0);
        expect(result.valid[0].data!.obraId).toBe('obra-1');
        expect(result.valid[0].data!.type).toBe('PER_DIEM');
        expect(result.valid[0].data!.amount).toBe(250);
    });

    it('pre-loads obras in one batch query (C1 fix verification)', async () => {
        mockPrisma.project.findMany.mockResolvedValue([
            { id: 'obra-1', code: 'OBR-001', status: 'ACTIVE' },
            { id: 'obra-2', code: 'OBR-002', status: 'ACTIVE' }
        ]);
        mockPrisma.employee.findMany.mockResolvedValue([]);

        const rows = [
            { CodigoObra: 'OBR-001', Tipo: 'PER_DIEM', Fecha: '01/01/2026', Importe: 100 },
            { CodigoObra: 'OBR-002', Tipo: 'LODGING', Fecha: '02/01/2026', Importe: 200 },
            { CodigoObra: 'OBR-001', Tipo: 'FLIGHT', Fecha: '03/01/2026', Importe: 300 },
        ];

        await ObraImportService.validate(rows, baseRules);

        // Should be exactly 1 findMany call (not 3 — that was the N+1 bug)
        expect(mockPrisma.project.findMany).toHaveBeenCalledTimes(1);
        expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { code: { in: ['OBR-001', 'OBR-002'] } }
            })
        );
    });

    it('respects column mapping for optional fields (C6 fix verification)', async () => {
        mockPrisma.project.findMany.mockResolvedValue([
            { id: 'obra-1', code: 'OBR-001', status: 'ACTIVE' }
        ]);
        mockPrisma.employee.findMany.mockResolvedValue([]);

        const rulesWithOptionals = {
            ...baseRules,
            currency: 'Moneda',
            description: 'Descripcion',
            vendor: 'Proveedor'
        };

        const rows = [{
            CodigoObra: 'OBR-001',
            Tipo: 'PER_DIEM',
            Fecha: '01/01/2026',
            Importe: 100,
            Moneda: 'USD',
            Descripcion: 'Test description',
            Proveedor: 'Test vendor'
        }];

        const result = await ObraImportService.validate(rows, rulesWithOptionals);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].data!.currency).toBe('USD');
        expect(result.valid[0].data!.description).toBe('Test description');
        expect(result.valid[0].data!.vendor).toBe('Test vendor');
    });

    it('defaults currency to EUR when no currency column mapped (C7 fix verification)', async () => {
        mockPrisma.project.findMany.mockResolvedValue([
            { id: 'obra-1', code: 'OBR-001', status: 'ACTIVE' }
        ]);
        mockPrisma.employee.findMany.mockResolvedValue([]);

        const rows = [{ CodigoObra: 'OBR-001', Tipo: 'PER_DIEM', Fecha: '01/01/2026', Importe: 100 }];
        const result = await ObraImportService.validate(rows, baseRules);

        expect(result.valid[0].data!.currency).toBe('EUR');
    });

    it('handles multiple validation errors on same row', async () => {
        mockPrisma.project.findMany.mockResolvedValue([]);
        mockPrisma.employee.findMany.mockResolvedValue([]);

        const rows = [{ Importe: 100 }]; // missing obra_code, type, date
        const result = await ObraImportService.validate(rows, baseRules);

        expect(result.invalid).toHaveLength(1);
        expect(result.invalid[0].warnings).toContain('MISSING_OBRA_CODE');
        expect(result.invalid[0].warnings).toContain('INVALID_TYPE');
        expect(result.invalid[0].warnings).toContain('INVALID_DATE');
    });

    it('processes empty rows array', async () => {
        const result = await ObraImportService.validate([], baseRules);
        expect(result.valid).toHaveLength(0);
        expect(result.invalid).toHaveLength(0);
        expect(mockPrisma.project.findMany).not.toHaveBeenCalled();
    });
});
