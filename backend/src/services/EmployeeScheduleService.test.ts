import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    parseHHmm,
    formatHHmm,
    diffMinutes,
    isWeekend,
    computeDay,
    getHolidaySet,
} from './EmployeeScheduleService';

// Mock prisma
vi.mock('../lib/prisma', () => ({
    prisma: {
        employeeScheduleEntry: {
            findMany: vi.fn(),
            upsert: vi.fn(),
            deleteMany: vi.fn(),
        },
        holiday: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
    },
}));

import { prisma } from '../lib/prisma';

describe('EmployeeScheduleService — parseHHmm / formatHHmm', () => {
    it('parses HH:mm to minutes since midnight', () => {
        expect(parseHHmm('00:00')).toBe(0);
        expect(parseHHmm('08:30')).toBe(8 * 60 + 30);
        expect(parseHHmm('23:59')).toBe(23 * 60 + 59);
        expect(parseHHmm('9:00')).toBe(9 * 60);
    });
    it('parses HH:mm:ss as well (ignores seconds)', () => {
        expect(parseHHmm('08:30:45')).toBe(8 * 60 + 30);
    });
    it('returns null on invalid / empty', () => {
        expect(parseHHmm('')).toBeNull();
        expect(parseHHmm(null)).toBeNull();
        expect(parseHHmm(undefined)).toBeNull();
        expect(parseHHmm('25:00')).toBeNull();
        expect(parseHHmm('abc')).toBeNull();
    });
    it('round-trips formatHHmm ↔ parseHHmm', () => {
        for (const t of ['00:00', '08:30', '23:59', '12:00']) {
            expect(formatHHmm(parseHHmm(t))).toBe(t);
        }
    });
    it('formatHHmm clamps to 2 digits and pads', () => {
        expect(formatHHmm(0)).toBe('00:00');
        expect(formatHHmm(5)).toBe('00:05');
        expect(formatHHmm(65)).toBe('01:05');
        expect(formatHHmm(null)).toBeNull();
    });
});

describe('EmployeeScheduleService — diffMinutes', () => {
    it('simple diff within the same day', () => {
        expect(diffMinutes(8 * 60, 14 * 60)).toBe(6 * 60);
    });
    it('wraps around midnight (night shift)', () => {
        // 22:00 → 06:00 = 8h
        expect(diffMinutes(22 * 60, 6 * 60)).toBe(8 * 60);
    });
    it('zero when same time', () => {
        expect(diffMinutes(540, 540)).toBe(0);
    });
});

describe('EmployeeScheduleService — isWeekend', () => {
    it('detects Saturday and Sunday', () => {
        // 2026-11-07 is Saturday
        expect(isWeekend('2026-11-07')).toBe(true);
        // 2026-11-08 is Sunday
        expect(isWeekend('2026-11-08')).toBe(true);
        // 2026-11-09 is Monday
        expect(isWeekend('2026-11-09')).toBe(false);
        // 2026-11-13 is Friday
        expect(isWeekend('2026-11-13')).toBe(false);
    });
});

describe('EmployeeScheduleService — computeDay (Excel formulas)', () => {
    it('laborable 8h → 0 extra', () => {
        const day = computeDay(
            { date: '2026-11-09', entry1: '09:00', exit1: '14:00', entry2: '15:00', exit2: '18:00' },
            { isHoliday: false },
        );
        // 5h mañana + 3h tarde = 8h, menos 30min descuento = 7.5h efectivas → 0 extra (jornada=8)
        expect(day.hoursWorked).toBe(8);
        expect(day.hoursExtra).toBe(0);
        expect(day.hoursExtraFestive).toBe(0);
        expect(day.isWeekend).toBe(false);
        expect(day.isHoliday).toBe(false);
    });

    it('laborable 10h → 2h extra (descontando 30min comida)', () => {
        const day = computeDay(
            { date: '2026-11-09', entry1: '08:00', exit1: '14:00', entry2: '15:00', exit2: '19:00' },
            { isHoliday: false },
        );
        // 6h + 4h = 10h trabajadas; 10 - 0.5 (descuento) = 9.5h efectivas; 9.5 - 8 = 1.5 extra
        expect(day.hoursWorked).toBe(10);
        expect(day.hoursExtra).toBe(1.5);
    });

    it('solo turno mañana', () => {
        const day = computeDay(
            { date: '2026-11-09', entry1: '09:00', exit1: '14:00' },
            { isHoliday: false },
        );
        expect(day.hoursWorked).toBe(5);
        // 5 - 0.5 - 8 < 0 → 0
        expect(day.hoursExtra).toBe(0);
    });

    it('turno nocturno que cruza medianoche', () => {
        const day = computeDay(
            { date: '2026-11-09', entry1: '22:00', exit1: '06:00' },
            { isHoliday: false },
        );
        expect(day.hoursWorked).toBe(8);
    });

    it('sábado → todas las horas son extra festivo', () => {
        // 2026-11-07 is Saturday
        const day = computeDay(
            { date: '2026-11-07', entry1: '09:00', exit1: '15:00' },
            { isHoliday: false },
        );
        expect(day.isWeekend).toBe(true);
        expect(day.hoursWorked).toBe(6);
        expect(day.hoursExtra).toBe(0);
        expect(day.hoursExtraFestive).toBe(6);
    });

    it('festivo laborable → todas las horas son extra festivo', () => {
        const day = computeDay(
            { date: '2026-12-25', entry1: '09:00', exit1: '13:00' },
            { isHoliday: true, holidayName: 'Navidad' },
        );
        expect(day.isHoliday).toBe(true);
        expect(day.holidayName).toBe('Navidad');
        expect(day.hoursWorked).toBe(4);
        expect(day.hoursExtra).toBe(0);
        expect(day.hoursExtraFestive).toBe(4);
    });

    it('día vacío → 0 horas, no extra', () => {
        const day = computeDay(
            { date: '2026-11-09', entry1: null, exit1: null, entry2: null, exit2: null },
            { isHoliday: false },
        );
        expect(day.hoursWorked).toBe(0);
        expect(day.hoursExtra).toBe(0);
        expect(day.hoursExtraFestive).toBe(0);
    });

    it('descuentoMin custom se respeta', () => {
        const day = computeDay(
            { date: '2026-11-09', entry1: '08:00', exit1: '14:00', entry2: '15:00', exit2: '19:00', discountMin: 60 },
            { isHoliday: false },
        );
        // 10h trabajadas, 1h descuento, 9h efectivas, 9-8=1h extra
        expect(day.hoursWorked).toBe(10);
        expect(day.hoursExtra).toBe(1);
    });
});

describe('EmployeeScheduleService — getHolidaySet', () => {
    beforeEach(() => {
        vi.mocked(prisma.holiday.findMany).mockReset();
    });

    it('returns a map of date → name', async () => {
        vi.mocked(prisma.holiday.findMany).mockResolvedValue([
            { date: new Date('2026-01-01T00:00:00Z'), name: 'Año Nuevo', scope: 'NATIONAL', region: null, companyId: null },
            { date: new Date('2026-12-25T00:00:00Z'), name: 'Navidad', scope: 'NATIONAL', region: null, companyId: null },
        ] as any);
        const map = await getHolidaySet('2026-01-01', '2026-12-31');
        expect(map.get('2026-01-01')).toBe('Año Nuevo');
        expect(map.get('2026-12-25')).toBe('Navidad');
        expect(map.size).toBe(2);
    });

    it('returns an empty map when there are no holidays', async () => {
        vi.mocked(prisma.holiday.findMany).mockResolvedValue([]);
        const map = await getHolidaySet('2026-06-01', '2026-06-30');
        expect(map.size).toBe(0);
    });
});
