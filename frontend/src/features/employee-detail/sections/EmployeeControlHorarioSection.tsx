import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../../api/client';
import { useApiUnwrap } from '../../../hooks/useApiUnwrap';
import { getEmployeeVacations, normalizeDailyRowsForSave } from './employeeControlHorarioForm';
import type { AbsenceInfo } from './employeeControlHorarioForm';
import ObraHoursModal from '../components/ObraHoursModal';
import { ControlHorarioHeader } from './control-horario/ControlHorarioHeader';
import { ControlHorarioGrid } from './control-horario/ControlHorarioGrid';
import { SettlementSummary } from './control-horario/SettlementSummary';
import { ImportPreviewPanel } from './control-horario/ImportPreviewPanel';
import {
    aggregateObraWork,
    buildRows,
    dateKey,
    EDITABLE_GRID_COLUMNS,
    EDITABLE_STATUSES,
    getCalendarHolidays,
    GRID_COLUMNS,
    MONTHS,
    parsePastedValue,
    recalculateRow,
    rowHasTimes,
    rowIsIncomplete
} from './control-horario/types';
import type {
    ApiEnvelope,
    CalendarEventApi,
    ControlHorarioTotals,
    DailyRow,
    EmployeeRecordResponse,
    ObraWorkEntryApi,
    PayrollRecord,
    QuickSchedule,
    TimeSheetImportPreview
} from './control-horario/types';

interface EmployeeControlHorarioSectionProps {
    employeeId: string;
}

export function EmployeeControlHorarioSection({ employeeId }: EmployeeControlHorarioSectionProps) {
    const unwrap = useApiUnwrap();
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [initializingPeriod, setInitializingPeriod] = useState(false);
    const [periodStatus, setPeriodStatus] = useState('DRAFT');
    const [record, setRecord] = useState<PayrollRecord | null>(null);
    const [rows, setRows] = useState<DailyRow[]>([]);
    const [calendarHolidays, setCalendarHolidays] = useState<Map<string, string>>(new Map());
    const [vacationsMap, setVacationsMap] = useState<Map<string, AbsenceInfo>>(new Map());
    const [dirty, setDirty] = useState(false);
    const [modifiedRows, setModifiedRows] = useState<Set<string>>(new Set());
    const [monthlyFieldsDirty, setMonthlyFieldsDirty] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [saveError, setSaveError] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<TimeSheetImportPreview | null>(null);
    const [gridExpanded, setGridExpanded] = useState(false);
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
            const data = unwrap<EmployeeRecordResponse>(recordResponse);
            const calendarEvents = unwrap<CalendarEventApi[]>(calendarResponse);
            const holidays = getCalendarHolidays(calendarEvents, year, month);
            const vacMap = getEmployeeVacations(data.vacations || [], year, month);
            setCalendarHolidays(holidays);
            setVacationsMap(vacMap);
            setPeriodStatus(data.periodStatus || 'DRAFT');
            setRecord(data.record);
            setRows(buildRows(year, month, data.record?.dailyEntries || [], holidays, vacMap));

            // Horas imputadas a obras del mes (para el indicador por día y el resumen por obra)
            const { dayHours, monthProjects } = aggregateObraWork(unwrap<ObraWorkEntryApi[]>(workResponse) || []);
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
    }, [employeeId, month, unwrap, year]);

    const handleInitPeriod = async () => {
        setInitializingPeriod(true);
        try {
            await api.post(`/payroll/control/employee/${employeeId}/init-period`, { year, month });
            toast.success(`Período de ${MONTHS[month - 1]} ${year} inicializado`);
            await loadRecord();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'No se pudo inicializar el período mensual'));
        } finally {
            setInitializingPeriod(false);
        }
    };

    const handleRestoreOvertimeAmount = async () => {
        if (!record?.id || isLocked) return;
        try {
            const res = await api.post<ApiEnvelope<PayrollRecord>>(`/payroll/control/records/${record.id}/restore`, {
                fieldName: 'totalOvertimeAmount',
                expectedVersion: record.version
            });
            const updated = unwrap<PayrollRecord>(res);
            setRecord(updated);
            toast.success('Cálculo automático de importe de horas restaurado');
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'No se pudo restaurar el cálculo automático'));
        }
    };

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
            const { dayHours, monthProjects } = aggregateObraWork(unwrap<ObraWorkEntryApi[]>(workResponse) || []);
            setObraDayHours(dayHours);
            setObraMonthProjects(monthProjects);
        } catch {
            // Silencioso: no interrumpir el control horario si falla el refresco
        }
    }, [employeeId, month, unwrap, year]);

    useEffect(() => {
        const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
            if (!dirty) return;
            event.preventDefault();
        };
        window.addEventListener('beforeunload', warnBeforeLeaving);
        return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
    }, [dirty]);

    // Vista de pantalla completa: bloquea el scroll del fondo y cierra con Escape.
    useEffect(() => {
        if (!gridExpanded) return;
        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setGridExpanded(false);
        };
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [gridExpanded]);

    const totals = useMemo(() => rows.reduce((total, row) => ({
        worked: total.worked + row.workedHours,
        discount: total.discount + row.discountHours,
        scheduled: total.scheduled + row.scheduledHours,
        overtime: total.overtime + Math.max(row.overtimeHours, 0),
        holiday: total.holiday + row.holidayOvertimeHours,
        diets: total.diets + row.dietAmount
    }), { worked: 0, discount: 0, scheduled: 0, overtime: 0, holiday: 0, diets: 0 }), [rows]) as ControlHorarioTotals;
    const incompleteDays = useMemo(() => rows.filter(rowIsIncomplete).length, [rows]);
    const vacationDaysCount = useMemo(() => rows.filter((row) => row.isVacation).length, [rows]);
    const emptyWorkingDays = useMemo(() => rows.filter((row) => (
        !row.weekend && !row.isHoliday && !row.isCalendarHoliday && !row.isVacation && !rowHasTimes(row)
    )).length, [rows]);
    const hourDifference = totals.worked - totals.scheduled;
    // Cuadre mensual trabajadas ↔ imputadas a obras (indicador y avisos)
    const obraHoursTotal = useMemo(
        () => obraMonthProjects.reduce((sum, project) => sum + project.hours, 0),
        [obraMonthProjects]
    );
    const obraBalance = totals.worked - obraHoursTotal;

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
            if (row.weekend || row.isHoliday || row.isCalendarHoliday || row.isVacation || (onlyEmpty && rowHasTimes(row))) return row;
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
            .filter((row) => !row.weekend && !row.isHoliday && !row.isCalendarHoliday && !row.isVacation && (!onlyEmpty || !rowHasTimes(row)))
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
            // Un único PUT: detalle diario + datos mensuales se guardan juntos
            // en la misma transacción (antes eran dos llamadas encadenadas con
            // control de versión entre medias).
            const response = await api.put<ApiEnvelope<PayrollRecord>>(
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
                    })),
                    overtimeRate: Number(record.overtimeRate || 0),
                    holidayOvertimeRate: Number(record.holidayOvertimeRate || 0),
                    positiveVariable: Number(record.positiveVariable || 0),
                    negativeVariable: Number(record.negativeVariable || 0),
                    irpf: Number(record.irpf || 0),
                    tgss: Number(record.tgss || 0),
                    gestoriaCode: record.gestoriaCode || null,
                    observations: record.observations || ''
                }
            );
            const updated = unwrap<PayrollRecord>(response);
            setRecord(updated);
            setRows(buildRows(year, month, updated.dailyEntries || [], calendarHolidays, vacationsMap));
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

    const handleExportObraHours = async () => {
        try {
            const blob = await api.get<Blob>('/payroll/control/obra-hours/export', {
                params: { year, month, employeeId },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `parte_obras_${year}_${String(month).padStart(2, '0')}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Parte de horas por obra descargado');
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'No se pudo generar el parte de obras'));
        }
    };

    const createImportForm = (file: File, includeVersion = false, sheetName?: string) => {
        const form = new FormData();
        form.append('file', file);
        form.append('year', String(year));
        form.append('month', String(month));
        if (sheetName) form.append('sheetName', sheetName);
        if (includeVersion && record) form.append('expectedVersion', String(record.version));
        return form;
    };

    const previewImport = async (file: File, sheetName?: string) => {
        if (!record || isLocked) return;
        setImporting(true);
        setImportPreview(null);
        try {
            const response = await api.post<ApiEnvelope<TimeSheetImportPreview>>(
                `/payroll/control/employee/${employeeId}/daily/import-preview`,
                createImportForm(file, false, sheetName)
            );
            setImportFile(file);
            setImportPreview(unwrap<TimeSheetImportPreview>(response));
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
                createImportForm(importFile, true, importPreview.sheetName)
            );
            const result = unwrap<{ record: PayrollRecord; importedDays: number; warnings: string[] }>(response);
            setRecord(result.record);
            setRows(buildRows(year, month, result.record.dailyEntries || [], calendarHolidays, vacationsMap));
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
            <section
                role={gridExpanded ? 'dialog' : undefined}
                aria-modal={gridExpanded ? true : undefined}
                aria-label={gridExpanded ? `Control horario de ${MONTHS[month - 1]} ${year} en pantalla completa` : undefined}
                className={`overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${gridExpanded ? 'fixed inset-0 z-[100] flex min-h-0 flex-col rounded-none border-0 shadow-none' : ''}`}
            >
                <ControlHorarioHeader
                    year={year}
                    month={month}
                    currentYear={now.getFullYear()}
                    vacationDaysCount={vacationDaysCount}
                    gridExpanded={gridExpanded}
                    saveError={saveError}
                    saved={saved}
                    dirty={dirty}
                    pendingDays={modifiedRows.size}
                    monthlyFieldsDirty={monthlyFieldsDirty}
                    lastSavedAt={lastSavedAt}
                    isLocked={isLocked}
                    missingPeriod={missingPeriod}
                    importing={importing}
                    saving={saving}
                    quickSchedule={quickSchedule}
                    record={record}
                    onChangePeriod={changePeriod}
                    onSelectPeriod={selectPeriod}
                    onToggleFullscreen={() => setGridExpanded((current) => !current)}
                    onImportFile={(file) => void previewImport(file)}
                    onSave={() => void handleSave()}
                    onQuickScheduleChange={(patch) => setQuickSchedule((current) => ({ ...current, ...patch }))}
                    onApplyQuickSchedule={applyQuickSchedule}
                    onClearTimeEntries={clearTimeEntries}
                    onExportObraHours={() => void handleExportObraHours()}
                />

                {!record ? (
                    <div className="p-10 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            <CalendarDays size={24} />
                        </div>
                        <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                            {missingPeriod ? `El período de ${MONTHS[month - 1]} ${year} aún no está creado.` : 'No hay un registro mensual para este empleado.'}
                        </p>
                        {missingPeriod && (
                            <>
                            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                                Puedes inicializar este mes para cargar los partes de horas de los empleados activos y aplicar automáticamente las tarifas y códigos de gestoría correspondientes.
                            </p>
                            <button
                                type="button"
                                onClick={handleInitPeriod}
                                disabled={initializingPeriod}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
                            >
                                {initializingPeriod ? <Loader2 size={16} className="animate-spin" /> : <CalendarDays size={16} />}
                                Inicializar período de {MONTHS[month - 1]} {year}
                            </button>
                            </>
                        )}
                    </div>
                ) : (
                    <ControlHorarioGrid
                        year={year}
                        month={month}
                        rows={rows}
                        isLocked={isLocked}
                        modifiedRows={modifiedRows}
                        incompleteDays={incompleteDays}
                        totals={totals}
                        gridExpanded={gridExpanded}
                        obraDayHours={obraDayHours}
                        obraMonthProjects={obraMonthProjects}
                        obraHoursTotal={obraHoursTotal}
                        onUpdateRow={updateRow}
                        onGridKeyDown={handleGridKeyDown}
                        onGridPaste={handleGridPaste}
                        onOpenObraModal={(date) => {
                            if (rows.find((row) => row.workDate === date)?.isVacation) {
                                toast.error('No se pueden imputar horas a obra en un día de ausencia (vacaciones, baja médica o permiso).');
                                return;
                            }
                            setObraModalDate(date);
                        }}
                    />
                )}

                {importPreview && (
                    <ImportPreviewPanel
                        preview={importPreview}
                        importing={importing}
                        onSelectSheet={(sheetName) => { if (importFile) void previewImport(importFile, sheetName); }}
                        onConfirm={() => void confirmImport()}
                        onCancel={() => { setImportPreview(null); setImportFile(null); }}
                    />
                )}
            </section>

            {record && (
                <SettlementSummary
                    record={record}
                    isLocked={isLocked}
                    totals={totals}
                    onUpdateField={updateRecordField}
                    onRestoreOvertimeAmount={() => void handleRestoreOvertimeAmount()}
                />
            )}

            {record && (
                <aside className="sticky bottom-0 z-30 grid gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white shadow-2xl safe-bottom xl:grid-cols-[1fr_auto] xl:items-center">
                    <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs xl:grid-cols-8">
                        <div><span className="block text-slate-400">Trabajadas</span><strong className="font-mono text-sm">{totals.worked.toFixed(2)} h</strong></div>
                        <div><span className="block text-slate-400">Planificadas</span><strong className="font-mono text-sm">{totals.scheduled.toFixed(2)} h</strong></div>
                        <div><span className="block text-slate-400">Diferencia</span><strong className={`font-mono text-sm ${hourDifference < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{hourDifference.toFixed(2)} h</strong></div>
                        <div><span className="block text-slate-400">Imputadas obra</span><strong className="font-mono text-sm">{obraHoursTotal.toFixed(2)} h</strong></div>
                        <div><span className="block text-slate-400">Sin imputar</span><strong className={`font-mono text-sm ${obraBalance < -0.5 ? 'text-rose-300' : obraBalance > 0.5 ? 'text-amber-300' : 'text-emerald-300'}`}>{obraBalance.toFixed(2)} h</strong></div>
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
