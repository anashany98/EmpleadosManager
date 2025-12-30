
export const HOLIDAYS = [
    // 2024
    '2024-01-01', '2024-03-01', '2024-03-28', '2024-03-29', '2024-04-01',
    '2024-05-01', '2024-06-24', '2024-08-15', '2024-10-12', '2024-11-01',
    '2024-12-06', '2024-12-25', '2024-12-26',

    // 2025
    '2025-01-01', '2025-01-06', '2025-01-17', '2025-04-17', '2025-04-18',
    '2025-12-25', '2025-12-26',

    // 2026
    '2026-01-01', '2026-01-06', '2026-03-01', '2026-04-02', '2026-04-03',
    '2026-04-06', '2026-05-01', '2026-06-24', '2026-08-15', '2026-10-12',
    '2026-11-01', '2026-12-06', '2026-12-08', '2026-12-25', '2026-12-26'
];

export const isNationalHoliday = (date: Date): boolean => {
    const day = date.getDate();
    const month = date.getMonth() + 1; // 1-12
    const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Fixed National Holidays (Spain)
    const FIXED_HOLIDAYS = [
        '01-01', // Año Nuevo
        '01-06', // Reyes
        '05-01', // Fiesta del Trabajo
        '08-15', // Asunción
        '10-12', // Fiesta Nacional
        '11-01', // Todos los Santos
        '12-06', // Constitución
        '12-08', // Inmaculada
        '12-25', // Navidad
    ];

    if (FIXED_HOLIDAYS.includes(mmdd)) return true;

    // Easter Calculation (Meeus/Jones/Butcher algorithm)
    const year = date.getFullYear();
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const splitMonth = Math.floor((h + l - 7 * m + 114) / 31);
    const splitDay = ((h + l - 7 * m + 114) % 31) + 1;

    const easterSunday = new Date(year, splitMonth - 1, splitDay);

    // Dynamic Holidays based on Easter
    // Jueves Santo (Easter - 3 days) - Often National/Regional substitution, widely commonly treated as holiday
    const thursdayHoly = new Date(easterSunday);
    thursdayHoly.setDate(easterSunday.getDate() - 3);

    // Viernes Santo (Easter - 2 days) - National
    const fridayHoly = new Date(easterSunday);
    fridayHoly.setDate(easterSunday.getDate() - 2);

    const checkDate = (d1: Date, d2: Date) =>
        d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth();

    if (checkDate(date, fridayHoly)) return true;
    if (checkDate(date, thursdayHoly)) return true;

    return false;
};

export const isHoliday = (date: Date) => {
    // Check hardcoded list first (historical/regional specific)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    if (HOLIDAYS.includes(dateStr)) return true;

    // Check Algorithmic National Holidays
    return isNationalHoliday(date);
};

export const getBusinessDaysCount = (start: Date, end: Date) => {
    let count = 0;
    const curr = new Date(start);
    // Normalize to noon to avoid DST/timezone midnight shifts
    curr.setHours(12, 0, 0, 0);

    const targetEnd = new Date(end);
    targetEnd.setHours(12, 0, 0, 0);

    while (curr <= targetEnd) {
        const dow = curr.getDay();
        if (dow !== 0 && dow !== 6 && !isHoliday(curr)) {
            count++;
        }
        curr.setDate(curr.getDate() + 1);
    }
    return count;
};
