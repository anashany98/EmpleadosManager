const TIME_FIELDS = ['entryTime', 'breakOutTime', 'breakInTime', 'exitTime'] as const;

type TimeField = (typeof TIME_FIELDS)[number];
type TimeRow = Record<TimeField, string>;

export function normalizeTimeInput(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const excelTime = trimmed.match(/^(\d{1,2})[:.]([0-5]\d)(?::\d{2})?$/);
    if (excelTime) {
        const hour = Number(excelTime[1]);
        return hour <= 23 ? `${excelTime[1].padStart(2, '0')}:${excelTime[2]}` : '';
    }
    const compactTime = trimmed.match(/^(\d{1,2})([0-5]\d)$/);
    if (compactTime) {
        const hour = Number(compactTime[1]);
        return hour <= 23 ? `${compactTime[1].padStart(2, '0')}:${compactTime[2]}` : '';
    }
    return '';
}

export function normalizeDailyRowsForSave<T extends TimeRow>(rows: T[]) {
    const invalidRowIndexes: number[] = [];
    const normalizedRows = rows.map((row, rowIndex) => {
        const normalized = { ...row };
        for (const field of TIME_FIELDS) {
            const value = row[field];
            const normalizedValue = normalizeTimeInput(value);
            if (value.trim() && !normalizedValue) invalidRowIndexes.push(rowIndex);
            normalized[field] = normalizedValue;
        }
        return normalized;
    });

    return { rows: normalizedRows, invalidRowIndexes: [...new Set(invalidRowIndexes)] };
}
