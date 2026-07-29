import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import { EditableTable, type Column } from '../components/ui/EditableTable';
import { employeeScheduleApi, type MonthSummary, type ScheduleDay } from '../api/employeeSchedule';
import { useAuth } from '../contexts/AuthContext';
import { computeDay } from '../utils/scheduleCalc';

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const WEEKDAYS = ['Do.', 'Lu.', 'Ma.', 'Mi.', 'Ju.', 'Vi.', 'Sá.'];

function isoToDate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

function dateToIso(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export default function EmployeeSchedulePage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const today = new Date();
    const [year, setYear] = useState(today.getUTCFullYear());
    const [month, setMonth] = useState(today.getUTCMonth() + 1);
    const [summary, setSummary] = useState<MonthSummary | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await employeeScheduleApi.getMonth(id, year, month);
            setSummary(res.data);
        } catch (e) {
            toast.error('Error al cargar el horario');
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }, [id, year, month]);

    useEffect(() => { load(); }, [load]);

    // ─── Save (debounced per-row on blur) ────────────────────────────
    const handleSave = useCallback(
        async (rk: string | number, day: ScheduleDay) => {
            if (!id) return;
            await employeeScheduleApi.upsertDay(id, {
                date: day.date,
                entry1: day.entry1,
                exit1: day.exit1,
                entry2: day.entry2,
                exit2: day.exit2,
                discountMin: day.discountMin,
                notes: day.notes,
            });
        },
        [id],
    );

    // ─── Columns ─────────────────────────────────────────────────────
    const columns: Column<ScheduleDay>[] = useMemo(() => [
        {
            key: 'date',
            header: 'Día',
            type: 'readonly',
            width: '60px',
            render: (_v, row) => {
                const d = isoToDate(row.date);
                return (
                    <div className="flex flex-col">
                        <span className="text-xs">{WEEKDAYS[d.getUTCDay()]}</span>
                        <span className="text-xs font-bold">{d.getUTCDate()}</span>
                    </div>
                );
            },
        },
        {
            key: 'entry1',
            header: 'E1',
            type: 'text',
            width: '70px',
            validate: (v) => (v && !/^\d{1,2}:\d{2}$/.test(String(v)) ? 'HH:mm' : null),
        },
        {
            key: 'exit1',
            header: 'S1',
            type: 'text',
            width: '70px',
            validate: (v) => (v && !/^\d{1,2}:\d{2}$/.test(String(v)) ? 'HH:mm' : null),
        },
        {
            key: 'entry2',
            header: 'E2',
            type: 'text',
            width: '70px',
            validate: (v) => (v && !/^\d{1,2}:\d{2}$/.test(String(v)) ? 'HH:mm' : null),
        },
        {
            key: 'exit2',
            header: 'S2',
            type: 'text',
            width: '70px',
            validate: (v) => (v && !/^\d{1,2}:\d{2}$/.test(String(v)) ? 'HH:mm' : null),
        },
        {
            key: 'discountMin',
            header: 'Desc.',
            type: 'number',
            width: '70px',
            decimals: 0,
            align: 'right',
            render: (v) => <span className="text-xs">{(v as number) ?? 0} min</span>,
        },
        {
            key: 'hoursWorked',
            header: 'H. TRAB',
            type: 'readonly',
            width: '80px',
            render: (v, row) => {
                // Re-calculamos en cliente para feedback en vivo
                const live = computeDay(row as ScheduleDay, {
                    isHoliday: row.isHoliday,
                    holidayName: row.holidayName,
                });
                return <span className="font-mono">{live.hoursWorked.toFixed(2)}</span>;
            },
        },
        {
            key: 'hoursExtra',
            header: 'H. EXT',
            type: 'readonly',
            width: '80px',
            render: (v, row) => {
                const live = computeDay(row as ScheduleDay, {
                    isHoliday: row.isHoliday,
                    holidayName: row.holidayName,
                });
                const cls = live.hoursExtra > 0 ? 'text-amber-600 font-bold' : 'text-slate-400';
                return <span className={`font-mono ${cls}`}>{live.hoursExtra.toFixed(2)}</span>;
            },
        },
        {
            key: 'hoursExtraFestive',
            header: 'H. EXT F',
            type: 'readonly',
            width: '80px',
            render: (v, row) => {
                const live = computeDay(row as ScheduleDay, {
                    isHoliday: row.isHoliday,
                    holidayName: row.holidayName,
                });
                const cls = live.hoursExtraFestive > 0 ? 'text-rose-600 font-bold' : 'text-slate-400';
                return <span className={`font-mono ${cls}`}>{live.hoursExtraFestive.toFixed(2)}</span>;
            },
        },
        {
            key: 'notes',
            header: 'Obs.',
            type: 'text',
            width: 'minmax(180px, 1fr)',
        },
    ], []);

    // ─── Group by week ──────────────────────────────────────────────
    const groupByWeek = useCallback((d: ScheduleDay): string => {
        const date = isoToDate(d.date);
        // Week number (rough): Monday as start
        const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
        const dayOfMonth = date.getUTCDate();
        const firstWeekday = start.getUTCDay() === 0 ? 7 : start.getUTCDay();
        const offset = (firstWeekday - 1) + (dayOfMonth - 1);
        const week = Math.floor(offset / 7) + 1;
        return `Semana ${week}`;
    }, []);

    // ─── Sort by date (asc) — backend already does, but be safe ──
    const rows = useMemo(() => {
        if (!summary) return [];
        return [...summary.days].sort((a, b) => a.date.localeCompare(b.date));
    }, [summary]);

    return (
        <div className="space-y-4 p-4 md:p-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/employees/${id}`)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Volver al empleado"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                            <Calendar size={22} className="text-indigo-500" />
                            Horario · {MONTHS[month - 1]} {year}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Introduce los turnos. Las horas se calculan automáticamente (incluye festivos).
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    >
                        {MONTHS.map((m, i) => (
                            <option key={i + 1} value={i + 1}>{m}</option>
                        ))}
                    </select>
                    <input
                        type="number"
                        value={year}
                        min={2000}
                        max={2100}
                        onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
                        className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                    {loading && <Loader2 size={18} className="animate-spin text-slate-400" />}
                </div>
            </header>

            {!summary ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                    {loading ? 'Cargando…' : 'Sin datos para este mes.'}
                </div>
            ) : (
                <EditableTable<ScheduleDay>
                    rows={rows}
                    columns={columns}
                    rowKey={(d) => d.date}
                    onSave={handleSave}
                    groupBy={groupByWeek}
                    totals={{
                        date: 'TOTAL',
                        hoursWorked: summary.totalWorked,
                        hoursExtra: summary.totalExtra,
                        hoursExtraFestive: summary.totalExtraFestive,
                    } as Partial<Record<string, string | number>>}
                    saveDelayMs={500}
                    readOnly={!user}
                    emptyMessage={`Sin entradas para ${MONTHS[month - 1]} ${year}.`}
                />
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <strong>Leyenda:</strong>{' '}
                <span className="font-mono text-rose-600 font-bold">rojo</span> = horas extra en festivo/finde,{' '}
                <span className="font-mono text-amber-600 font-bold">ámbar</span> = horas extra en laborable.{' '}
                La jornada estándar es 8h con 30 min de descuento por defecto (configurable por empleado).
            </div>
        </div>
    );
}
