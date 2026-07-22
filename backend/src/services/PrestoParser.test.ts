import { describe, it, expect } from 'vitest';
import { PrestoParser } from './PrestoParser';

function makeSheet(rows: unknown[][], columnCount = 12) {
    return {
        rowCount: rows.length,
        columnCount,
        getRow: (n: number) => ({
            getCell: (c: number) => ({
                value: rows[n - 1]?.[c - 1] ?? undefined
            })
        })
    };
}

describe('PrestoParser.detectAndParse', () => {
    it('returns isPresto=false for a sheet smaller than 9 rows', () => {
        const sheet = makeSheet([['a'], ['b'], ['c']]);
        const result = PrestoParser.detectAndParse(sheet);
        expect(result.isPresto).toBe(false);
        expect(result.motivo).toContain('pequeña');
    });

    it('returns isPresto=false when row 7 does not start with "S."', () => {
        const rows = Array.from({ length: 10 }, () => Array(12).fill(''));
        rows[6][0] = 'Header'; // row 7 (0-indexed: 6)
        const sheet = makeSheet(rows);
        const result = PrestoParser.detectAndParse(sheet);
        expect(result.isPresto).toBe(false);
    });

    it('detects a valid Presto header and parses pedidos', () => {
        const rows: unknown[][] = Array.from({ length: 20 }, () => Array(12).fill(''));

        // Row 7: Presto cabecera — first cell must be "S."
        rows[6][0] = 'S.';

        // Row 8: "Referencia: OBRA-001"
        rows[7][0] = 'Referencia: OBRA-001';

        // Row 9: pedido data — num, fecha, proveedor, ..., base(idx7), ..., totalIva(idx10)
        rows[8][1] = '12345';
        rows[8][2] = new Date('2026-01-15');
        rows[8][3] = 'Proveedor Test';
        rows[8][7] = 150.50;   // base
        rows[8][10] = 182.11;  // totalConIva

        // Row 12 (r+4): detalle — descripcion, cantidad, totalBase
        rows[11][3] = 'Vuelo LOCALIZADOR ABC123';
        rows[11][4] = 2;
        rows[11][11] = 301.00;

        const sheet = makeSheet(rows);
        const result = PrestoParser.detectAndParse(sheet);

        expect(result.isPresto).toBe(true);
        expect(result.pedidos).toHaveLength(1);
        expect(result.pedidos[0].referencia).toBe('OBRA-001');
        expect(result.pedidos[0].numero).toBe('12345');
        expect(result.pedidos[0].proveedor).toBe('Proveedor Test');
        expect(result.pedidos[0].totalConIva).toBe(182.11);
        expect(result.pedidos[0].base).toBe(150.50);
        expect(result.pedidos[0].descripcion).toBe('Vuelo LOCALIZADOR ABC123');
        expect(result.pedidos[0].localizador).toBe('ABC123');
        expect(result.pedidos[0].typeHint).toBe('FLIGHT');
    });

    it('skips rows without Referencia:', () => {
        const rows: unknown[][] = Array.from({ length: 15 }, () => Array(12).fill(''));
        rows[6][0] = 'S.';
        // Row 8 has no "Referencia:" prefix
        rows[7][0] = 'Some random text';

        const sheet = makeSheet(rows);
        const result = PrestoParser.detectAndParse(sheet);
        expect(result.isPresto).toBe(true);
        expect(result.pedidos).toHaveLength(0);
    });
});

describe('PrestoParser.buildMappingHints', () => {
    it('maps known Presto columns to field keys', () => {
        // Headers must match candidates after normalization (lowercase, spaces→underscores)
        const headers = ['referencia', 'fecha', 'proveedor', 'totalbase', 'descripcion', 'numero'];
        const hints = PrestoParser.buildMappingHints(headers);

        expect(hints.isPresto).toBe(true);
        expect(hints.defaultMapping['obra_code']).toBe('referencia');
        expect(hints.defaultMapping['date']).toBe('fecha');
        expect(hints.defaultMapping['vendor']).toBe('proveedor');
        expect(hints.defaultMapping['amount']).toBe('totalbase');
        expect(hints.defaultMapping['description']).toBe('descripcion');
        expect(hints.defaultMapping['reference']).toBe('numero');
    });

    it('returns undefined for unrecognized columns (key not set in mapping)', () => {
        const headers = ['Foo', 'Bar'];
        const hints = PrestoParser.buildMappingHints(headers);
        // buildMappingHints only sets keys that match — unmatched keys are absent
        expect(hints.defaultMapping['obra_code']).toBeUndefined();
        expect(hints.defaultMapping['date']).toBeUndefined();
    });
});

describe('PrestoParser.toMappedRows', () => {
    it('converts pedidos to mapped rows', () => {
        const pedidos = [{
            rowInicio: 1,
            rowFin: 8,
            referencia: 'OBRA-001',
            numero: '12345',
            fecha: new Date('2026-01-15'),
            proveedor: 'Test Provider',
            totalConIva: 182.11,
            base: 150.50,
            descripcion: 'Hotel Madrid',
            cantidad: 3,
            totalBase: 150.50,
            localizador: null,
            typeHint: 'LODGING' as const
        }];

        const result = PrestoParser.toMappedRows(pedidos);
        expect(result).toHaveLength(1);
        expect(result[0].obra_code).toBe('OBRA-001');
        expect(result[0].type).toBe('LODGING');
        expect(result[0].amount).toBe(150.50);
        expect(result[0].currency).toBe('EUR');
    });

    it('uses overrideObraCode when provided', () => {
        const pedidos = [{
            rowInicio: 1, rowFin: 8,
            referencia: 'OLD-REF', numero: '1', fecha: new Date(),
            proveedor: 'P', totalConIva: 100, base: 80,
            descripcion: 'test', cantidad: 1, totalBase: 80,
            localizador: null, typeHint: null
        }];

        const result = PrestoParser.toMappedRows(pedidos, { overrideObraCode: 'OVERRIDE-CODE' });
        expect(result[0].obra_code).toBe('OVERRIDE-CODE');
        expect(result[0].originalRef).toBe('OLD-REF');
    });

    it('filters out pedidos without referencia and no override', () => {
        const pedidos = [{
            rowInicio: 1, rowFin: 8,
            referencia: null, numero: '1', fecha: new Date(),
            proveedor: 'P', totalConIva: 100, base: 80,
            descripcion: 'test', cantidad: 1, totalBase: 80,
            localizador: null, typeHint: null
        }];

        const result = PrestoParser.toMappedRows(pedidos);
        expect(result).toHaveLength(0);
    });

    it('uses typeHint when no defaultType provided', () => {
        const pedidos = [{
            rowInicio: 1, rowFin: 8,
            referencia: 'REF', numero: '1', fecha: new Date(),
            proveedor: 'P', totalConIva: 100, base: 80,
            descripcion: 'Vuelo a Madrid', cantidad: 1, totalBase: 80,
            localizador: null, typeHint: 'FLIGHT' as const
        }];

        const result = PrestoParser.toMappedRows(pedidos);
        expect(result[0].type).toBe('FLIGHT');
    });

    it('uses defaultType over typeHint when both provided', () => {
        const pedidos = [{
            rowInicio: 1, rowFin: 8,
            referencia: 'REF', numero: '1', fecha: new Date(),
            proveedor: 'P', totalConIva: 100, base: 80,
            descripcion: 'test', cantidad: 1, totalBase: 80,
            localizador: null, typeHint: 'FLIGHT' as const
        }];

        const result = PrestoParser.toMappedRows(pedidos, { defaultType: 'OTHER' });
        expect(result[0].type).toBe('OTHER');
    });
});
