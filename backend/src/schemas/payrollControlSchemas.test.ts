import { describe, expect, it } from 'vitest';
import { employeeRecordBodySchema, updateDailyEntriesSchema, updateRecordCellSchema } from './payrollControlSchemas';

describe('updateDailyEntriesSchema', () => {
    it('normaliza las notas nulas de registros existentes a texto vacío', () => {
        const result = updateDailyEntriesSchema.parse({
            year: 2026,
            month: 7,
            expectedVersion: 1,
            entries: Array.from({ length: 31 }, (_, index) => ({
                workDate: `2026-07-${String(index + 1).padStart(2, '0')}`,
                entryTime: null,
                breakOutTime: null,
                breakInTime: null,
                exitTime: null,
                discountHours: 0,
                scheduledHours: 0,
                isHoliday: false,
                dietAmount: 0,
                notes: null
            }))
        });

        expect(result.entries.every((entry) => entry.notes === '')).toBe(true);
    });
});

// sanitizeBodyMiddleware convierte las cadenas vacías ('') en null antes de la
// validación. Los campos de texto libre que el cliente puede vaciar deben
// aceptar null y normalizarlo a texto vacío; de lo contrario el guardado
// responde 500 con un error de zod (regresión de "Guardar mes").
describe('normalización de textos vaciados por el sanitizer', () => {
    it('employeeRecordBodySchema acepta observations null', () => {
        const result = employeeRecordBodySchema.parse({
            year: 2026,
            month: 7,
            expectedVersion: 1,
            overtimeRate: 0,
            observations: null
        });
        expect(result.observations).toBe('');
    });

    it('updateRecordCellSchema acepta category y department null', () => {
        const result = updateRecordCellSchema.parse({
            expectedVersion: 1,
            category: null,
            department: null
        });
        expect(result.category).toBe('');
        expect(result.department).toBe('');
    });
});
