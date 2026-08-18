import { describe, expect, it } from 'vitest';
import {
    availablePercentage,
    brutoOf,
    diferenciaOf,
    horasOf,
    productividadOf,
    totalImporteOf
} from './CellInput';

describe('Fórmulas del control de gestoría (misma matriz que el backend)', () => {
    it('BRUTO = importe total / % disponible y Horas = BRUTO − productividad', () => {
        const record = {
            overtimeRate: 10,
            holidayOvertimeRate: 12,
            overtimeHours: 5,
            holidayOvertimeHours: 2,
            positiveVariable: 20,
            irpf: 0.17,
            tgss: 0
        };

        expect(totalImporteOf(record)).toBe(74);
        expect(availablePercentage(0.17)).toBe(76.65);
        expect(brutoOf(record)).toBe(96.54);
        expect(productividadOf(record)).toBe(0.2072);
        expect(horasOf(record)).toBe(96.33);
        expect(diferenciaOf(record)).toBe(22.54);
    });

    it('usa siempre el TGSS fijo 6,35% aunque el registro tenga 0 almacenado', () => {
        const record = {
            overtimeRate: 10,
            holidayOvertimeRate: 0,
            overtimeHours: 1,
            holidayOvertimeHours: 0,
            positiveVariable: 0,
            irpf: 0.15,
            tgss: 0
        };

        expect(availablePercentage(0.15)).toBe(78.65);
        // 10 / 0.7865 = 12.7145…
        expect(brutoOf(record)).toBe(12.71);
        expect(horasOf(record)).toBe(12.71);
    });

    it('respeta la sobrescritura manual de BRUTO', () => {
        expect(brutoOf({ isGrossManual: true, gross: 100, irpf: 0.15 })).toBe(100);
        expect(horasOf({ isHoursAmountManual: true, hoursAmount: 88.5, irpf: 0.15 })).toBe(88.5);
    });

    it('devuelve 0 cuando no hay horas ni importe', () => {
        const record = { overtimeRate: 10, holidayOvertimeRate: 12, irpf: 0.15 };
        expect(totalImporteOf(record)).toBe(0);
        expect(brutoOf(record)).toBe(0);
        expect(horasOf(record)).toBe(0);
    });
});
