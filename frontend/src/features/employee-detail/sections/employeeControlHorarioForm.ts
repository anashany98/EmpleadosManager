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

export interface AbsenceInfo {
    type: string;
    reason?: string;
    label: string;
    short: string;
}

const ABSENCE_TYPE_LABELS: Record<string, string> = {
    VACATION: 'Vacaciones',
    VACACIONES: 'Vacaciones',
    SICK: 'Baja médica',
    MEDICAL_LEAVE: 'Baja médica',
    MATERNITY: 'Maternidad',
    PATERNITY: 'Paternidad',
    MEDICAL_APPOINTMENT: 'Cita médica',
    UNPAID: 'Permiso sin goce',
    MARRIAGE: 'Boda',
    DEATH: 'Fallecimiento',
    MOVING: 'Mudanza',
    FAMILY_SICK: 'Enfermedad familiar',
    PUBLIC_DUTY: 'Deber público',
    LACTATION: 'Lactancia',
    LACTANCIA: 'Lactancia',
    OTHER: 'Otro permiso'
};

const ABSENCE_SHORT_LABELS: Record<string, string> = {
    VACATION: 'VAC',
    VACACIONES: 'VAC',
    SICK: 'BAJA',
    MEDICAL_LEAVE: 'BAJA',
    MEDICAL_APPOINTMENT: 'BAJA',
    FAMILY_SICK: 'BAJA',
    MATERNITY: 'MAT',
    PATERNITY: 'PAT',
    UNPAID: 'PERM',
    MARRIAGE: 'PERM',
    DEATH: 'PERM',
    MOVING: 'PERM',
    PUBLIC_DUTY: 'PERM',
    LACTATION: 'PERM',
    LACTANCIA: 'PERM',
    OTHER: 'AUS'
};

export function getAbsenceLabel(type: string | null | undefined): string {
    return ABSENCE_TYPE_LABELS[(type || 'VACATION').toUpperCase().trim()] || 'Ausencia';
}

export function getAbsenceShortLabel(type: string | null | undefined): string {
    return ABSENCE_SHORT_LABELS[(type || 'VACATION').toUpperCase().trim()] || 'AUS';
}

/**
 * Días de ausencia aprobada (vacaciones, bajas médicas, permisos...) que caen
 * en el mes. Todos los tipos aprobados cuentan: la rejilla los trata igual que
 * las vacaciones (sin jornada planificada ni imputación a obra).
 */
export function getEmployeeVacations(
    vacations: VacationItem[] = [],
    year: number,
    month: number
): Map<string, AbsenceInfo> {
    const map = new Map<string, AbsenceInfo>();
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    vacations
        .filter((vac) => {
            const status = (vac.status || 'APPROVED').toUpperCase().trim();
            return status === 'APPROVED' || status === 'EXISTING';
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

            const type = vac.type || 'VACATION';
            while (cursor <= limit) {
                const key = cursor.toISOString().slice(0, 10);
                map.set(key, {
                    type,
                    reason: vac.reason || undefined,
                    label: getAbsenceLabel(type),
                    short: getAbsenceShortLabel(type)
                });
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }
        });

    return map;
}
