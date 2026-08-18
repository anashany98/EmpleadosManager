import { AlertTriangle, CalendarDays, CheckCircle2, HardHat, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeTimeInput } from '../employeeControlHorarioForm';
import {
    MONTHS,
    rowIsIncomplete,
    type ControlHorarioTotals,
    type DailyRow
} from './types';

interface ControlHorarioGridProps {
    year: number;
    month: number;
    rows: DailyRow[];
    isLocked: boolean;
    modifiedRows: Set<string>;
    incompleteDays: number;
    totals: ControlHorarioTotals;
    gridExpanded: boolean;
    obraDayHours: Record<string, number>;
    obraMonthProjects: Array<{ code: string; name: string; hours: number }>;
    obraHoursTotal: number;
    onUpdateRow: (index: number, patch: Partial<DailyRow>) => void;
    onGridKeyDown: (event: React.KeyboardEvent<HTMLTableElement>) => void;
    onGridPaste: (event: React.ClipboardEvent<HTMLTableElement>) => void;
    onOpenObraModal: (date: string) => void;
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

/** Tolerancia (en horas) bajo la cual el cuadre trabajadas ↔ imputadas se considera correcto. */
const OBRA_BALANCE_TOLERANCE = 0.5;

/**
 * Indicador mensual del cuadre entre horas trabajadas y horas imputadas a obras.
 * Avisa en ambos sentidos: horas trabajadas sin imputar y horas imputadas de más.
 */
export function ObraBalanceIndicator({ worked, imputed }: { worked: number; imputed: number }) {
    const difference = worked - imputed;
    if (worked <= 0 && imputed <= 0) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                <CalendarDays size={12} /> Sin horas este mes
            </span>
        );
    }
    if (Math.abs(difference) <= OBRA_BALANCE_TOLERANCE) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 size={12} /> Cuadre correcto
            </span>
        );
    }
    if (difference > 0) {
        return (
            <span
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                title="Horas trabajadas que aún no se han imputado a ninguna obra. Revisa si falta imputar algún día."
            >
                <AlertTriangle size={12} /> {difference.toFixed(2)}h sin imputar a obra
            </span>
        );
    }
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            title="Se han imputado más horas a obras de las trabajadas. Revisa las imputaciones del mes."
        >
            <AlertTriangle size={12} /> {Math.abs(difference).toFixed(2)}h imputadas de más
        </span>
    );
}

export function ControlHorarioGrid({
    year,
    month,
    rows,
    isLocked,
    modifiedRows,
    incompleteDays,
    totals,
    gridExpanded,
    obraDayHours,
    obraMonthProjects,
    obraHoursTotal,
    onUpdateRow,
    onGridKeyDown,
    onGridPaste,
    onOpenObraModal
}: ControlHorarioGridProps) {
    return (
        <>
            <div className="md:hidden space-y-3 p-3">
                {rows.map((row, index) => {
                    const isVacation = row.isVacation;
                    const highlighted = row.weekend || row.isHoliday || row.isCalendarHoliday;
                    const incomplete = rowIsIncomplete(row);
                    return (
                        <article key={row.workDate} className={`rounded-xl border p-3 shadow-sm ${isVacation ? 'border-red-300 bg-red-50/90 dark:border-red-800 dark:bg-red-950/30' : highlighted ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/20' : incomplete ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'}`}>
                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                    <p className={`text-sm font-bold ${isVacation ? 'text-red-700 dark:text-red-300' : 'text-slate-950 dark:text-white'}`}>
                                        {row.dayLabel} · {String(row.dayNumber).padStart(2, '0')} de {MONTHS[month - 1]}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {isVacation
                                            ? (row.vacationReason ? `${row.vacationLabel} (${row.vacationReason})` : row.vacationLabel)
                                            : highlighted
                                                ? row.holidayName || (row.weekend ? 'Fin de semana' : 'Festivo')
                                                : `${row.workedHours.toFixed(2)} h trabajadas · ${row.overtimeHours.toFixed(2)} h extra`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {isVacation && (
                                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-300 dark:bg-red-900/60 dark:text-red-200">
                                            Vacaciones
                                        </span>
                                    )}
                                    {modifiedRows.has(row.workDate) && (
                                        <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-800">
                                            Pendiente
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <MobileTimeInput label="Entrada 1" value={row.entryTime} disabled={isLocked} onChange={(value) => onUpdateRow(index, { entryTime: value })} />
                                <MobileTimeInput label="Salida 1" value={row.breakOutTime} disabled={isLocked} onChange={(value) => onUpdateRow(index, { breakOutTime: value })} />
                                <MobileTimeInput label="Entrada 2" value={row.breakInTime} disabled={isLocked} onChange={(value) => onUpdateRow(index, { breakInTime: value })} />
                                <MobileTimeInput label="Salida 2" value={row.exitTime} disabled={isLocked} onChange={(value) => onUpdateRow(index, { exitTime: value })} />
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <label className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800">Dieta €
                                    <input type="number" min="0" step="0.01" disabled={isLocked} value={row.dietAmount} onChange={(event) => onUpdateRow(index, { dietAmount: Number(event.target.value || 0) })} className="mt-0.5 h-8 w-full border-0 bg-transparent p-0 font-mono text-sm font-semibold text-slate-900 outline-none focus:ring-0 disabled:text-slate-500 dark:text-white" />
                                </label>
                                <label className="flex min-h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    <input type="checkbox" checked={row.isHoliday || row.isCalendarHoliday} disabled={isLocked || row.isCalendarHoliday} onChange={(event) => onUpdateRow(index, { isHoliday: event.target.checked })} className="h-5 w-5 rounded border-slate-300 text-rose-600" /> Festivo
                                </label>
                            </div>
                            <input
                                type="text"
                                disabled={isLocked}
                                value={row.notes}
                                onChange={(event) => onUpdateRow(index, { notes: event.target.value })}
                                placeholder={isVacation ? row.vacationLabel : 'Añadir observación…'}
                                className={`mt-2 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:text-slate-500 ${isVacation ? 'border-red-300 bg-red-50 text-red-800 font-semibold placeholder:text-red-500 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}
                            />
                            <div className="mt-2 flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() => onOpenObraModal(row.workDate)}
                                    disabled={isVacation}
                                    title={isVacation ? 'No se pueden imputar horas a obra en un día de vacaciones' : 'Imputar horas de este día a una obra'}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
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
            <div className={gridExpanded ? 'min-h-0 flex-1 overflow-auto' : 'hidden max-h-[620px] overflow-auto md:block'}>
                <div className="sticky left-0 z-10 flex min-w-[1260px] items-center justify-between gap-4 border-b border-slate-200 bg-white px-3 py-2 text-[11px] dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-4">
                        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-white ring-1 ring-slate-300" />Dato editable</span>
                        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-slate-200" />Cálculo automático</span>
                        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-red-200 border border-red-300" />Vacaciones</span>
                        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-rose-200" />Fin de semana o festivo</span>
                        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-200" />Marcaje incompleto</span>
                    </div>
                    <strong className={incompleteDays ? 'text-amber-700' : 'text-emerald-700'}>
                        {incompleteDays ? `${incompleteDays} día${incompleteDays === 1 ? '' : 's'} por revisar` : 'Marcajes completos'}
                    </strong>
                </div>
                <table
                    className="w-full min-w-[1260px] border-separate border-spacing-0 text-xs"
                    onKeyDown={onGridKeyDown}
                    onPaste={onGridPaste}
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
                            const isVacation = row.isVacation;
                            const highlighted = row.weekend || row.isHoliday || row.isCalendarHoliday;
                            const incomplete = rowIsIncomplete(row);
                            const rowBackground = isVacation
                                ? 'bg-red-50/90 dark:bg-red-950/30'
                                : highlighted
                                    ? 'bg-rose-50 dark:bg-rose-950/20'
                                    : incomplete
                                        ? 'bg-amber-50 dark:bg-amber-950/20'
                                        : 'bg-white dark:bg-slate-900';
                            return (
                                <tr key={row.workDate} className={`${rowBackground} ${modifiedRows.has(row.workDate) ? 'outline outline-1 -outline-offset-1 outline-blue-300 dark:outline-blue-700' : ''} hover:bg-red-100/70 dark:hover:bg-red-950/50 transition-colors`}>
                                    <td title={isVacation ? (row.vacationReason ? `${row.vacationLabel}: ${row.vacationReason}` : row.vacationLabel) : (row.holidayName || undefined)} className={`sticky left-0 z-10 h-9 border-b border-r border-slate-200 px-2 font-semibold ${rowBackground} ${isVacation ? 'text-red-700 font-bold dark:text-red-300' : highlighted ? 'text-rose-700' : 'text-slate-600'} dark:border-slate-700`}>
                                        <span className="flex items-center gap-1">
                                            {modifiedRows.has(row.workDate) && <span className="h-2 w-2 rounded-full bg-blue-600" title="Fila modificada sin guardar" />}
                                            {row.dayLabel}
                                            {isVacation && (
                                                <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1 py-0.2 text-[9px] font-black tracking-tight text-red-800 border border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700" title={row.vacationReason ? `${row.vacationLabel} (${row.vacationReason})` : row.vacationLabel}>
                                                    <Sun size={10} className="shrink-0 text-red-700 dark:text-red-300" />
                                                    {row.vacationShort}
                                                </span>
                                            )}
                                            {incomplete && <AlertTriangle size={12} className="text-amber-600" aria-label="Marcaje incompleto" />}
                                            {row.isCalendarHoliday && !isVacation && <CalendarDays size={12} className="text-rose-600" aria-label={row.holidayName || 'Festivo del calendario'} />}
                                        </span>
                                    </td>
                                    <td className={`sticky left-14 z-10 h-9 border-b border-r border-slate-200 px-2 font-mono font-medium ${rowBackground} ${isVacation ? 'text-red-700 font-bold dark:text-red-300' : ''} dark:border-slate-700`}>
                                        {String(row.dayNumber).padStart(2, '0')}/{String(month).padStart(2, '0')}/{year}
                                    </td>
                                    {(['entryTime', 'breakOutTime', 'breakInTime', 'exitTime'] as const).map((field) => (
                                        <td key={field} className="border-b border-r border-slate-200 p-0 dark:border-slate-700">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                disabled={isLocked}
                                                value={row[field]}
                                                onChange={(event) => onUpdateRow(index, { [field]: event.target.value })}
                                                onBlur={(event) => {
                                                     const normalized = normalizeTimeInput(event.target.value);
                                                     if (event.target.value && !normalized) {
                                                         toast.error('Hora no válida. Usa 08:00 o escribe 800.');
                                                     }
                                                     onUpdateRow(index, { [field]: normalized });
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
                                        <NumericCell value={row.discountHours} onChange={(value) => onUpdateRow(index, { discountHours: value })} disabled={isLocked} ariaLabel={`Descanso ${row.workDate}`} rowIndex={index} columnIndex={5} />
                                    </td>
                                    <td className="border-b border-r border-slate-200 p-0 dark:border-slate-700">
                                        <NumericCell value={row.scheduledHours} onChange={(value) => onUpdateRow(index, { scheduledHours: value })} disabled={isLocked} ariaLabel={`Jornada ${row.workDate}`} rowIndex={index} columnIndex={6} />
                                    </td>
                                    <td className={`border-b border-r border-slate-200 px-2 text-right font-mono font-semibold dark:border-slate-700 ${row.overtimeHours < 0 ? 'text-rose-700' : 'text-slate-800 dark:text-slate-100'}`}>
                                        {row.overtimeHours.toFixed(2)}
                                    </td>
                                    <td className="border-b border-r border-slate-200 px-2 text-right font-mono font-semibold text-rose-700 dark:border-slate-700">
                                        {row.holidayOvertimeHours.toFixed(2)}
                                    </td>
                                    <td className="border-b border-r border-slate-200 p-0 dark:border-slate-700">
                                        <NumericCell value={row.dietAmount} onChange={(value) => onUpdateRow(index, { dietAmount: value })} disabled={isLocked} step={0.01} ariaLabel={`Dieta ${row.workDate}`} rowIndex={index} columnIndex={9} />
                                    </td>
                                    <td className="border-b border-r border-slate-200 text-center dark:border-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={row.isHoliday || row.isCalendarHoliday}
                                            disabled={isLocked || row.isCalendarHoliday}
                                            onChange={(event) => onUpdateRow(index, { isHoliday: event.target.checked })}
                                            aria-label={row.isCalendarHoliday ? `${row.holidayName || 'Festivo'} desde el calendario` : `Festivo ${row.workDate}`}
                                            title={row.isCalendarHoliday ? `${row.holidayName || 'Festivo'} · marcado desde el calendario` : 'Marcar festivo manualmente'}
                                            data-grid-row={index}
                                            data-grid-col={10}
                                            className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 disabled:opacity-100"
                                        />
                                    </td>
                                    <td className={`border-b border-slate-200 p-0 dark:border-slate-700 ${isVacation ? 'bg-red-50/70 dark:bg-red-950/40' : ''}`}>
                                        <div className="flex items-center gap-1.5 px-2">
                                            {isVacation && (
                                                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700 border border-red-300 dark:bg-red-900/60 dark:text-red-200 dark:border-red-800">
                                                    <Sun size={12} className="text-red-600 dark:text-red-400" />
                                                    Vacaciones
                                                </span>
                                            )}
                                            <input
                                                type="text"
                                                disabled={isLocked}
                                                value={row.notes}
                                                onChange={(event) => onUpdateRow(index, { notes: event.target.value })}
                                                aria-label={`Observaciones ${row.workDate}`}
                                                data-grid-row={index}
                                                data-grid-col={11}
                                                placeholder={isVacation ? row.vacationLabel : 'Añadir nota…'}
                                                className={`h-8 w-full min-w-60 border-0 bg-transparent px-1 text-xs outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-500 disabled:cursor-not-allowed dark:focus:bg-blue-950/40 ${isVacation ? 'font-semibold text-red-800 placeholder:text-red-500 dark:text-red-200' : ''}`}
                                            />
                                        </div>
                                    </td>
                                    <td className="border-b border-slate-200 px-2 dark:border-slate-700">
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => onOpenObraModal(row.workDate)}
                                                disabled={isVacation}
                                                title={isVacation ? 'No se pueden imputar horas a obra en un día de vacaciones' : 'Imputar horas de este día a una obra'}
                                                className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
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
                            <td className="border-r border-slate-600 px-2 text-right font-mono">{totals.discount.toFixed(2)}</td>
                            <td className="border-r border-slate-600 px-2 text-right font-mono">{totals.scheduled.toFixed(2)}</td>
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
                <span className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span>
                        Trabajadas: <strong className="font-mono text-slate-800 dark:text-slate-100">{totals.worked.toFixed(2)}h</strong>
                        <span className="mx-1">·</span>
                        Imputadas: <strong className="font-mono">{obraHoursTotal.toFixed(2)}h</strong>
                    </span>
                    <ObraBalanceIndicator worked={totals.worked} imputed={obraHoursTotal} />
                </span>
            </div>
        </>
    );
}
