import { describe, expect, it } from 'vitest';
import { updateDailyEntriesSchema } from './payrollControlSchemas';

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
