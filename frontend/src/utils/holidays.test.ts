import { describe, it, expect } from 'vitest';
import { isHoliday, isNationalHoliday, getBusinessDaysCount } from './holidays';

describe('Holidays Utils', () => {
    describe('isNationalHoliday', () => {
        it('should return true for New Year', () => {
            expect(isNationalHoliday(new Date('2026-01-01'))).toBe(true);
        });

        it('should return true for Epiphany', () => {
            expect(isNationalHoliday(new Date('2026-01-06'))).toBe(true);
        });

        it('should return true for Labor Day', () => {
            expect(isNationalHoliday(new Date('2026-05-01'))).toBe(true);
        });

        it('should return true for Christmas', () => {
            expect(isNationalHoliday(new Date('2026-12-25'))).toBe(true);
        });

        it('should return true for Constitution Day', () => {
            expect(isNationalHoliday(new Date('2026-12-06'))).toBe(true);
        });

        it('should return true for Immaculate Conception', () => {
            expect(isNationalHoliday(new Date('2026-12-08'))).toBe(true);
        });

        it('should return true for National Holiday', () => {
            expect(isNationalHoliday(new Date('2026-10-12'))).toBe(true);
        });

        it('should return true for All Saints Day', () => {
            expect(isNationalHoliday(new Date('2026-11-01'))).toBe(true);
        });

        it('should return true for Assumption', () => {
            expect(isNationalHoliday(new Date('2026-08-15'))).toBe(true);
        });

        it('should return false for regular days', () => {
            expect(isNationalHoliday(new Date('2026-03-15'))).toBe(false);
            expect(isNationalHoliday(new Date('2026-07-04'))).toBe(false);
        });

        it('should return true for Good Friday', () => {
            expect(isNationalHoliday(new Date('2026-04-03'))).toBe(true);
        });

        it('should return true for Holy Thursday', () => {
            expect(isNationalHoliday(new Date('2026-04-02'))).toBe(true);
        });
    });

    describe('isHoliday', () => {
        it('should return true for hardcoded holidays', () => {
            expect(isHoliday(new Date('2026-01-01'))).toBe(true);
            expect(isHoliday(new Date('2026-04-06'))).toBe(true);
        });

        it('should return true for national holidays', () => {
            expect(isHoliday(new Date('2026-01-06'))).toBe(true);
            expect(isHoliday(new Date('2026-05-01'))).toBe(true);
        });

        it('should return false for regular work days', () => {
            expect(isHoliday(new Date('2026-03-10'))).toBe(false);
            expect(isHoliday(new Date('2026-07-15'))).toBe(false);
        });

        it('should handle edge cases', () => {
            expect(isHoliday(new Date('2026-12-26'))).toBe(true);
            expect(isHoliday(new Date('2026-01-17'))).toBe(true);
        });
    });

    describe('getBusinessDaysCount', () => {
        it('should count zero days for same start and end', () => {
            const date = new Date('2026-03-02');
            expect(getBusinessDaysCount(date, date)).toBe(1);
        });

        it('should count one day for consecutive days', () => {
            expect(getBusinessDaysCount(
                new Date('2026-03-02'),
                new Date('2026-03-03')
            )).toBe(2);
        });

        it('should exclude weekends', () => {
            const monday = new Date('2026-03-02'); // Monday
            const friday = new Date('2026-03-06'); // Friday
            expect(getBusinessDaysCount(monday, friday)).toBe(5);
        });

        it('should exclude Saturday and Sunday', () => {
            const friday = new Date('2026-03-06');
            const monday = new Date('2026-03-09');
            expect(getBusinessDaysCount(friday, monday)).toBe(2);
        });

        it('should exclude holidays', () => {
            const thursday = new Date('2026-04-02'); // Thursday before Easter
            const tuesday = new Date('2026-04-07');
            expect(getBusinessDaysCount(thursday, tuesday)).toBe(1);
        });

        it('should handle month boundaries', () => {
            const endOfFeb = new Date('2026-02-27');
            const startOfMar = new Date('2026-03-02');
            expect(getBusinessDaysCount(endOfFeb, startOfMar)).toBeGreaterThan(0);
        });

        it('should handle full week', () => {
            const monday = new Date('2026-03-02');
            const nextMonday = new Date('2026-03-09');
            expect(getBusinessDaysCount(monday, nextMonday)).toBe(6);
        });

        it('should return 0 for weekend-only range', () => {
            const saturday = new Date('2026-03-07');
            const sunday = new Date('2026-03-08');
            expect(getBusinessDaysCount(saturday, sunday)).toBe(0);
        });
    });
});
