import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    ClipboardPaste,
    Clock,
    Eraser,
    HardHat,
    Keyboard,
    Loader2,
    Lock,
    Save,
    Upload,
    WandSparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../../api/client';
import { normalizeDailyRowsForSave, normalizeTimeInput } from './employeeControlHorarioForm';
import ObraHoursModal from '../components/ObraHoursModal';

interface EmployeeControlHorarioSectionProps {
    employeeId: string;
}

interface DailyEntryApi {
    workDate: string;
    entryAt: string | null;
    breakOutAt: string | null;
    breakInAt: string | null;
    exitAt: string | null;
    workedHours: string | number;
    discountHours: string | number;
    scheduledHours: string | number;
    overtimeHours: string | number;
    holidayOvertimeHours: string | number;
    dietAmount: string | number;
    isHoliday: boolean;
    isCalendarHoliday: boolean;
    holidayName: string | null;
    notes: string | null;
}

interface PayrollRecord {
    version: number;
    overtimeRate: string | number;
    holidayOvertimeRate: string | number;
    overtimeHours: string | number;
    holidayOvertimeHours: string | number;
    positiveVariable: string | number;
    negativeVariable: string | number;
    diets: string | number;
    irpf: string | number;
    tgss: string | number;
    productivity: string | number;
    totalOvertimeAmount: string | number;
    observations: string | null;
    dailyEntries: DailyEntryApi[];
}

interface DailyRow {
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
    notes: string;
}

type DailyEditableField =
    | 'entryTime'
    | 'breakOutTime'
    | 'breakInTime'
    | 'exitTime'
    | 'discountHours'
    | 'scheduledHours'
    | 'dietAmount'
    | 'isHoliday'
    | 'notes';

interface QuickSchedule {
    entryTime: string;
    breakOutTime: string;
    breakInTime: string;
    exitTime: string;
    discountHours: number;
    scheduledHours: number;
}

interface EmployeeRecordResponse {
    periodStatus: string;
    periodId: string | null;
    record: PayrollRecord | null;
}

interface ApiEnvelope<T> {
    data: T;
}

interface CalendarEventApi {
    title: string;
    start: string;
    end: string;
    type: string;
}

interface TimeSheetImportPreview {
    sheetName: string;
    entries: Array<Pick<DailyRow, 'workDate' | 'entryTime' | 'breakOutTime' | 'breakInTime' | 'exitTime' | 'notes'>>;
    warnings: string[];
}

interface ObraWorkEntryApi {
    id: string;
    projectId: string;
    startDate: string;
    endDate: string;
    hours: number;
    notes?: string | null;
    project?: { code: string; name: string; destination?: string | null } | null;
}

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const DAY_LABELS = ['Do.', 'Lu.', 'Ma.', 'Mi.', 'Ju.', 'Vi.', 'Sá.'];
const EDITABLE_STATUSES = new Set(['DRAFT', 'IN_REVIEW', 'REOPENED']);
const GRID_COLUMNS: Array<DailyEditableField | null> = [
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
const EDITABLE_GRID_COLUMNS = GRID_COLUMNS
    .map((field, index) => field ? index : -1)
    .filter((index) => index >= 0);

function unwrap<T>(response: T | ApiEnvelope<T>): T {
    return response && typeof response === 'object' && 'data' in response
        ? (response as ApiEnvelope<T>).data
        : response as T;
}

function dateKey(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function timeValue(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(11, 16);
}

function intervalHours(start: string, end: string): number {
    if (!start || !end) return 0;
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    let minutes = endHour * 60 + endMinute - startHour * 60 - startMinute;
    if (minutes < 0) minutes += 24 * 60;
    return minutes / 60;
}

function recalculateRow(row: DailyRow): DailyRow {
    const splitShift = Boolean(row.breakOutTime || row.breakInTime);
    const workedHours = splitShift
        ? intervalHours(row.entryTime, row.breakOutTime) + intervalHours(row.breakInTime, row.exitTime)
        : intervalHours(row.entryTime, row.exitTime);
    const holidayOrWeekend = row.isHoliday || row.isCalendarHoliday || row.weekend;
    const netWorked = workedHours - row.discountHours;
    return {
        ...row,
        workedHours: Number(workedHours.toFixed(2)),
        overtimeHours: holidayOrWeekend ? 0 : Number(Math.max(netWorked - row.scheduledHours, 0).toFixed(2)),
        holidayOvertimeHours: holidayOrWeekend ? Number(Math.max(netWorked, 0).toFixed(2)) : 0
    };
}

function rowHasTimes(row: DailyRow): boolean {
    return Boolean(row.entryTime || row.breakOutTime || row.breakInTime || row.exitTime);
}

function rowIsIncomplete(row: DailyRow): boolean {
    if (!rowHasTimes(row)) return false;
    if (!row.entryTime || !row.exitTime) return true;
    return Boolean(row.breakOutTime) !== Boolean(row.breakInTime);
}

function parsePastedValue(field: DailyEditableField, rawValue: string): string | number | boolean {
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

function getCalendarHolidays(events: CalendarEventApi[], year: number, month: number): Map<string, string> {
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

function buildRows(
    year: number,
    month: number,
    entries: DailyEntryApi[] = [],
    calendarHolidays?: Map<string, string>
): DailyRow[] {
    const byDate = new Map(entries.map((entry) => [entry.workDate.slice(0, 10), entry]));
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Array.from({ length: days }, (_, index) => {
        const dayNumber = index + 1;
        const key = dateKey(year, month, dayNumber);
        const day = new Date(`${key}T00:00:00.000Z`).getUTCDay();
        const weekend = day === 0 || day === 6;
        const entry = byDate.get(key);
        if (entry) {
            const isCalendarHoliday = calendarHolidays
                ? calendarHolidays.has(key)
                : Boolean(entry.isCalendarHoliday);
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
                discountHours: Number(entry.discountHours),
                scheduledHours: Number(entry.scheduledHours),
                overtimeHours: Number(entry.overtimeHours),
                holidayOvertimeHours: Number(entry.holidayOvertimeHours),
                dietAmount: Number(entry.dietAmount),
                isHoliday: entry.isHoliday,
                isCalendarHoliday,
                holidayName: calendarHolidays?.get(key) || entry.holidayName || '',
                notes: entry.notes || ''
            };
        }
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
            discountHours: weekend ? 0 : 0.5,
            scheduledHours: weekend ? 0 : 8,
            overtimeHours: 0,
            holidayOvertimeHours: 0,
            dietAmount: 0,
            isHoliday: false,
            isCalendarHoliday: calendarHolidays?.has(key) || false,
            holidayName: calendarHolidays?.get(key) || '',
            notes: ''
        } satisfies DailyRow;
    });
}

function aggregateObraWork(entries: ObraWorkEntryApi[]) {
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

function NumericCell({
    value,
    onChange,
    disabled,
    step = 0.5,
    ariaLabel,
    rowIndex,
    columnIndex
}: {
    value: number;
    onChange: (value: number) => void;
    disabled: boolean;
    step?: number;
    ariaLabel: string;
    rowIndex: number;
    columnIndex: number;
}) {
    return (
        <input
            type="number"
            min="0"
            step={step}
            disabled={disabled}
            value={value}
            onChange={(event) => onChange(Number(event.target.value || 0))}
            aria-label={ariaLabel}
            data-grid-row={rowIndex}
            data-grid-col={columnIndex}
            className="h-8 w-full min-w-16 border-0 bg-transparent px-2 text-right font-mono text-xs text-slate-800 outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-500 disabled:cursor-not-allowed disabled:text-slate-500 dark:text-slate-100 dark:focus:bg-blue-950/40"
        />
    );
}

function MobileTimeInput({
    label,
    value,
    disabled,
    onChange
}: {
    label: string;
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
            <input
                type="time"
                disabled={disabled}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="mt-0.5 h-8 w-full border-0 bg-transparent p-0 font-mono text-sm font-semibold text-slate-900 outline-none focus:ring-0 disabled:text-slate-500 dark:text-white"
            />
        </label>
    );
}

export function EmployeeControlHorarioSection({ employeeId }: EmployeeControlHorarioSectionProps) {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [periodStatus, setPeriodStatus] = useState('DRAFT');
    const [record, setRecord] = useState<PayrollRecord | null>(null);
    const [rows, setRows] = useState<DailyRow[]>([]);
    const [dirty, setDirty] = useState(false);
    const [modifiedRows, setModifiedRows] = useState<Set<string>>(new Set());
    const [monthlyFieldsDirty, setMonthlyFieldsDirty] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [saveError, setSaveError] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<TimeSheetImportPreview | null>(null);
    const importInputRef = useRef<HTMLInputElement>(null);
    const [quickSchedule, setQuickSchedule] = useState<QuickSchedule>({
        entryTime: '',
        breakOutTime: '',
        breakInTime: '',
        exitTime: '',
        discountHours: 0.5,
        scheduledHours: 8
    });

    // Imputación de horas a obras desde el propio control horario
    const [obraModalDate, setObraModalDate] = useState<string | null>(null);
    const [obraDayHours, setObraDayHours] = useState<Record<string, number>>({});
    const [obraMonthProjects, setObraMonthProjects] = useState<Array<{ code: string; name: string; hours: number }>>([]);

    const missingPeriod = periodStatus === 'NOT_CREATED';
    const isLocked = missingPeriod || !EDITABLE_STATUSES.has(periodStatus);

    const loadRecord = useCallback(async () => {
        setLoading(true);
        try {
            const start = dateKey(year, month, 1);
            const end = dateKey(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate());
            const [recordResponse, calendarResponse, workResponse] = await Promise.all([
                api.get<ApiEnvelope<EmployeeRecordResponse>>(`/payroll/control/employee/${employeeId}`, {
                    params: { year, month }
                }),
                api.get<ApiEnvelope<CalendarEventApi[]>>(`/calendar/unified?start=${start}&end=${end}`),
                api.get<ApiEnvelope<ObraWorkEntryApi[]>>(`/employee-project-work/employee/${employeeId}`, {
                    params: { from: start, to: end }
                })
            ]);
            const data = unwrap(recordResponse);
            const calendarHolidays = getCalendarHolidays(unwrap(calendarResponse), year, month);
            setPeriodStatus(data.periodStatus || 'DRAFT');
            setRecord(data.record);
            setRows(buildRows(year, month, data.record?.dailyEntries || [], calendarHolidays));

            // Horas imputadas a obras del mes (para el indicador por día y el resumen por obra)
            const { dayHours, monthProjects } = aggregateObraWork(unwrap(workResponse) || []);
            setObraDayHours(dayHours);
            setObraMonthProjects(monthProjects);
            setDirty(false);
            setSaved(false);
            setModifiedRows(new Set());
            setMonthlyFieldsDirty(false);
            setSaveError(false);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'No se pudo cargar el control horario'));
        } finally {
            setLoading(false);
        }
    }, [employeeId, month, year]);

    useEffect(() => {
        void loadRecord();
    }, [loadRecord]);

    // Refresco ligero de las horas imputadas a obras (sin recargar todo el mes
    // ni parpadear la tabla) — se usa al guardar desde el modal de imputación.
    const refreshObraWork = useCallback(async () => {
        const start = dateKey(year, month, 1);
        const end = dateKey(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate());
        try {
            const workResponse = await api.get<ApiEnvelope<ObraWorkEntryApi[]>>(`/employee-project-work/employee/${employeeId}`, {
                params: { from: start, to: end }
            });
            const { dayHours, monthProjects } = aggregateObraWork(unwrap(workResponse) || []);
            setObraDayHours(dayHours);
            setObraMonthProjects(monthProjects);
        } catch {
            // Silencioso: no interrumpir el control horario si falla el refresco
        }
    }, [employeeId, month, year]);

    useEffect(() => {
        const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
            if (!dirty) return;
            event.preventDefault();
        };
        window.addEventListener('beforeunload', warnBeforeLeaving);
        return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
    }, [dirty]);

    const totals = useMemo(() => rows.reduce((total, row) => ({
        worked: total.worked + row.workedHours,
        scheduled: total.scheduled + row.scheduledHours,
        overtime: total.overtime + Math.max(row.overtimeHours, 0),
        holiday: total.holiday + row.holidayOvertimeHours,
        diets: total.diets + row.dietAmount
    }), { worked: 0, scheduled: 0, overtime: 0, holiday: 0, diets: 0 }), [rows]);
    const incompleteDays = useMemo(() => rows.filter(rowIsIncomplete).length, [rows]);
    const emptyWorkingDays = useMemo(() => rows.filter((row) => (
        !row.weekend && !row.isHoliday && !row.isCalendarHoliday && !rowHasTimes(row)
    )).length, [rows]);
    const hourDifference = totals.worked - totals.scheduled;

    const updateRow = (index: number, patch: Partial<DailyRow>) => {
        if (isLocked) return;
        setRows((current) => current.map((row, rowIndex) => (
            rowIndex === index ? recalculateRow({ ...row, ...patch }) : row
        )));
        setDirty(true);
        setSaved(false);
        setSaveError(false);
        setModifiedRows((current) => new Set(current).add(rows[index].workDate));
    };

    const applyQuickSchedule = (onlyEmpty: boolean) => {
        if (isLocked) return;
        if (!quickSchedule.entryTime || !quickSchedule.exitTime) {
            toast.error('Indica al menos la primera entrada y la última salida.');
            return;
        }
        let changed = 0;
        setRows((current) => current.map((row) => {
            if (row.weekend || row.isHoliday || row.isCalendarHoliday || (onlyEmpty && rowHasTimes(row))) return row;
            changed += 1;
            return recalculateRow({ ...row, ...quickSchedule });
        }));
        if (changed === 0) {
            toast.info(onlyEmpty ? 'No hay días laborables vacíos.' : 'No hay días laborables que actualizar.');
            return;
        }
        setDirty(true);
        setSaved(false);
        setSaveError(false);
        setModifiedRows(new Set(rows
            .filter((row) => !row.weekend && !row.isHoliday && !row.isCalendarHoliday && (!onlyEmpty || !rowHasTimes(row)))
            .map((row) => row.workDate)));
        toast.success(`Horario aplicado a ${changed} días laborables.`);
    };

    const clearTimeEntries = () => {
        if (isLocked || !rows.some(rowHasTimes)) return;
        if (!window.confirm('Se borrarán las cuatro horas de entrada y salida del mes. Las dietas y observaciones se conservarán.')) return;
        setRows((current) => current.map((row) => recalculateRow({
            ...row,
            entryTime: '',
            breakOutTime: '',
            breakInTime: '',
            exitTime: ''
        })));
        setDirty(true);
        setSaved(false);
        setSaveError(false);
        setModifiedRows(new Set(rows.filter(rowHasTimes).map((row) => row.workDate)));
    };

    const focusGridCell = (rowIndex: number, columnIndex: number) => {
        const target = document.querySelector<HTMLElement>(
            `[data-grid-row="${rowIndex}"][data-grid-col="${columnIndex}"]`
        );
        target?.focus();
        if (target instanceof HTMLInputElement && target.type !== 'checkbox') target.select();
    };

    const handleGridKeyDown = (event: React.KeyboardEvent<HTMLTableElement>) => {
        const target = event.target as HTMLInputElement;
        const rowIndex = Number(target.dataset.gridRow);
        const columnIndex = Number(target.dataset.gridCol);
        if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex)) return;

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && rowIndex > 0) {
            const field = GRID_COLUMNS[columnIndex];
            if (!field) return;
            event.preventDefault();
            updateRow(rowIndex, { [field]: rows[rowIndex - 1][field] });
            return;
        }

        let nextRow = rowIndex;
        let editableIndex = EDITABLE_GRID_COLUMNS.indexOf(columnIndex);
        if (event.key === 'ArrowUp' || (event.key === 'Enter' && event.shiftKey)) nextRow -= 1;
        else if (event.key === 'ArrowDown' || event.key === 'Enter') nextRow += 1;
        else if (event.key === 'ArrowLeft' && target.type !== 'text') editableIndex -= 1;
        else if (event.key === 'ArrowRight' && target.type !== 'text') editableIndex += 1;
        else return;

        event.preventDefault();
        if (editableIndex < 0) editableIndex = 0;
        if (editableIndex >= EDITABLE_GRID_COLUMNS.length) editableIndex = EDITABLE_GRID_COLUMNS.length - 1;
        nextRow = Math.max(0, Math.min(rows.length - 1, nextRow));
        focusGridCell(nextRow, EDITABLE_GRID_COLUMNS[editableIndex]);
    };

    const handleGridPaste = (event: React.ClipboardEvent<HTMLTableElement>) => {
        if (isLocked) return;
        const target = event.target as HTMLInputElement;
        const startRow = Number(target.dataset.gridRow);
        const startColumn = Number(target.dataset.gridCol);
        const clipboard = event.clipboardData.getData('text');
        if (!Number.isInteger(startRow) || !Number.isInteger(startColumn) || !/[\t\r\n]/.test(clipboard)) return;

        event.preventDefault();
        const pastedRows = clipboard.replace(/\r/g, '').trimEnd().split('\n').map((line) => line.split('\t'));
        setRows((current) => {
            const next = [...current];
            pastedRows.forEach((values, rowOffset) => {
                const rowIndex = startRow + rowOffset;
                if (!next[rowIndex]) return;
                let updated = { ...next[rowIndex] };
                values.forEach((rawValue, columnOffset) => {
                    const field = GRID_COLUMNS[startColumn + columnOffset];
                    if (!field) return;
                    updated = { ...updated, [field]: parsePastedValue(field, rawValue) };
                });
                next[rowIndex] = recalculateRow(updated);
            });
            return next;
        });
        setDirty(true);
        setSaved(false);
        setSaveError(false);
        setModifiedRows((current) => {
            const next = new Set(current);
            pastedRows.forEach((_, rowOffset) => {
                if (rows[startRow + rowOffset]) next.add(rows[startRow + rowOffset].workDate);
            });
            return next;
        });
        toast.success(`Pegadas ${pastedRows.length} fila${pastedRows.length === 1 ? '' : 's'} desde el portapapeles.`);
    };

    const updateRecordField = (field: keyof PayrollRecord, value: string | number) => {
        if (!record || isLocked) return;
        setRecord({ ...record, [field]: value });
        setDirty(true);
        setSaved(false);
        setSaveError(false);
        setMonthlyFieldsDirty(true);
    };

    const changePeriod = (direction: number) => {
        if (dirty && !window.confirm('Hay cambios sin guardar. ¿Quieres cambiar de mes y descartarlos?')) return;
        const target = new Date(Date.UTC(year, month - 1 + direction, 1));
        setYear(target.getUTCFullYear());
        setMonth(target.getUTCMonth() + 1);
    };

    const selectPeriod = (nextYear: number, nextMonth: number) => {
        if (dirty && !window.confirm('Hay cambios sin guardar. ¿Quieres cambiar de mes y descartarlos?')) return;
        setYear(nextYear);
        setMonth(nextMonth);
    };

    const handleSave = async () => {
        if (!record || isLocked || saving) return;
        const normalized = normalizeDailyRowsForSave(rows);
        if (normalized.invalidRowIndexes.length > 0) {
            const days = normalized.invalidRowIndexes
                .map((index) => rows[index].dayNumber)
                .join(', ');
            toast.error(`Corrige la hora de los días ${days}. Usa 08:00 o escribe 800.`);
            return;
        }
        const rowsToSave = normalized.rows;
        setSaving(true);
        setSaveError(false);
        try {
            const dailyResponse = await api.put<ApiEnvelope<PayrollRecord>>(
                `/payroll/control/employee/${employeeId}/daily`,
                {
                    year,
                    month,
                    expectedVersion: record.version,
                    entries: rowsToSave.map((row) => ({
                        workDate: row.workDate,
                        entryTime: row.entryTime || null,
                        breakOutTime: row.breakOutTime || null,
                        breakInTime: row.breakInTime || null,
                        exitTime: row.exitTime || null,
                        discountHours: row.discountHours,
                        scheduledHours: row.scheduledHours,
                        isHoliday: row.isHoliday,
                        dietAmount: row.dietAmount,
                        notes: row.notes
                    }))
                }
            );
            const dailyRecord = unwrap(dailyResponse);
            const monthlyResponse = await api.put<ApiEnvelope<PayrollRecord>>(
                `/payroll/control/employee/${employeeId}`,
                {
                    year,
                    month,
                    expectedVersion: dailyRecord.version,
                    overtimeRate: Number(record.overtimeRate || 0),
                    holidayOvertimeRate: Number(record.holidayOvertimeRate || 0),
                    positiveVariable: Number(record.positiveVariable || 0),
                    negativeVariable: Number(record.negativeVariable || 0),
                    irpf: Number(record.irpf || 0),
                    tgss: Number(record.tgss || 0),
                    observations: record.observations || ''
                }
            );
            const updated = unwrap(monthlyResponse);
            setRecord(updated);
            setRows(buildRows(year, month, updated.dailyEntries || []));
            setDirty(false);
            setSaved(true);
            setModifiedRows(new Set());
            setMonthlyFieldsDirty(false);
            setLastSavedAt(new Date());
            window.dispatchEvent(new CustomEvent('payroll-control-updated', {
                detail: { employeeId, year, month }
            }));
            toast.success('Control horario diario guardado');
        } catch (error: unknown) {
            setSaveError(true);
            toast.error(getErrorMessage(error, 'No se pudo guardar el control horario'));
        } finally {
            setSaving(false);
        }
    };

    const createImportForm = (file: File, includeVersion = false) => {
        const form = new FormData();
        form.append('file', file);
        form.append('year', String(year));
        form.append('month', String(month));
        if (includeVersion && record) form.append('expectedVersion', String(record.version));
        return form;
    };

    const previewImport = async (file: File) => {
        if (!record || isLocked) return;
        setImporting(true);
        setImportPreview(null);
        try {
            const response = await api.post<ApiEnvelope<TimeSheetImportPreview>>(
                `/payroll/control/employee/${employeeId}/daily/import-preview`,
                createImportForm(file)
            );
            setImportFile(file);
            setImportPreview(unwrap(response));
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'No se pudo analizar el Excel de control horario'));
        } finally {
            setImporting(false);
        }
    };

    const confirmImport = async () => {
        if (!record || !importFile || !importPreview || isLocked) return;
        setImporting(true);
        try {
            const response = await api.post<ApiEnvelope<{ record: PayrollRecord; importedDays: number; warnings: string[] }>>(
                `/payroll/control/employee/${employeeId}/daily/import`,
                createImportForm(importFile, true)
            );
            const result = unwrap(response);
            setRecord(result.record);
            setRows(buildRows(year, month, result.record.dailyEntries || []));
            setDirty(false);
            setSaved(true);
            setModifiedRows(new Set());
            setLastSavedAt(new Date());
            setImportPreview(null);
            setImportFile(null);
            toast.success(`${result.importedDays} días importados correctamente.`);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'No se pudieron importar las horas'));
        } finally {
            setImporting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 className="animate-spin" size={18} />
                Cargando calendario mensual…
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-700 text-white">
                            <CalendarDays size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Registro diario</h3>
                            <p className="text-xs text-slate-500">Anota las entradas, salidas, festivos y dietas de cada día.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex h-9 items-center rounded-lg border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800">
                            <button type="button" onClick={() => changePeriod(-1)} className="grid h-full w-9 place-items-center rounded-l-lg hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Mes anterior">
                                <ChevronLeft size={16} />
                            </button>
                            <select value={month} onChange={(event) => selectPeriod(year, Number(event.target.value))} className="h-full border-0 bg-transparent px-1 text-sm font-semibold outline-none">
                                {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
                            </select>
                            <select value={year} onChange={(event) => selectPeriod(Number(event.target.value), month)} className="h-full border-0 bg-transparent px-1 text-sm outline-none">
                                {Array.from({ length: 9 }, (_, index) => now.getFullYear() - 4 + index).map((value) => <option key={value}>{value}</option>)}
                            </select>
                            <button type="button" onClick={() => changePeriod(1)} className="grid h-full w-9 place-items-center rounded-r-lg hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Mes siguiente">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        <span className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ${saveError ? 'bg-rose-50 text-rose-700' : saved ? 'bg-emerald-50 text-emerald-700' : dirty ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {saveError ? <AlertTriangle size={14} /> : saved ? <Check size={14} /> : <Clock size={14} />}
                            {saveError
                                ? 'Error: cambios sin guardar'
                                : saved
                                    ? `Guardado${lastSavedAt ? ` a las ${lastSavedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}`
                                    : dirty
                                        ? `${modifiedRows.size} días${monthlyFieldsDirty ? ' + datos mensuales' : ''} pendientes`
                                        : 'Sin cambios'}
                        </span>
                        {!isLocked && (
                            <>
                            <input ref={importInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void previewImport(file);
                                event.target.value = '';
                            }} />
                            <button type="button" onClick={() => importInputRef.current?.click()} disabled={importing || saving} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-700 dark:bg-slate-800 dark:text-blue-300">
                                {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                                Importar Excel
                            </button>
                            <button type="button" onClick={handleSave} disabled={saving || !dirty} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                Guardar cambios
                            </button>
                            </>
                        )}
                    </div>
                </header>

                {isLocked && !missingPeriod && (
                    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
                        <Lock size={14} />
                        El período está cerrado. La tabla se muestra en modo de consulta.
                    </div>
                )}

                {!isLocked && record && (
                    <div className="border-b border-slate-200 bg-blue-50/50 px-4 py-3 dark:border-slate-700 dark:bg-blue-950/10">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                            <div className="flex flex-wrap items-end gap-2">
                                <div className="mr-1 self-center">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                                        <WandSparkles size={14} className="text-blue-700" />
                                        Relleno rápido
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-slate-500">Define una jornada y aplícala de una vez.</p>
                                </div>
                                {([
                                    ['entryTime', 'Entrada 1'],
                                    ['breakOutTime', 'Salida 1'],
                                    ['breakInTime', 'Entrada 2'],
                                    ['exitTime', 'Salida 2']
                                ] as const).map(([field, label]) => (
                                    <label key={field} className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                        {label}
                                        <input
                                            type="time"
                                            value={quickSchedule[field]}
                                            onChange={(event) => setQuickSchedule((current) => ({ ...current, [field]: event.target.value }))}
                                            className="mt-1 block h-8 w-[106px] rounded-md border border-slate-300 bg-white px-2 font-mono text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                        />
                                    </label>
                                ))}
                                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    Descanso
                                    <input type="number" min="0" step="0.25" value={quickSchedule.discountHours} onChange={(event) => setQuickSchedule((current) => ({ ...current, discountHours: Number(event.target.value || 0) }))} className="mt-1 block h-8 w-20 rounded-md border border-slate-300 bg-white px-2 text-right font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800" />
                                </label>
                                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    Jornada
                                    <input type="number" min="0" step="0.25" value={quickSchedule.scheduledHours} onChange={(event) => setQuickSchedule((current) => ({ ...current, scheduledHours: Number(event.target.value || 0) }))} className="mt-1 block h-8 w-20 rounded-md border border-slate-300 bg-white px-2 text-right font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800" />
                                </label>
                                <button type="button" onClick={() => applyQuickSchedule(true)} className="h-8 rounded-md bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800">
                                    Rellenar días vacíos
                                </button>
                                <button type="button" onClick={() => applyQuickSchedule(false)} className="h-8 rounded-md border border-blue-300 bg-white px-3 text-xs font-semibold text-blue-800 hover:bg-blue-50 dark:border-blue-700 dark:bg-slate-800 dark:text-blue-300">
                                    Aplicar a laborables
                                </button>
                                <button type="button" onClick={clearTimeEntries} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 hover:border-rose-300 hover:text-rose-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    <Eraser size={13} />
                                    Limpiar horas
                                </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-1"><Keyboard size={13} /> Flechas y Enter para moverte</span>
                                <span className="inline-flex items-center gap-1"><ClipboardPaste size={13} /> Pega rangos desde Excel</span>
                                <span><kbd className="rounded border bg-white px-1 font-mono dark:bg-slate-800">Ctrl+D</kbd> repite la celda superior</span>
                            </div>
                        </div>
                    </div>
                )}

                {!record ? (
                    <div className="p-10 text-center">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                            {missingPeriod ? 'Este período mensual todavía no está creado.' : 'No hay un registro mensual para este empleado.'}
                        </p>
                        {missingPeriod && (
                            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                                Créalo de forma explícita desde Control General de RRHH. Al crearlo se asignarán los empleados activos y se congelarán sus códigos y tarifas del período.
                            </p>
                        )}
                    </div>
                ) : (
                    <>
                    <div className="md:hidden space-y-3 p-3">
                        {rows.map((row, index) => {
                            const highlighted = row.weekend || row.isHoliday || row.isCalendarHoliday;
                            const incomplete = rowIsIncomplete(row);
                            return (
                                <article key={row.workDate} className={`rounded-xl border p-3 shadow-sm ${highlighted ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/20' : incomplete ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'}`}>
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-slate-950 dark:text-white">{row.dayLabel} · {String(row.dayNumber).padStart(2, '0')} de {MONTHS[month - 1]}</p>
                                            <p className="text-xs text-slate-500">{highlighted ? row.holidayName || (row.weekend ? 'Fin de semana' : 'Festivo') : `${row.workedHours.toFixed(2)} h trabajadas · ${row.overtimeHours.toFixed(2)} h extra`}</p>
                                        </div>
                                        {modifiedRows.has(row.workDate) && <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-800">Pendiente</span>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <MobileTimeInput label="Entrada 1" value={row.entryTime} disabled={isLocked} onChange={(value) => updateRow(index, { entryTime: value })} />
                                        <MobileTimeInput label="Salida 1" value={row.breakOutTime} disabled={isLocked} onChange={(value) => updateRow(index, { breakOutTime: value })} />
                                        <MobileTimeInput label="Entrada 2" value={row.breakInTime} disabled={isLocked} onChange={(value) => updateRow(index, { breakInTime: value })} />
                                        <MobileTimeInput label="Salida 2" value={row.exitTime} disabled={isLocked} onChange={(value) => updateRow(index, { exitTime: value })} />
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                        <label className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800">Dieta €
                                            <input type="number" min="0" step="0.01" disabled={isLocked} value={row.dietAmount} onChange={(event) => updateRow(index, { dietAmount: Number(event.target.value || 0) })} className="mt-0.5 h-8 w-full border-0 bg-transparent p-0 font-mono text-sm font-semibold text-slate-900 outline-none focus:ring-0 disabled:text-slate-500 dark:text-white" />
                                        </label>
                                        <label className="flex min-h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                            <input type="checkbox" checked={row.isHoliday || row.isCalendarHoliday} disabled={isLocked || row.isCalendarHoliday} onChange={(event) => updateRow(index, { isHoliday: event.target.checked })} className="h-5 w-5 rounded border-slate-300 text-rose-600" /> Festivo
                                        </label>
                                    </div>
                                    <input type="text" disabled={isLocked} value={row.notes} onChange={(event) => updateRow(index, { notes: event.target.value })} placeholder="Añadir observación…" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800" />
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setObraModalDate(row.workDate)}
                                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                                        >
                                            <HardHat size={13} /> Imputar a obra
                                        </button>
                                        {obraDayHours[row.workDate] != null && (
                                            <span className="text-[10px] font-semibold text-slate-500">
                                                {obraDayHours[row.workDate].toFixed(2)} h imputadas
                                            </span>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                    <div className="hidden max-h-[620px] overflow-auto md:block">
                        <div className="sticky left-0 z-10 flex min-w-[1260px] items-center justify-between gap-4 border-b border-slate-200 bg-white px-3 py-2 text-[11px] dark:border-slate-700 dark:bg-slate-900">
                            <div className="flex items-center gap-4">
                                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-white ring-1 ring-slate-300" />Dato editable</span>
                                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-slate-200" />Cálculo automático</span>
                                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-rose-200" />Fin de semana o festivo</span>
                                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-200" />Marcaje incompleto</span>
                            </div>
                            <strong className={incompleteDays ? 'text-amber-700' : 'text-emerald-700'}>
                                {incompleteDays ? `${incompleteDays} día${incompleteDays === 1 ? '' : 's'} por revisar` : 'Marcajes completos'}
                            </strong>
                        </div>
                        <table
                            className="w-full min-w-[1260px] border-separate border-spacing-0 text-xs"
                            onKeyDown={handleGridKeyDown}
                            onPaste={handleGridPaste}
                        >
                            <thead className="sticky top-0 z-20 bg-slate-800 text-white shadow-sm">
                                <tr className="h-7 bg-slate-950 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                                    <th colSpan={2} className="sticky left-0 z-30 border-r border-slate-700 bg-slate-950 px-2 text-left">Calendario</th>
                                    <th colSpan={4} className="border-r border-slate-700 px-2 text-center">Jornada registrada</th>
                                    <th colSpan={5} className="border-r border-slate-700 px-2 text-center">Cálculos de horas</th>
                                    <th colSpan={2} className="border-r border-slate-700 px-2 text-center">Variables</th>
                                    <th className="px-2 text-center">Revisión</th>
                                    <th className="px-2 text-center">Obra</th>
                                </tr>
                                <tr>
                                    {[
                                        ['Día', 'w-14'], ['Fecha', 'w-24'], ['Entrada 1', 'w-24'], ['Salida 1', 'w-24'],
                                        ['Entrada 2', 'w-24'], ['Salida 2', 'w-24'], ['H. trabaj.', 'w-20'], ['Descanso', 'w-20'],
                                        ['H. jornada', 'w-20'], ['H. extra', 'w-20'], ['H. ext. fest.', 'w-24'], ['Dieta €', 'w-20'],
                                        ['Festivo', 'w-16'], ['Observaciones', 'min-w-64'], ['Obra', 'w-36']
                                    ].map(([label, width], index) => (
                                        <th key={label} className={`h-10 border-b border-r border-slate-600 px-2 text-left font-semibold uppercase tracking-wide ${width} ${index < 2 ? `sticky ${index === 0 ? 'left-0' : 'left-14'} z-30 bg-slate-800` : ''}`}>
                                            {label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => {
                                    const highlighted = row.weekend || row.isHoliday || row.isCalendarHoliday;
                                    const incomplete = rowIsIncomplete(row);
                                    const rowBackground = highlighted
                                        ? 'bg-rose-50 dark:bg-rose-950/20'
                                        : incomplete
                                            ? 'bg-amber-50 dark:bg-amber-950/20'
                                            : 'bg-white dark:bg-slate-900';
                                    return (
                                        <tr key={row.workDate} className={`${rowBackground} ${modifiedRows.has(row.workDate) ? 'outline outline-1 -outline-offset-1 outline-blue-300 dark:outline-blue-700' : ''} hover:bg-blue-50/70 dark:hover:bg-blue-950/20`}>
                                            <td title={row.holidayName || undefined} className={`sticky left-0 z-10 h-9 border-b border-r border-slate-200 px-2 font-semibold ${rowBackground} ${highlighted ? 'text-rose-700' : 'text-slate-600'} dark:border-slate-700`}>
                                                <span className="flex items-center gap-1">
                                                    {modifiedRows.has(row.workDate) && <span className="h-2 w-2 rounded-full bg-blue-600" title="Fila modificada sin guardar" />}
                                                    {row.dayLabel}
                                                    {incomplete && <AlertTriangle size={12} className="text-amber-600" aria-label="Marcaje incompleto" />}
                                                    {row.isCalendarHoliday && <CalendarDays size={12} className="text-rose-600" aria-label={row.holidayName || 'Festivo del calendario'} />}
                                                </span>
                                            </td>
                                            <td className={`sticky left-14 z-10 h-9 border-b border-r border-slate-200 px-2 font-mono font-medium ${rowBackground} dark:border-slate-700`}>
                                                {String(row.dayNumber).padStart(2, '0')}/{String(month).padStart(2, '0')}/{year}
                                            </td>
                                            {(['entryTime', 'breakOutTime', 'breakInTime', 'exitTime'] as const).map((field) => (
                                                <td key={field} className="border-b border-r border-slate-200 p-0 dark:border-slate-700">
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        disabled={isLocked}
                                                        value={row[field]}
                                                        onChange={(event) => updateRow(index, { [field]: event.target.value })}
                                                        onBlur={(event) => {
                                                            const normalized = normalizeTimeInput(event.target.value);
                                                            if (event.target.value && !normalized) {
                                                                toast.error('Hora no válida. Usa 08:00 o escribe 800.');
                                                            }
                                                            updateRow(index, { [field]: normalized });
                                                        }}
                                                        placeholder="00:00"
                                                        aria-label={`${field} ${row.workDate}`}
                                                        data-grid-row={index}
                                                        data-grid-col={(['entryTime', 'breakOutTime', 'breakInTime', 'exitTime'] as const).indexOf(field)}
                                                        className="h-8 w-full border-0 bg-transparent px-1 font-mono text-xs outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-500 disabled:cursor-not-allowed dark:focus:bg-blue-950/40"
                                                    />
                                                </td>
                                            ))}
                                            <td className="border-b border-r border-slate-200 bg-slate-50 px-2 text-right font-mono font-semibold dark:border-slate-700 dark:bg-slate-800">
                                                {row.workedHours.toFixed(2)}
                                            </td>
                                            <td className="border-b border-r border-slate-200 p-0 dark:border-slate-700">
                                                <NumericCell value={row.discountHours} onChange={(value) => updateRow(index, { discountHours: value })} disabled={isLocked} ariaLabel={`Descanso ${row.workDate}`} rowIndex={index} columnIndex={5} />
                                            </td>
                                            <td className="border-b border-r border-slate-200 p-0 dark:border-slate-700">
                                                <NumericCell value={row.scheduledHours} onChange={(value) => updateRow(index, { scheduledHours: value })} disabled={isLocked} ariaLabel={`Jornada ${row.workDate}`} rowIndex={index} columnIndex={6} />
                                            </td>
                                            <td className={`border-b border-r border-slate-200 px-2 text-right font-mono font-semibold dark:border-slate-700 ${row.overtimeHours < 0 ? 'text-rose-700' : 'text-slate-800 dark:text-slate-100'}`}>
                                                {row.overtimeHours.toFixed(2)}
                                            </td>
                                            <td className="border-b border-r border-slate-200 px-2 text-right font-mono font-semibold text-rose-700 dark:border-slate-700">
                                                {row.holidayOvertimeHours.toFixed(2)}
                                            </td>
                                            <td className="border-b border-r border-slate-200 p-0 dark:border-slate-700">
                                                <NumericCell value={row.dietAmount} onChange={(value) => updateRow(index, { dietAmount: value })} disabled={isLocked} step={0.01} ariaLabel={`Dieta ${row.workDate}`} rowIndex={index} columnIndex={9} />
                                            </td>
                                            <td className="border-b border-r border-slate-200 text-center dark:border-slate-700">
                                                <input
                                                    type="checkbox"
                                                    checked={row.isHoliday || row.isCalendarHoliday}
                                                    disabled={isLocked || row.isCalendarHoliday}
                                                    onChange={(event) => updateRow(index, { isHoliday: event.target.checked })}
                                                    aria-label={row.isCalendarHoliday ? `${row.holidayName || 'Festivo'} desde el calendario` : `Festivo ${row.workDate}`}
                                                    title={row.isCalendarHoliday ? `${row.holidayName || 'Festivo'} · marcado desde el calendario` : 'Marcar festivo manualmente'}
                                                    data-grid-row={index}
                                                    data-grid-col={10}
                                                    className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 disabled:opacity-100"
                                                />
                                            </td>
                                            <td className="border-b border-slate-200 p-0 dark:border-slate-700">
                                                <input type="text" disabled={isLocked} value={row.notes} onChange={(event) => updateRow(index, { notes: event.target.value })} aria-label={`Observaciones ${row.workDate}`} data-grid-row={index} data-grid-col={11} placeholder="Añadir nota…" className="h-8 w-full min-w-64 border-0 bg-transparent px-2 text-xs outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-500 disabled:cursor-not-allowed dark:focus:bg-blue-950/40" />
                                            </td>
                                            <td className="border-b border-slate-200 px-2 dark:border-slate-700">
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setObraModalDate(row.workDate)}
                                                        title="Imputar horas de este día a una obra"
                                                        className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                                                    >
                                                        <HardHat size={12} /> Imputar
                                                    </button>
                                                    {obraDayHours[row.workDate] != null && (
                                                        <span className="font-mono text-[10px] font-semibold text-slate-500" title="Horas imputadas a obras este día">
                                                            {obraDayHours[row.workDate].toFixed(2)}h
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="sticky bottom-0 z-20 bg-slate-800 text-white">
                                <tr className="h-10 font-semibold">
                                    <td colSpan={6} className="sticky left-0 border-r border-slate-600 bg-slate-800 px-3 text-right uppercase tracking-wide">Totales del mes</td>
                                    <td className="border-r border-slate-600 px-2 text-right font-mono">{totals.worked.toFixed(2)}</td>
                                    <td colSpan={2} className="border-r border-slate-600" />
                                    <td className="border-r border-slate-600 px-2 text-right font-mono">{totals.overtime.toFixed(2)}</td>
                                    <td className="border-r border-slate-600 px-2 text-right font-mono">{totals.holiday.toFixed(2)}</td>
                                    <td className="border-r border-slate-600 px-2 text-right font-mono">{totals.diets.toFixed(2)} €</td>
                                    <td colSpan={3} />
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                            <HardHat size={13} className="text-amber-500" /> Horas imputadas a obras
                        </span>
                        {obraMonthProjects.length === 0 ? (
                            <span className="text-xs text-slate-400">Ninguna este mes</span>
                        ) : (
                            obraMonthProjects.map((project) => (
                                <span key={`${project.code}-${project.name}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    {project.name} <strong className="font-mono">{project.hours.toFixed(2)}h</strong>
                                </span>
                            ))
                        )}
                        <span className="ml-auto text-[11px] text-slate-500">
                            Total imputado: <strong className="font-mono text-slate-800 dark:text-slate-100">{obraMonthProjects.reduce((sum, project) => sum + project.hours, 0).toFixed(2)}h</strong>
                            <span className="mx-1">·</span>
                            Trabajadas: <strong className="font-mono">{totals.worked.toFixed(2)}h</strong>
                        </span>
                    </div>
                    </>
                )}
                {importPreview && (
                    <div className="border-t border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/30">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-semibold text-blue-950 dark:text-blue-100">Vista previa: {importPreview.entries.length} días de la hoja {importPreview.sheetName}</p>
                                <p className="text-xs text-blue-800 dark:text-blue-200">Se importarán las cuatro horas y las observaciones del mes abierto. Los demás días se conservarán.</p>
                                {importPreview.warnings.length > 0 && <p className="mt-1 text-xs font-medium text-amber-700">{importPreview.warnings.join(' ')}</p>}
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => { setImportPreview(null); setImportFile(null); }} disabled={importing} className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700">Cancelar</button>
                                <button type="button" onClick={() => void confirmImport()} disabled={importing} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-700 px-3 text-xs font-semibold text-white disabled:opacity-50">{importing && <Loader2 size={13} className="animate-spin" />} Aplicar importación</button>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {record && (
                <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-3">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Datos para la liquidación mensual</h4>
                        <p className="text-xs text-slate-500">Las horas y dietas proceden automáticamente de la tabla diaria.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            ['overtimeRate', 'Precio hora extra', '0.01'],
                            ['holidayOvertimeRate', 'Precio hora festiva', '0.01'],
                            ['positiveVariable', 'Variable positiva', '0.01'],
                            ['negativeVariable', 'Variable negativa', '0.01']
                        ].map(([field, label, step]) => (
                            <label key={field} className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                {label}
                                <input type="number" min="0" step={step} disabled={isLocked} value={Number(record[field as keyof PayrollRecord] || 0)} onChange={(event) => updateRecordField(field as keyof PayrollRecord, event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-800" />
                            </label>
                        ))}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            Observaciones del mes
                            <textarea rows={2} disabled={isLocked} value={record.observations || ''} onChange={(event) => updateRecordField('observations', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-800" />
                        </label>
                        <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">
                            <div><span className="block text-slate-500">Horas extra</span><strong>{totals.overtime.toFixed(2)} h</strong></div>
                            <div><span className="block text-slate-500">Horas festivas</span><strong>{totals.holiday.toFixed(2)} h</strong></div>
                            <div><span className="block text-slate-500">Importe horas</span><strong>{Number(record.totalOvertimeAmount || 0).toFixed(2)} €</strong></div>
                        </div>
                    </div>
                </section>
            )}
            {record && (
                <aside className="sticky bottom-0 z-30 grid gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white shadow-2xl safe-bottom xl:grid-cols-[1fr_auto] xl:items-center">
                    <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs xl:grid-cols-6">
                        <div><span className="block text-slate-400">Trabajadas</span><strong className="font-mono text-sm">{totals.worked.toFixed(2)} h</strong></div>
                        <div><span className="block text-slate-400">Planificadas</span><strong className="font-mono text-sm">{totals.scheduled.toFixed(2)} h</strong></div>
                        <div><span className="block text-slate-400">Diferencia</span><strong className={`font-mono text-sm ${hourDifference < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{hourDifference.toFixed(2)} h</strong></div>
                        <div><span className="block text-slate-400">H. extra</span><strong className="font-mono text-sm">{totals.overtime.toFixed(2)} h</strong></div>
                        <div><span className="block text-slate-400">H. festivas</span><strong className="font-mono text-sm">{totals.holiday.toFixed(2)} h</strong></div>
                        <div><span className="block text-slate-400">Dietas</span><strong className="font-mono text-sm">{totals.diets.toFixed(2)} €</strong></div>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                        <span className={`text-xs font-semibold ${incompleteDays || emptyWorkingDays ? 'text-amber-300' : 'text-emerald-300'}`}>
                            {incompleteDays} incompletos · {emptyWorkingDays} laborables vacíos
                        </span>
                        {!isLocked && (
                            <button type="button" onClick={handleSave} disabled={saving || !dirty} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold hover:bg-blue-500 disabled:opacity-40">
                                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                Guardar mes
                            </button>
                        )}
                    </div>
                </aside>
            )}

            <ObraHoursModal
                open={obraModalDate !== null}
                onClose={() => setObraModalDate(null)}
                employeeId={employeeId}
                date={obraModalDate || ''}
                defaultHours={obraModalDate ? (rows.find((row) => row.workDate === obraModalDate)?.workedHours || 0) : 0}
                onSaved={() => void refreshObraWork()}
            />
        </div>
    );
}
