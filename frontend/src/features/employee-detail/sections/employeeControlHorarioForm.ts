const TIME_FIELDS = ['entryTime', 'breakOutTime', 'breakInTime', 'exitTime'] as const;

type TimeField = (typeof TIME_FIELDS)[number];
type TimeRow = Record<TimeField, string>;

export interface VacationItem {
    id?: string;
    startDate: string | Date;
    endDate: string | Date;
    type?: string | null;
    reason?: string | null;
    status?: string | null;
}

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

export function getEmployeeVacations(
    vacations: VacationItem[] = [],
    year: number,
    month: number
): Map<string, { type: string; reason?: string }> {
    const map = new Map<string, { type: string; reason?: string }>();
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    vacations
        .filter((vac) => {
            const status = (vac.status || 'APPROVED').toUpperCase().trim();
            if (status !== 'APPROVED' && status !== 'EXISTING') return false;
            const t = (vac.type || 'VACATION').toUpperCase().trim();
            return t === 'VACATION' || t === 'VACACIONES';
        })
        .forEach((vac) => {
            const rawStart = new Date(vac.startDate);
            const rawEnd = new Date(vac.endDate);
            if (Number.isNaN(rawStart.getTime()) || Number.isNaN(rawEnd.getTime())) return;

            const start = new Date(Date.UTC(rawStart.getUTCFullYear(), rawStart.getUTCMonth(), rawStart.getUTCDate()));
            const end = new Date(Date.UTC(rawEnd.getUTCFullYear(), rawEnd.getUTCMonth(), rawEnd.getUTCDate(), 23, 59, 59, 999));

            const cursor = new Date(Math.max(start.getTime(), monthStart.getTime()));
            cursor.setUTCHours(0, 0, 0, 0);
            const limit = new Date(Math.min(end.getTime(), monthEnd.getTime()));
            limit.setUTCHours(23, 59, 59, 999);

            while (cursor <= limit) {
                const key = cursor.toISOString().slice(0, 10);
                map.set(key, {
                    type: vac.type || 'VACATION',
                    reason: vac.reason || undefined
                });
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }
        });

    return map;
}
