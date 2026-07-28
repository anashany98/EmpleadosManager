import { describe, expect, it } from 'vitest';
import { countInclusiveDays, splitAmountEvenly } from './expenseAllocation';

describe('splitAmountEvenly', () => {
    it('reparte el importe sin perder ni crear céntimos', () => {
        const values = splitAmountEvenly(100, 3);

        expect(values).toEqual([33.34, 33.33, 33.33]);
        expect(Math.round(values.reduce((sum, value) => sum + value, 0) * 100)).toBe(10000);
    });

    it('mantiene el importe completo para una persona', () => {
        expect(splitAmountEvenly(24.57, 1)).toEqual([24.57]);
    });

    it('rechaza cantidades y grupos inválidos', () => {
        expect(() => splitAmountEvenly(0, 2)).toThrow();
        expect(() => splitAmountEvenly(10, 0)).toThrow();
    });
});

describe('countInclusiveDays', () => {
    it('cuenta el primer y el último día', () => {
        expect(countInclusiveDays('2026-07-01', '2026-07-05')).toBe(5);
    });

    it('cuenta una dieta de un solo día', () => {
        expect(countInclusiveDays('2026-07-28', '2026-07-28')).toBe(1);
    });
});
