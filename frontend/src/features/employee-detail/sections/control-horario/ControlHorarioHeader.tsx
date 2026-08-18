import { useRef } from 'react';
import {
    AlertTriangle,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    ClipboardPaste,
    Clock,
    Eraser,
    FileSpreadsheet,
    Keyboard,
    Loader2,
    Lock,
    Maximize2,
    Save,
    Sun,
    Upload,
    WandSparkles,
    X
} from 'lucide-react';
import { MONTHS, type PayrollRecord, type QuickSchedule } from './types';

interface ControlHorarioHeaderProps {
    year: number;
    month: number;
    currentYear: number;
    vacationDaysCount: number;
    gridExpanded: boolean;
    saveError: boolean;
    saved: boolean;
    dirty: boolean;
    pendingDays: number;
    monthlyFieldsDirty: boolean;
    lastSavedAt: Date | null;
    isLocked: boolean;
    missingPeriod: boolean;
    importing: boolean;
    saving: boolean;
    quickSchedule: QuickSchedule;
    record: PayrollRecord | null;
    onChangePeriod: (direction: number) => void;
    onSelectPeriod: (nextYear: number, nextMonth: number) => void;
    onToggleFullscreen: () => void;
    onImportFile: (file: File) => void;
    onSave: () => void;
    onQuickScheduleChange: (patch: Partial<QuickSchedule>) => void;
    onApplyQuickSchedule: (onlyEmpty: boolean) => void;
    onClearTimeEntries: () => void;
    onExportObraHours: () => void;
}

export function ControlHorarioHeader({
    year,
    month,
    currentYear,
    vacationDaysCount,
    gridExpanded,
    saveError,
    saved,
    dirty,
    pendingDays,
    monthlyFieldsDirty,
    lastSavedAt,
    isLocked,
    missingPeriod,
    importing,
    saving,
    quickSchedule,
    record,
    onChangePeriod,
    onSelectPeriod,
    onToggleFullscreen,
    onImportFile,
    onSave,
    onQuickScheduleChange,
    onApplyQuickSchedule,
    onClearTimeEntries,
    onExportObraHours
}: ControlHorarioHeaderProps) {
    const importInputRef = useRef<HTMLInputElement>(null);

    return (
        <>
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
                        <button type="button" onClick={() => onChangePeriod(-1)} className="grid h-full w-9 place-items-center rounded-l-lg hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Mes anterior">
                            <ChevronLeft size={16} />
                        </button>
                        <select value={month} onChange={(event) => onSelectPeriod(year, Number(event.target.value))} className="h-full border-0 bg-transparent px-1 text-sm font-semibold outline-none">
                            {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
                        </select>
                        <select value={year} onChange={(event) => onSelectPeriod(Number(event.target.value), month)} className="h-full border-0 bg-transparent px-1 text-sm outline-none">
                            {Array.from({ length: 9 }, (_, index) => currentYear - 4 + index).map((value) => <option key={value}>{value}</option>)}
                        </select>
                        <button type="button" onClick={() => onChangePeriod(1)} className="grid h-full w-9 place-items-center rounded-r-lg hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Mes siguiente">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    {vacationDaysCount > 0 && (
                        <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 dark:border-red-800/80 dark:bg-red-950/40 dark:text-red-300">
                            <Sun size={14} className="text-red-600 dark:text-red-400" />
                            {vacationDaysCount} {vacationDaysCount === 1 ? 'día de ausencia' : 'días de ausencia'}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={onToggleFullscreen}
                        aria-label={gridExpanded ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
                        title={gridExpanded ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${gridExpanded ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                    >
                        {gridExpanded ? <X size={16} /> : <Maximize2 size={16} />}
                    </button>
                    <span className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ${saveError ? 'bg-rose-50 text-rose-700' : saved ? 'bg-emerald-50 text-emerald-700' : dirty ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {saveError ? <AlertTriangle size={14} /> : saved ? <Check size={14} /> : <Clock size={14} />}
                        {saveError
                            ? 'Error: cambios sin guardar'
                            : saved
                                ? `Guardado${lastSavedAt ? ` a las ${lastSavedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}`
                                : dirty
                                    ? `${pendingDays} días${monthlyFieldsDirty ? ' + datos mensuales' : ''} pendientes`
                                    : 'Sin cambios'}
                    </span>
                    <button
                        type="button"
                        onClick={onExportObraHours}
                        title="Descargar el parte mensual de horas imputadas a obras (Excel)"
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-300"
                    >
                        <FileSpreadsheet size={15} />
                        Parte de obras
                    </button>
                    {!isLocked && (
                        <>
                        <input ref={importInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) onImportFile(file);
                            event.target.value = '';
                        }} />
                        <button type="button" onClick={() => importInputRef.current?.click()} disabled={importing || saving} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-700 dark:bg-slate-800 dark:text-blue-300">
                            {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                            Importar Excel
                        </button>
                        <button type="button" onClick={onSave} disabled={saving || !dirty} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
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
                                        onChange={(event) => onQuickScheduleChange({ [field]: event.target.value })}
                                        className="mt-1 block h-8 w-[106px] rounded-md border border-slate-300 bg-white px-2 font-mono text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                    />
                                </label>
                            ))}
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Descanso
                                <input type="number" min="0" step="0.25" value={quickSchedule.discountHours} onChange={(event) => onQuickScheduleChange({ discountHours: Number(event.target.value || 0) })} className="mt-1 block h-8 w-20 rounded-md border border-slate-300 bg-white px-2 text-right font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800" />
                            </label>
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Jornada
                                <input type="number" min="0" step="0.25" value={quickSchedule.scheduledHours} onChange={(event) => onQuickScheduleChange({ scheduledHours: Number(event.target.value || 0) })} className="mt-1 block h-8 w-20 rounded-md border border-slate-300 bg-white px-2 text-right font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800" />
                            </label>
                            <button type="button" onClick={() => onApplyQuickSchedule(true)} className="h-8 rounded-md bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800">
                                Rellenar días vacíos
                            </button>
                            <button type="button" onClick={() => onApplyQuickSchedule(false)} className="h-8 rounded-md border border-blue-300 bg-white px-3 text-xs font-semibold text-blue-800 hover:bg-blue-50 dark:border-blue-700 dark:bg-slate-800 dark:text-blue-300">
                                Aplicar a laborables
                            </button>
                            <button type="button" onClick={onClearTimeEntries} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 hover:border-rose-300 hover:text-rose-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
        </>
    );
}
