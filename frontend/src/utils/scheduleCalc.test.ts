import { describe, it, expect } from 'vitest';
import { parseHHmm, isWeekend, computeDay } from './scheduleCalc';

describe('scheduleCalc (paridad con backend)', () => {
    it('parses HH:mm', () => {
        expect(parseHHmm('08:30')).toBe(510);
        expect(parseHHmm('9:00')).toBe(540);
        expect(parseHHmm('')).toBeNull();
        expect(parseHHmm('99:00')).toBeNull();
    });

    it('isWeekend detecta sábado/domingo', () => {
        expect(isWeekend('2026-11-07')).toBe(true); // sábado
        expect(isWeekend('2026-11-08')).toBe(true); // domingo
        expect(isWeekend('2026-11-09')).toBe(false);
    });

    it('laborable 8h → 0 extra', () => {
        const day = computeDay(
            { date: '2026-11-09', entry1: '09:00', exit1: '14:00', entry2: '15:00', exit2: '18:00' },
            { isHoliday: false },
        );
        expect(day.hoursWorked).toBe(8);
        expect(day.hoursExtra).toBe(0);
    });

    it('sábado → todo es extra festivo', () => {
        const day = computeDay(
            { date: '2026-11-07', entry1: '09:00', exit1: '15:00' },
            { isHoliday: false },
        );
        expect(day.hoursExtraFestive).toBe(6);
        expect(day.hoursExtra).toBe(0);
    });

    it('festivo → todo es extra festivo', () => {
        const day = computeDay(
            { date: '2026-12-25', entry1: '09:00', exit1: '13:00' },
            { isHoliday: true, holidayName: 'Navidad' },
        );
        expect(day.hoursExtraFestive).toBe(4);
        expect(day.hoursExtra).toBe(0);
    });

    it('laborable 10h con descuento 30min → 1.5h extra', () => {
        const day = computeDay(
            { date: '2026-11-09', entry1: '08:00', exit1: '14:00', entry2: '15:00', exit2: '19:00' },
            { isHoliday: false },
        );
        // 10h - 0.5h = 9.5h efectivas; 9.5 - 8 = 1.5
        expect(day.hoursExtra).toBe(1.5);
    });
});
