import { describe, expect, it } from 'vitest';
import {
    buildInsight,
    buildPdfTable,
    buildRequestParams,
    buildSummaryCards,
    getNormalizedRows
} from './reportDataProcessing';

describe('termination report processing', () => {
    const rawRows = [
        {
            employee: 'Ana Pérez',
            dni: '12345678A',
            department: 'Obras',
            type: 'DISMISSAL',
            reason: 'Causas disciplinarias',
            date: '2026-07-15T12:00:00.000Z'
        }
    ];

    it('uses the selected month and exposes the requested personnel fields', () => {
        expect(buildRequestParams('TERMINATIONS', {
            year: '2026',
            month: '7',
            companyId: '',
            department: ''
        })).toEqual({ year: '2026', month: '7' });

        const rows = getNormalizedRows('TERMINATIONS', rawRows);
        expect(rows[0]).toMatchObject({
            employee: 'Ana Pérez',
            dni: '12345678A',
            typeLabel: 'Despido',
            reason: 'Causas disciplinarias'
        });
        expect(buildSummaryCards('TERMINATIONS', rows, rawRows)[1].value).toBe('1');
        expect(buildInsight('TERMINATIONS', rows, rawRows)).toContain('1 de 1');
        expect(buildPdfTable('TERMINATIONS', rows, rawRows).headers).toEqual([
            'Nombre', 'DNI/NIE', 'Tipo', 'Fecha', 'Motivo'
        ]);
    });
});
