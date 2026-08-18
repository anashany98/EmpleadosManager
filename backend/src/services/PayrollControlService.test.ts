import { describe, expect, it } from 'vitest';
import { PayrollControlService } from './PayrollControlService';

const value = (input: unknown) => String(input);

describe('PayrollControlService - cálculo Decimal', () => {
    it('reproduce las fórmulas del control: G=B×E+C×F, N=1-L-M, O=G/N, P=H/O y Q=O-P', () => {
        const result = PayrollControlService.calculateRecordState({
            overtimeRate: 10, holidayOvertimeRate: 12, overtimeHours: 5, holidayOvertimeHours: 2,
            positiveVariable: 20, irpf: 0.17, tgss: 0.0635
        });

        expect(value(result.totalOvertimeAmountCalculated)).toBe('74');
        expect(value(result.availablePercentageCalculated)).toBe('0.7665');
        expect(value(result.grossCalculated)).toBe('96.54');
        expect(value(result.productivityCalculated)).toBe('0.2072');
        expect(value(result.hoursCalculated)).toBe('96.33');
        expect(value(result.differenceCalculated)).toBe('22.54');
        expect(value(result.reconciliationCalculated)).toBe('-0.0021');
    });

    it('conserva el cálculo original y usa solo la sobrescritura efectiva cuando se marca manual', () => {
        const result = PayrollControlService.calculateRecordState({
            overtimeRate: 10, holidayOvertimeRate: 12, overtimeHours: 5, holidayOvertimeHours: 2,
            totalOvertimeAmountManual: 100, isTotalOvertimeAmountManual: true,
            irpf: 0.15, tgss: 0.0635
        });

        expect(value(result.totalOvertimeAmountCalculated)).toBe('74');
        expect(value(result.totalOvertimeAmount)).toBe('100');
        expect(value(result.grossCalculated)).toBe('127.15');
        expect(value(result.gross)).toBe('127.15');
    });

    it('calcula ceros seguros cuando no hay horas extras', () => {
        const result = PayrollControlService.calculateRecordState({
            overtimeRate: 9, holidayOvertimeRate: 10, overtimeHours: 0, holidayOvertimeHours: 0,
            positiveVariable: 0, irpf: 0.15, tgss: 0.0635
        });
        expect(value(result.totalOvertimeAmount)).toBe('0');
        expect(value(result.grossCalculated)).toBe('0');
        expect(value(result.hoursAmount)).toBe('0');
    });

    it('nunca utiliza horas extra negativas para reducir el importe mensual', () => {
        const result = PayrollControlService.calculateRecordState({
            overtimeRate: 10, holidayOvertimeRate: 12, overtimeHours: -8.5, holidayOvertimeHours: -2,
            positiveVariable: 0, irpf: 0.15, tgss: 0.0635
        });

        expect(value(result.totalOvertimeAmountCalculated)).toBe('0');
        expect(value(result.totalOvertimeAmount)).toBe('0');
        expect(value(result.grossCalculated)).toBe('0');
    });

    it('rechaza un porcentaje disponible no válido cuando existe importe a calcular', () => {
        expect(() => PayrollControlService.calculateRecordState({
            overtimeRate: 10, holidayOvertimeRate: 0, overtimeHours: 1, holidayOvertimeHours: 0,
            irpf: 1, tgss: 0
        })).toThrow(/porcentaje disponible/i);
    });

    it('mantiene la variable negativa como dato informativo porque el Excel no la usa en ninguna fórmula', () => {
        // Matriz de aceptación obtenida de 2026 CONTROL (1).xlsx:
        // G=B*E+C*F; N=1-L-M; O=G/N; P=H/O; Q=O-P; R=O-(O*L+O*M)-G.
        const baseline = PayrollControlService.calculateRecordState({
            overtimeRate: 10, holidayOvertimeRate: 12, overtimeHours: 5, holidayOvertimeHours: 2,
            positiveVariable: 20, negativeVariable: 0, irpf: 0.17, tgss: 0.0635
        });
        const withNegativeVariable = PayrollControlService.calculateRecordState({
            overtimeRate: 10, holidayOvertimeRate: 12, overtimeHours: 5, holidayOvertimeHours: 2,
            positiveVariable: 20, negativeVariable: 999, irpf: 0.17, tgss: 0.0635
        });

        expect(value(withNegativeVariable.gross)).toBe(value(baseline.gross));
        expect(value(withNegativeVariable.productivity)).toBe(value(baseline.productivity));
        expect(value(withNegativeVariable.difference)).toBe(value(baseline.difference));
    });

    it('aplica ROUND_HALF_UP con dos decimales en importes y cuatro en porcentajes', () => {
        const result = PayrollControlService.calculateRecordState({
            overtimeRate: 10.005, holidayOvertimeRate: 0, overtimeHours: 1, holidayOvertimeHours: 0,
            positiveVariable: 1, irpf: 0.12345, tgss: 0.01234
        });

        expect(value(result.totalOvertimeAmountCalculated)).toBe('10.01');
        expect(value(result.availablePercentageCalculated)).toBe('0.8642');
        expect(value(result.grossCalculated)).toBe('11.58');
        expect(value(result.productivityCalculated)).toBe('0.0864');
    });
});

describe('PayrollControlService - control horario diario', () => {
    const daily = (overrides: Partial<Parameters<typeof PayrollControlService.calculateDailyEntryState>[0]> = {}) => ({
        workDate: '2026-07-20',
        entryTime: '08:00',
        breakOutTime: '14:00',
        breakInTime: '15:00',
        exitTime: '18:30',
        discountHours: 0.5,
        scheduledHours: 8,
        isHoliday: false,
        dietAmount: 12.5,
        notes: '',
        ...overrides
    });

    it('suma los dos tramos y descuenta jornada y pausa para obtener la hora extra normal', () => {
        const result = PayrollControlService.calculateDailyEntryState(daily());
        expect(value(result.workedHours)).toBe('9.5');
        expect(value(result.overtimeHours)).toBe('1');
        expect(value(result.holidayOvertimeHours)).toBe('0');
        expect(value(result.dietAmount)).toBe('12.5');
    });

    it('clasifica el trabajo de sábado como hora festiva', () => {
        const result = PayrollControlService.calculateDailyEntryState(daily({
            workDate: '2026-07-18',
            breakOutTime: null,
            breakInTime: null,
            exitTime: '14:00',
            discountHours: 0,
            scheduledHours: 0
        }));
        expect(value(result.workedHours)).toBe('6');
        expect(value(result.overtimeHours)).toBe('0');
        expect(value(result.holidayOvertimeHours)).toBe('6');
    });

    it('clasifica como festivo un día laborable marcado por el calendario', () => {
        const result = PayrollControlService.calculateDailyEntryState(daily({
            workDate: '2026-07-20',
            breakOutTime: null,
            breakInTime: null,
            exitTime: '14:00',
            discountHours: 0,
            scheduledHours: 8
        }), 'Festivo local');
        expect(result.isCalendarHoliday).toBe(true);
        expect(result.holidayName).toBe('Festivo local');
        expect(value(result.overtimeHours)).toBe('0');
        expect(value(result.holidayOvertimeHours)).toBe('6');
    });

    it('admite un turno que termina después de medianoche', () => {
        const result = PayrollControlService.calculateDailyEntryState(daily({
            entryTime: '22:00',
            breakOutTime: null,
            breakInTime: null,
            exitTime: '02:00',
            discountHours: 0,
            scheduledHours: 4
        }));
        expect(value(result.workedHours)).toBe('4');
        expect(value(result.overtimeHours)).toBe('0');
    });

    it('una jornada incompleta no se convierte en horas extra negativas', () => {
        const result = PayrollControlService.calculateDailyEntryState(daily({
            breakOutTime: null,
            breakInTime: null,
            exitTime: '14:00',
            discountHours: 0.5,
            scheduledHours: 8
        }));

        expect(value(result.workedHours)).toBe('6');
        expect(value(result.overtimeHours)).toBe('0');
        expect(value(result.holidayOvertimeHours)).toBe('0');
    });

    it('un día de vacaciones aprobadas no suma jornada planificada aunque el payload traiga 8h/0,5 (datos antiguos)', () => {
        // Datos guardados antes del cruce con vacaciones (o un importador con
        // H.LAB=8): el backend debe imponer la misma regla que la rejilla
        // (H.LAB = 0, DESCONTAR = 0) para que el traspaso a gestoría cuadre.
        const result = PayrollControlService.calculateDailyEntryState(
            daily({ workDate: '2026-07-20', discountHours: 0.5, scheduledHours: 8 }),
            undefined,
            new Set(['2026-07-20'])
        );

        expect(value(result.workedHours)).toBe('9.5');
        expect(value(result.discountHours)).toBe('0');
        expect(value(result.scheduledHours)).toBe('0');
        // Trabajar en vacaciones cuenta como extra normal (no festiva).
        expect(value(result.overtimeHours)).toBe('9.5');
        expect(value(result.holidayOvertimeHours)).toBe('0');
    });

    it('un día de vacaciones sin fichaje no genera horas y sigue sin jornada planificada', () => {
        const result = PayrollControlService.calculateDailyEntryState(
            daily({ workDate: '2026-07-21', entryTime: null, breakOutTime: null, breakInTime: null, exitTime: null, discountHours: 0.5, scheduledHours: 8 }),
            undefined,
            new Set(['2026-07-21'])
        );

        expect(value(result.workedHours)).toBe('0');
        expect(value(result.discountHours)).toBe('0');
        expect(value(result.scheduledHours)).toBe('0');
        expect(value(result.overtimeHours)).toBe('0');
        expect(value(result.holidayOvertimeHours)).toBe('0');
    });

    it('un día normal no se ve afectado por el conjunto de vacaciones', () => {
        const result = PayrollControlService.calculateDailyEntryState(
            daily({ workDate: '2026-07-22' }),
            undefined,
            new Set(['2026-07-20'])
        );

        expect(value(result.workedHours)).toBe('9.5');
        expect(value(result.discountHours)).toBe('0.5');
        expect(value(result.scheduledHours)).toBe('8');
        expect(value(result.overtimeHours)).toBe('1');
        expect(value(result.holidayOvertimeHours)).toBe('0');
    });
});
