import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, API_URL } from '../../api/client';
import {
    Circle, FileText,
    Calendar, GraduationCap, Receipt, HeartPulse,
    UserPlus, UserMinus, ShieldAlert, History, Clock, RefreshCw, Search
} from 'lucide-react';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface TimelineEvent {
    id: string;
    date: string;
    type: 'ENTRY' | 'EXIT' | 'CONTRACT' | 'PAYROLL' | 'MEDICAL' | 'VACATION' | 'TRAINING' | 'EXPENSE' | 'INCIDENT';
    title: string;
    description?: string;
    amount?: number;
    fileUrl?: string;
    category?: string;
    status?: string;
    endDate?: string;
}

interface EmployeeTimelineProps {
    employeeId: string;
}

// ── Visual config ──────────────────────────────────────────────
const TYPE_CONFIG: Record<string, {
    icon: typeof Circle;
    color: string;
    bg: string;
    ring: string;
    label: string;
}> = {
    ENTRY: {
        icon: UserPlus,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        ring: 'ring-emerald-200 dark:ring-emerald-900/50',
        label: 'Alta'
    },
    EXIT: {
        icon: UserMinus,
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-950/40',
        ring: 'ring-red-200 dark:ring-red-900/50',
        label: 'Baja'
    },
    CONTRACT: {
        icon: FileText,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        ring: 'ring-blue-200 dark:ring-blue-900/50',
        label: 'Contrato'
    },
    PAYROLL: {
        icon: Receipt,
        color: 'text-indigo-600 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-950/40',
        ring: 'ring-indigo-200 dark:ring-indigo-900/50',
        label: 'Nómina'
    },
    MEDICAL: {
        icon: HeartPulse,
        color: 'text-rose-600 dark:text-rose-400',
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        ring: 'ring-rose-200 dark:ring-rose-900/50',
        label: 'Médico'
    },
    VACATION: {
        icon: Calendar,
        color: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-50 dark:bg-orange-950/40',
        ring: 'ring-orange-200 dark:ring-orange-900/50',
        label: 'Ausencia'
    },
    TRAINING: {
        icon: GraduationCap,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-950/40',
        ring: 'ring-purple-200 dark:ring-purple-900/50',
        label: 'Formación'
    },
    EXPENSE: {
        icon: Receipt,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        ring: 'ring-amber-200 dark:ring-amber-900/50',
        label: 'Gasto'
    },
    INCIDENT: {
        icon: ShieldAlert,
        color: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-50 dark:bg-slate-800/50',
        ring: 'ring-slate-200 dark:ring-slate-700',
        label: 'Incidencia'
    },
};

function getConfig(type: string) {
    return TYPE_CONFIG[type] || {
        icon: Circle,
        color: 'text-slate-400',
        bg: 'bg-white dark:bg-slate-800',
        ring: 'ring-slate-200 dark:ring-slate-700',
        label: type
    };
}

function formatSmartDate(dateStr: string): { primary: string; secondary: string } {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = differenceInDays(now, date);

    if (isToday(date)) {
        return { primary: 'Hoy', secondary: format(date, 'HH:mm', { locale: es }) };
    }
    if (isYesterday(date)) {
        return { primary: 'Ayer', secondary: format(date, 'HH:mm', { locale: es }) };
    }
    if (diffDays < 7) {
        return { primary: `Hace ${diffDays} días`, secondary: format(date, 'HH:mm', { locale: es }) };
    }

    return {
        primary: format(date, 'd MMM yyyy', { locale: es }),
        secondary: format(date, 'HH:mm', { locale: es })
    };
}

export default function EmployeeTimeline({ employeeId }: EmployeeTimelineProps) {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<string>('ALL');
    const [query, setQuery] = useState('');
    const [loadError, setLoadError] = useState(false);

    const fetchTimeline = useCallback(async () => {
        setIsLoading(true);
        setLoadError(false);
        try {
            const res = await api.get(`/employees/${employeeId}/timeline`);
            setEvents(res.data?.data || res.data || []);
        } catch (error) {
            console.error('Error fetching timeline', error);
            setLoadError(true);
        } finally {
            setIsLoading(false);
        }
    }, [employeeId]);

    useEffect(() => {
        void fetchTimeline();
    }, [fetchTimeline]);

    useEffect(() => {
        const refresh = (event: Event) => {
            const detail = (event as CustomEvent<{ employeeId?: string }>).detail;
            if (!detail?.employeeId || detail.employeeId === employeeId) void fetchTimeline();
        };
        window.addEventListener('absence-updated', refresh);
        return () => window.removeEventListener('absence-updated', refresh);
    }, [employeeId, fetchTimeline]);

    const availableTypes = useMemo(() => ['ALL', ...Array.from(new Set(events.map(e => e.type)))], [events]);
    const filteredEvents = useMemo(() => events.filter((event) => {
        if (filter !== 'ALL' && event.type !== filter) return false;
        const text = `${event.title} ${event.description || ''} ${getConfig(event.type).label}`.toLowerCase();
        return !query.trim() || text.includes(query.trim().toLowerCase());
    }), [events, filter, query]);

    // ── Loading state ────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 p-8 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-4">
                        <div className="w-12 flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 mb-2"></div>
                            <div className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700"></div>
                        </div>
                        <div className="flex-1 h-20 bg-slate-50 dark:bg-slate-800 rounded-xl"></div>
                    </div>
                ))}
            </div>
        );
    }

    // ── Empty state ──────────────────────────────────────────
    if (!loadError && events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-16 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <History size={36} className="text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">No hay historial laboral disponible</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Los eventos aparecerán aquí cuando se registren.</p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900 dark:bg-rose-950/20">
                <p className="font-bold text-rose-800 dark:text-rose-300">No se pudo cargar el cronograma.</p>
                <button type="button" onClick={() => void fetchTimeline()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white">
                    <RefreshCw size={15} />
                    Reintentar
                </button>
            </div>
        );
    }

    // ── Main timeline ────────────────────────────────────────
    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm dark:border-slate-800">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Vida laboral</p>
                        <h2 className="mt-1 text-xl font-extrabold">Cronograma completo</h2>
                        <p className="mt-1 text-sm text-slate-400">{events.length} hitos · altas, bajas, ausencias, nóminas y documentación en una sola secuencia.</p>
                    </div>
                    <label className="relative block w-full lg:w-80">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en el historial…" className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                    </label>
                </div>
            </div>

            {/* Filter pills */}
            {availableTypes.length > 2 && (
                <div className="flex flex-wrap gap-2 pb-2">
                    {availableTypes.map(type => (
                        <button
                            key={type}
                            onClick={() => setFilter(type)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                filter === type
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            {type === 'ALL' ? 'Todo' : getConfig(type).label}
                        </button>
                    ))}
                </div>
            )}

            <div className="relative pl-2">
                {/* Vertical gradient line */}
                <div
                    className="absolute top-2 bottom-2 w-[2px] bg-gradient-to-b from-slate-200 via-slate-200 to-transparent dark:from-slate-700 dark:via-slate-700"
                    style={{ left: '23px' }}
                />

                {filteredEvents.length === 0 && (
                    <div className="ml-14 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                        No hay hitos que coincidan con los filtros.
                    </div>
                )}
                <div className="space-y-3">
                    {filteredEvents.map((event, index) => {
                        const config = getConfig(event.type);
                        const Icon = config.icon;
                        const dateInfo = formatSmartDate(event.date);

                        return (
                            <div
                                key={`${event.id}-${index}`}
                                className="relative flex gap-4 group animate-in fade-in slide-in-from-left-2 duration-300"
                                style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
                            >
                                {/* Icon node */}
                                <div className="relative z-10 flex-shrink-0">
                                    <div
                                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.bg} ring-1 ${config.ring} transition-transform group-hover:scale-105`}
                                    >
                                        <Icon size={20} className={config.color} />
                                    </div>
                                </div>

                                {/* Content card */}
                                <div className={`flex-1 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 ${config.bg} transition-all group-hover:shadow-md group-hover:border-transparent`}>
                                    <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${config.bg} ${config.color} ring-1 ${config.ring}`}>
                                                {config.label}
                                            </span>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                                                {event.title}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                                            <Clock size={12} />
                                            <span className="font-medium">{dateInfo.primary}</span>
                                            {dateInfo.primary !== format(new Date(event.date), 'd MMM yyyy', { locale: es }) && (
                                                <span className="text-slate-300 dark:text-slate-600">·</span>
                                            )}
                                            <span>{dateInfo.secondary}</span>
                                        </div>
                                    </div>

                                    {event.endDate && new Date(event.endDate).toDateString() !== new Date(event.date).toDateString() && (
                                        <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                            Periodo: {new Date(event.date).toLocaleDateString('es-ES')} — {new Date(event.endDate).toLocaleDateString('es-ES')}
                                        </p>
                                    )}

                                    {event.description && (
                                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                            {event.description}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-3 mt-2">
                                        {event.status && (
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${event.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : event.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {event.status === 'APPROVED' ? 'Aprobada' : event.status === 'REJECTED' ? 'Rechazada' : 'Pendiente'}
                                            </span>
                                        )}
                                        {event.amount !== undefined && event.amount > 0 && (
                                            <span className="inline-flex items-center font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm bg-emerald-100/60 dark:bg-emerald-900/30 px-2.5 py-1 rounded-lg">
                                                {event.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                            </span>
                                        )}

                                        {event.fileUrl && (
                                            <a
                                                href={event.fileUrl.startsWith('http')
                                                    ? event.fileUrl
                                                    : `${API_URL}${event.fileUrl.startsWith('/') ? event.fileUrl : `/${event.fileUrl}`}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-2.5 py-1 rounded-lg transition-colors"
                                            >
                                                <FileText size={13} />
                                                Ver documento
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
