import { describe, expect, it } from 'vitest';
import { buildLocalDayRange, buildLocalTimestamp } from './attendanceDateUtils';

describe('AttendanceReconciliation date helpers', () => {
    it('crea un rango completo del día local sin asumir UTC fijo', () => {
        const range = buildLocalDayRange('2026-07-28');
        const start = new Date(range.start);
        const end = new Date(range.end);

        expect(start.getFullYear()).toBe(2026);
        expect(start.getMonth()).toBe(6);
        expect(start.getDate()).toBe(28);
        expect(start.getHours()).toBe(0);
        expect(end.getDate()).toBe(28);
        expect(end.getHours()).toBe(23);
        expect(end.getMinutes()).toBe(59);
    });

    it('convierte una corrección manual desde hora local a un instante ISO', () => {
        const timestamp = new Date(buildLocalTimestamp('2026-07-28', '18:30'));

        expect(timestamp.getFullYear()).toBe(2026);
        expect(timestamp.getMonth()).toBe(6);
        expect(timestamp.getDate()).toBe(28);
        expect(timestamp.getHours()).toBe(18);
        expect(timestamp.getMinutes()).toBe(30);
    });
});
