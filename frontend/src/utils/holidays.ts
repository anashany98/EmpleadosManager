
export const HOLIDAYS = [
    // 2024
    '2024-01-01', '2024-03-01', '2024-03-28', '2024-03-29', '2024-04-01',
    '2024-05-01', '2024-06-24', '2024-08-15', '2024-10-12', '2024-11-01',
    '2024-12-06', '2024-12-25', '2024-12-26',

    // 2025
    '2025-01-01', '2025-01-06', '2025-01-17', '2025-04-17', '2025-04-18',
    '2025-04-21', '2025-05-01', '2025-08-15', '2025-12-08', '2025-12-25',
    '2025-12-26',
];

export const isHoliday = (date: Date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    const dateStr = d.toISOString().split('T')[0];
    return HOLIDAYS.includes(dateStr);
};

export const getBusinessDaysCount = (start: Date, end: Date) => {
    let count = 0;
    let curr = new Date(start);
    curr.setHours(0, 0, 0, 0);
    const targetEnd = new Date(end);
    targetEnd.setHours(0, 0, 0, 0);

    while (curr <= targetEnd) {
        const dow = curr.getDay();
        if (dow !== 0 && dow !== 6 && !isHoliday(curr)) {
            count++;
        }
        curr.setDate(curr.setDate(curr.getDate() + 1));
    }
    return count;
};
