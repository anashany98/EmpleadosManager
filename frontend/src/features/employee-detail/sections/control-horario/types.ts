import { normalizeTimeInput } from '../employeeControlHorarioForm';

export interface ApiEnvelope<T> {
    success: boolean;
    data: T;
    error?: string;
    message?: string;
}

export interface CalendarEventApi {
    title: string;
    start: string;
    end: string;
    type: string;
    source?: string;
    description?: string;
}

export interface VacationItemApi {
    id: string;
    startDate: string;
    endDate: string;
    type: string;
    reason: string | null;
    status: string;
}

export interface TimeSheetImportPreview {
    sheetName: string;
    sheets?: string[];
    entries: Array<Pick<DailyRow, 'workDate' | 'entryTime' | 'breakOutTime' | 'breakInTime' | 'exitTime' | 'notes'>>;
    warnings: string[];
}

export type DailyEditableField =
    | 'entryTime'
    | 'breakOutTime'
    | 'breakInTime'
    | 'exitTime'
    | 'discountHours'
    | 'scheduledHours'
    | 'dietAmount'
    | 'isHoliday'
    | 'notes';

export interface DailyRow {
    workDate: string;
    dayLabel: string;
    dayNumber: number;
    weekend: boolean;
    entryTime: string;
    breakOutTime: string;
    breakInTime: string;
    exitTime: string;
    workedHours: number;
    discountHours: number;
    scheduledHours: number;
    overtimeHours: number;
    holidayOvertimeHours: number;
    dietAmount: number;
    isHoliday: boolean;
    isCalendarHoliday: boolean;
    holidayName: string;
    isVacation: boolean;
    vacationReason: string;
    vacationType: string;
    /** Etiqueta legible del tipo de ausencia (Vacaciones, Baja médica, Permiso...). */
    vacationLabel: string;
    /** Etiqueta abreviada para la insignia de la tabla (VAC, BAJA, PERM...). */
    vacationShort: string;
    notes: string;
}

export interface DailyEntryApi {
    id?: string;
    workDate: string;
    entryAt: string | null;
    breakOutAt: string | null;
    breakInAt: string | null;
    exitAt: string | null;
    workedHours: number | string;
    discountHours: number | string;
    scheduledHours: number | string;
    overtimeHours: number | string;
    holidayOvertimeHours: number | string;
    dietAmount: number | string;
    isHoliday: boolean;
    isCalendarHoliday: boolean;
    holidayName: string | null;
    notes: string | null;
}

export interface PayrollRecord {
    id: string;
    periodId: string;
    employeeId: string;
    category?: string | null;
    department?: string | null;
    gestoriaCode?: string | null;
    overtimeRate: number | string;
    holidayOvertimeRate: number | string;
    overtimeHours: number | string;
    holidayOvertimeHours: number | string;
    totalOvertimeAmount: number | string;
    totalOvertimeAmountManual?: number | string | null;
    isTotalOvertimeAmountManual?: boolean;
    positiveVariable: number | string;
    negativeVariable: number | string;
    diets: number | string;
    irpf: number | string;
    tgss: number | string;
    availablePercentage?: number | string;
    gross?: number | string;
    productivity?: number | string;
    hoursAmount?: number | string;
    difference?: number | string;
    observations?: string | null;
    version: number;
    dailyEntries?: DailyEntryApi[];
}

export interface EmployeeRecordResponse {
    periodStatus: string;
    periodId: string | null;
    record: PayrollRecord | null;
    companyId?: string;
    vacations?: VacationItemApi[];
}

export interface QuickSchedule {
    entryTime: string;
    breakOutTime: string;
    breakInTime: string;
    exitTime: string;
    discountHours: number;
    scheduledHours: number;
}

export interface ObraWorkEntryApi {
    id: string;
    projectId: string;
    startDate: string;
    endDate: string;
    hours: number;
    notes?: string | null;
    project?: { code: string; name: string; destination?: string | null } | null;
}

export interface ControlHorarioTotals {
    worked: number;
    discount: number;
    scheduled: number;
    overtime: number;
    holiday: number;
    diets: number;
}

export const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
export const DAY_LABELS = ['Do.', 'Lu.', 'Ma.', 'Mi.', 'Ju.', 'Vi.', 'Sá.'];
export const EDITABLE_STATUSES = new Set(['DRAFT', 'IN_REVIEW', 'REOPENED']);
export const GRID_COLUMNS: Array<DailyEditableField | null> = [
    'entryTime',
    'breakOutTime',
    'breakInTime',
    'exitTime',
    null,
    'discountHours',
    'scheduledHours',
    null,
    null,
    'dietAmount',
    'isHoliday',
    'notes'
];
export const EDITABLE_GRID_COLUMNS = GRID_COLUMNS
    .map((field, index) => field ? index : -1)
    .filter((index) => index >= 0);

export function dateKey(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function timeValue(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(11, 16);
}

export function intervalHours(start: string, end: string): number {
    if (!start || !end) return 0;
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    let minutes = endHour * 60 + endMinute - startHour * 60 - startMinute;
    if (minutes < 0) minutes += 24 * 60;
    return minutes / 60;
}

export function recalculateRow(row: DailyRow): DailyRow {
    const splitShift = Boolean(row.breakOutTime || row.breakInTime);
    const workedHours = splitShift
        ? intervalHours(row.entryTime, row.breakOutTime) + intervalHours(row.breakInTime, row.exitTime)
        : intervalHours(row.entryTime, row.exitTime);
    const festivo = row.isHoliday || row.isCalendarHoliday || row.weekend;
    // Festivos, fines de semana y vacaciones no tienen jornada planificada ni
    // descuento, igual que la plantilla de control horario (H.LAB = 0 y
    // DESCONTAR = 0). Sin esta regla, un festivo o día de vacaciones sumaba
    // 8 h a las planificadas y descuadraba el total y la diferencia.
    const noScheduledShift = festivo || row.isVacation;
    const discountHours = noScheduledShift ? 0 : row.discountHours;
    const scheduledHours = noScheduledShift ? 0 : row.scheduledHours;
    const netWorked = workedHours - discountHours;
    return {
        ...row,
        workedHours: Number(workedHours.toFixed(2)),
        discountHours: Number(discountHours.toFixed(2)),
        scheduledHours: Number(scheduledHours.toFixed(2)),
        // En vacaciones trabajadas las horas cuentan como extra normal (no como
        // extra festiva); en festivos/fin de semana van a la columna de festivas.
        overtimeHours: festivo ? 0 : Number(Math.max(netWorked - scheduledHours, 0).toFixed(2)),
        holidayOvertimeHours: festivo ? Number(Math.max(netWorked, 0).toFixed(2)) : 0
    };
}

export function rowHasTimes(row: DailyRow): boolean {
    return Boolean(row.entryTime || row.breakOutTime || row.breakInTime || row.exitTime);
}

export function rowIsIncomplete(row: DailyRow): boolean {
    if (!rowHasTimes(row)) return false;
    if (!row.entryTime || !row.exitTime) return true;
    return Boolean(row.breakOutTime) !== Boolean(row.breakInTime);
}

export function parsePastedValue(field: DailyEditableField, rawValue: string): string | number | boolean {
    if (['entryTime', 'breakOutTime', 'breakInTime', 'exitTime'].includes(field)) {
        return normalizeTimeInput(rawValue);
    }
    if (['discountHours', 'scheduledHours', 'dietAmount'].includes(field)) {
        const parsed = Number(rawValue.trim().replace(',', '.'));
        return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
    }
    if (field === 'isHoliday') {
        return /^(1|x|sí|si|true|festivo)$/i.test(rawValue.trim());
    }
    return rawValue.trim();
}

export function getCalendarHolidays(events: CalendarEventApi[], year: number, month: number): Map<string, string> {
    const holidays = new Map<string, string>();
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    events.filter((event) => event.type === 'holiday').forEach((event) => {
        const cursor = new Date(Math.max(new Date(event.start).getTime(), monthStart.getTime()));
        cursor.setUTCHours(0, 0, 0, 0);
        const end = new Date(Math.min(new Date(event.end).getTime(), monthEnd.getTime()));
        end.setUTCHours(23, 59, 59, 999);
        while (cursor <= end) {
            holidays.set(cursor.toISOString().slice(0, 10), event.title.replace(/^⚫\s*/, ''));
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    });
    return holidays;
}

export function buildRows(
    year: number,
    month: number,
    entries: DailyEntryApi[] = [],
    calendarHolidays?: Map<string, string>,
    vacationsMap?: Map<string, { type: string; reason?: string; label: string; short: string }>
): DailyRow[] {
    const byDate = new Map(entries.map((entry) => [entry.workDate.slice(0, 10), entry]));
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Array.from({ length: days }, (_, index) => {
        const dayNumber = index + 1;
        const key = dateKey(year, month, dayNumber);
        const day = new Date(`${key}T00:00:00.000Z`).getUTCDay();
        const weekend = day === 0 || day === 6;
        const entry = byDate.get(key);
        const vacationInfo = vacationsMap?.get(key);
        const isVacation = Boolean(vacationInfo);
        const vacationReason = vacationInfo?.reason || '';
        const vacationType = vacationInfo?.type || 'VACATION';
        const vacationLabel = vacationInfo?.label || 'Vacaciones';
        const vacationShort = vacationInfo?.short || 'VAC';
        const defaultVacationNotes = isVacation
            ? (vacationReason ? `${vacationLabel} (${vacationReason})` : vacationLabel)
            : '';

        if (entry) {
            const isCalendarHoliday = calendarHolidays
                ? calendarHolidays.has(key)
                : Boolean(entry.isCalendarHoliday);
            const festivo = entry.isHoliday || isCalendarHoliday;
            return {
                workDate: key,
                dayLabel: DAY_LABELS[day],
                dayNumber,
                weekend,
                entryTime: timeValue(entry.entryAt),
                breakOutTime: timeValue(entry.breakOutAt),
                breakInTime: timeValue(entry.breakInAt),
                exitTime: timeValue(entry.exitAt),
                workedHours: Number(entry.workedHours),
                discountHours: (festivo || isVacation) ? 0 : Number(entry.discountHours),
                scheduledHours: (festivo || isVacation) ? 0 : Number(entry.scheduledHours),
                overtimeHours: Number(entry.overtimeHours),
                holidayOvertimeHours: Number(entry.holidayOvertimeHours),
                dietAmount: Number(entry.dietAmount),
                isHoliday: entry.isHoliday,
                isCalendarHoliday,
                holidayName: calendarHolidays?.get(key) || entry.holidayName || '',
                isVacation,
                vacationReason,
                vacationType,
                vacationLabel,
                vacationShort,
                notes: entry.notes || defaultVacationNotes
            };
        }
        const isCalendarHoliday = calendarHolidays?.has(key) || false;
        return {
            workDate: key,
            dayLabel: DAY_LABELS[day],
            dayNumber,
            weekend,
            entryTime: '',
            breakOutTime: '',
            breakInTime: '',
            exitTime: '',
            workedHours: 0,
            discountHours: (weekend || isCalendarHoliday || isVacation) ? 0 : 0.5,
            scheduledHours: (weekend || isCalendarHoliday || isVacation) ? 0 : 8,
            overtimeHours: 0,
            holidayOvertimeHours: 0,
            dietAmount: 0,
            isHoliday: false,
            isCalendarHoliday,
            holidayName: calendarHolidays?.get(key) || '',
            isVacation,
            vacationReason,
            vacationType,
            vacationLabel,
            vacationShort,
            notes: defaultVacationNotes
        } satisfies DailyRow;
    });
}

export function aggregateObraWork(entries: ObraWorkEntryApi[]) {
    const dayHours: Record<string, number> = {};
    const projectTotals = new Map<string, { code: string; name: string; hours: number }>();
    for (const entry of entries) {
        const startDay = String(entry.startDate).slice(0, 10);
        const endDay = String(entry.endDate).slice(0, 10);
        const entryHours = Number(entry.hours || 0);
        if (startDay === endDay) {
            dayHours[startDay] = (dayHours[startDay] || 0) + entryHours;
        }
        const current = projectTotals.get(entry.projectId) || {
            code: entry.project?.code || '',
            name: entry.project?.name || 'Obra',
            hours: 0
        };
        current.hours += entryHours;
        projectTotals.set(entry.projectId, current);
    }
    return { dayHours, monthProjects: Array.from(projectTotals.values()) };
}
