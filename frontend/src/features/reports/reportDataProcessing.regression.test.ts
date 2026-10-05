import { describe, expect, it } from 'vitest';
import { buildPdfTable, buildRequestParams, getNormalizedRows, buildScheduleParams, getScheduledReportType } from './reportDataProcessing';
import { getPeriodLabel } from './reportHelpers';

describe('report regressions', () => {
    it.each(['PRL_MEDICAL', 'PRL_TRAINING'] as const)('keeps %s rows in the table and PDF', (type) => {
        const data = { rows: [{ employee: 'Ana', name: 'PRL', date: '2026-10-05', hours: 8, result: 'APTO' }] };
        const rows = getNormalizedRows(type, data);
        expect(rows).toHaveLength(1);
        expect(rows[0].employee).toBe('Ana');
        expect(buildPdfTable(type, rows, data).body).toHaveLength(1);
    });

    it('preserves a zero projected vacation balance', () => {
        const rows = getNormalizedRows('VACATIONS', [{ remainingDays: 5, pendingDays: 5, projectedRemainingDays: 0 }]);
        expect(rows[0].projectedRemainingDays).toBe(0);
    });

    it('opens obra reports with all history independently of the attendance dates', () => {
        const filters = { companyId: 'A', department: '', start: '2026-10-01', end: '2026-10-05', obraStart: '', obraEnd: '', status: '' };
        expect(buildRequestParams('OBRA_SUMMARY', filters)).toEqual({ companyId: 'A' });
        expect(getPeriodLabel('OBRA_SUMMARY', filters)).toBe('Histórico completo');
        expect(buildRequestParams('OBRA_EMPLOYEES', { ...filters, obraStart: '2026-08-01', obraEnd: '2026-08-31' })).toEqual({ companyId: 'A', from: '2026-08-01', to: '2026-08-31' });
    });

    it('includes all expense categories in obra totals and other costs', () => {
        const rows = getNormalizedRows('OBRA_SUMMARY', { obras: [{ totals: { PER_DIEM: 10, CONTRACTOR: 25, MATERIAL: 15, OTHER: 5 } }] });
        expect(rows[0]).toMatchObject({ perDiem: 10, other: 45, total: 55 });
    });

    it('uses the PRL date range for labels and allows an equality department filter', () => {
        expect(getPeriodLabel('PRL_MEDICAL', { start: '2026-08-01', end: '2026-08-31' })).toBe('2026-08-01 · 2026-08-31');
        expect(buildRequestParams('GENDER_GAP', { year: '2026', department: 'Taller' })).toEqual({ year: '2026', department: 'Taller' });
    });

    it('schedules the same attendance summary with its selected inclusive period', () => {
        expect(getScheduledReportType('ATTENDANCE')).toBe('ATTENDANCE_SUMMARY');
        expect(getScheduledReportType('VACATIONS')).toBe('VACATION');
        expect(buildScheduleParams('ATTENDANCE', { start: '2026-08-01', end: '2026-08-31', department: 'Taller', companyId: 'A' })).toEqual({ startDate: '2026-08-01', endDate: '2026-08-31', department: 'Taller', companyId: 'A' });
        expect(buildScheduleParams('KPIS', { year: '2026', month: '' })).toEqual({ year: 2026, month: 0 });
    });
});
