import { useState, useEffect } from 'react';
import { api, API_URL } from '../../api/client';
import {
    Circle, FileText,
    Calendar, GraduationCap, Receipt, HeartPulse,
    UserPlus, UserMinus, ShieldAlert, History, Clock
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

    useEffect(() => {
        const fetchTimeline = async () => {
            try {
                const res = await api.get(`/employees/${employeeId}/timeline`);
                setEvents(res.data?.data || res.data || []);
            } catch (error) {
                console.error('Error fetching timeline', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTimeline();
    }, [employeeId]);

    const availableTypes = ['ALL', ...Array.from(new Set(events.map(e => e.type)))];
    const filteredEvents = filter === 'ALL' ? events : events.filter(e => e.type === filter);

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
    if (events.length === 0) {
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

    // ── Main timeline ────────────────────────────────────────
    return (
        <div className="space-y-4">
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
                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${config.bg} ring-1 ${config.ring} transition-transform group-hover:scale-110 group-hover:rotate-3`}
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

                                    {event.description && (
                                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                            {event.description}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-3 mt-2">
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
