import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Briefcase,
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Clock,
    FileText,
    Filter,
    Gift,
    MapPin,
    Plus,
    Search,
    Trash2,
    User,
    X
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { hasModuleAccess, normalizeActor } from '@shared/authz';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { ABSENCE_TYPES } from '../features/self-service/vacations/types';

type UnifiedEventType = 'vacation-own' | 'vacation-team' | 'birthday' | 'event' | 'holiday' | 'fichaje';
type UnifiedEventSource = 'vacation' | 'calendar_event' | 'birthday' | 'holiday';
type CalendarEventKind = 'EVENT' | 'HOLIDAY' | 'CORPORATE';

interface UnifiedCalendarEvent {
    id: string;
    entityId: string;
    title: string;
    description?: string;
    location?: string;
    start: string;
    end: string;
    allDay: boolean;
    type: UnifiedEventType;
    color: string;
    source: UnifiedEventSource;
    editable: boolean;
    deletable: boolean;
    calendarEventType?: string;
    employeeId?: string;
    employeeName?: string;
    employeeDepartment?: string | null;
}

interface ApiEnvelope<T> {
    success?: boolean;
    data?: T;
    message?: string;
}

interface CalendarLinkResponse {
    url: string;
}

interface EventAppearance {
    label: string;
    shortLabel: string;
    color: string;
    pill: string;
}

const EVENT_APPEARANCE: Record<UnifiedEventType, EventAppearance> = {
    'vacation-own': {
        label: 'Mis vacaciones',
        shortLabel: 'Vacaciones',
        color: 'bg-emerald-500',
        pill: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
    },
    'vacation-team': {
        label: 'Vacaciones equipo',
        shortLabel: 'Equipo',
        color: 'bg-emerald-300',
        pill: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
    },
    birthday: {
        label: 'Cumpleaños',
        shortLabel: 'Cumple',
        color: 'bg-pink-500',
        pill: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800'
    },
    event: {
        label: 'Evento',
        shortLabel: 'Evento',
        color: 'bg-blue-500',
        pill: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
    },
    holiday: {
        label: 'Festivo',
        shortLabel: 'Festivo',
        color: 'bg-slate-500',
        pill: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    },
    fichaje: {
        label: 'Fichaje',
        shortLabel: 'Fichaje',
        color: 'bg-orange-500',
        pill: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800'
    }
};

const CALENDAR_EVENT_TYPE_OPTIONS: Array<{ value: CalendarEventKind; label: string }> = [
    { value: 'EVENT', label: 'Evento interno' },
    { value: 'HOLIDAY', label: 'Festivo empresa' },
    { value: 'CORPORATE', label: 'Corporativo' }
];

function extractEnvelopeData<T>(response: T | ApiEnvelope<T> | undefined, fallback: T): T {
    if (response && typeof response === 'object' && 'data' in response) {
        return (response.data ?? fallback) as T;
    }

    return (response ?? fallback) as T;
}

function formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getEventTitle(event: UnifiedCalendarEvent): string {
    if (event.source === 'vacation' && event.employeeName) {
        return event.employeeName;
    }

    return event.title;
}

function getEventSubtitle(event: UnifiedCalendarEvent): string {
    if (event.source === 'vacation') {
        return event.type === 'vacation-own' ? 'Vacaciones aprobadas' : 'Ausencia aprobada del equipo';
    }

    if (event.source === 'birthday' && event.employeeName) {
        return event.employeeName;
    }

    if (event.source === 'calendar_event' && event.calendarEventType === 'CORPORATE') {
        return 'Evento corporativo';
    }

    return EVENT_APPEARANCE[event.type]?.label || 'Evento';
}

export default function CalendarPage() {
    const { user } = useAuth();
    const actor = useMemo(() => normalizeActor(user), [user]);
    const canManageCalendarEvents = Boolean(actor && actor.role !== 'employee' && hasModuleAccess(actor, 'calendar', 'write'));
    const canFilterByDepartment = Boolean(actor && actor.role !== 'employee');

    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<UnifiedCalendarEvent[]>([]);
    const [departments, setDepartments] = useState<string[]>(['ALL']);
    const [selectedDepartment, setSelectedDepartment] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    const [showDayModal, setShowDayModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedDateEvents, setSelectedDateEvents] = useState<UnifiedCalendarEvent[]>([]);

    const [eventTitle, setEventTitle] = useState('');
    const [eventDescription, setEventDescription] = useState('');
    const [eventLocation, setEventLocation] = useState('');
    const [eventType, setEventType] = useState<CalendarEventKind>('EVENT');
    const [eventStartDate, setEventStartDate] = useState('');
    const [eventEndDate, setEventEndDate] = useState('');
    const [savingEvent, setSavingEvent] = useState(false);

    const [calendarLink, setCalendarLink] = useState('');
    const [showLinkModal, setShowLinkModal] = useState(false);

    const [showAbsenceModal, setShowAbsenceModal] = useState(false);
    const [absenceEmployees, setAbsenceEmployees] = useState<{ id: string; name: string }[]>([]);
    const [selectedAbsenceEmployee, setSelectedAbsenceEmployee] = useState('');
    const [absenceStartDate, setAbsenceStartDate] = useState('');
    const [absenceEndDate, setAbsenceEndDate] = useState('');
    const [absenceType, setAbsenceType] = useState<string>('VACATION');
    const [absenceNotes, setAbsenceNotes] = useState('');
    const [savingAbsence, setSavingAbsence] = useState(false);

    useEffect(() => {
        if (canManageCalendarEvents) {
            api.get('/employees?limit=999').then((res: any) => {
                // The API returns { success, data: { data: [...], meta } } (paginated)
                // or { success, data: [...] } (flat). Handle both shapes.
                const raw = res?.data ?? res;
                const employees = Array.isArray(raw) ? raw : (raw?.data ?? []);
                if (Array.isArray(employees)) {
                    setAbsenceEmployees(employees.map((e: any) => ({
                        id: e.id,
                        name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name
                    })));
                }
            }).catch(console.error);
        }
    }, [canManageCalendarEvents]);

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    const resetEventForm = (baseDate: Date) => {
        const normalizedDate = formatDateInput(baseDate);
        setEventTitle('');
        setEventDescription('');
        setEventLocation('');
        setEventType('EVENT');
        setEventStartDate(normalizedDate);
        setEventEndDate(normalizedDate);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);

        try {
            const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
            const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

            const requests: Array<Promise<unknown>> = [
                api.get<ApiEnvelope<UnifiedCalendarEvent[]>>(`/calendar/unified?start=${start}&end=${end}`)
            ];

            if (canFilterByDepartment) {
                requests.push(api.get<ApiEnvelope<string[]>>('/employees/departments'));
            }

            const [eventsResponse, departmentsResponse] = await Promise.all(requests);
            setEvents(extractEnvelopeData(eventsResponse as ApiEnvelope<UnifiedCalendarEvent[]>, []));

            if (canFilterByDepartment) {
                const departmentValues = extractEnvelopeData(departmentsResponse as ApiEnvelope<string[]>, []);
                setDepartments(['ALL', ...departmentValues]);
            } else {
                setDepartments(['ALL']);
                setSelectedDepartment('ALL');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar el calendario global');
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }, [canFilterByDepartment, currentDate]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const filteredEvents = useMemo(() => {
        return events.filter((event) => {
            const searchableText = `${event.title} ${event.employeeName || ''}`.toLowerCase();
            if (searchTerm && !searchableText.includes(searchTerm.toLowerCase())) {
                return false;
            }

            if (selectedDepartment !== 'ALL' && event.employeeDepartment && event.employeeDepartment !== selectedDepartment) {
                return false;
            }

            return true;
        });
    }, [events, searchTerm, selectedDepartment]);

    const getDayEvents = useCallback((day: number) => {
        const target = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const targetTime = target.getTime();

        return filteredEvents.filter((event) => {
            const start = new Date(event.start).setHours(0, 0, 0, 0);
            const end = new Date(event.end).setHours(23, 59, 59, 999);
            return targetTime >= start && targetTime <= end;
        });
    }, [currentDate, filteredEvents]);

    const upcomingEvents = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return [...filteredEvents]
            .filter((event) => {
                const end = new Date(event.end);
                end.setHours(23, 59, 59, 999);
                return end >= today;
            })
            .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime())
            .slice(0, 6);
    }, [filteredEvents]);

    const openDayModal = (day: number) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        setSelectedDate(date);
        setSelectedDateEvents(getDayEvents(day));
        setShowDayModal(true);
    };

    const openCreateModal = (baseDate: Date) => {
        resetEventForm(baseDate);
        setSelectedDate(baseDate);
        setShowDayModal(false);
        setShowCreateModal(true);
    };

    const handleCreateEvent = async (event: React.FormEvent) => {
        event.preventDefault();

        // Validate date range
        if (eventEndDate < eventStartDate) {
            toast.error('La fecha de fin debe ser igual o posterior a la de inicio');
            return;
        }

        setSavingEvent(true);

        try {
            const response = await api.post<ApiEnvelope<UnifiedCalendarEvent>>('/calendar/events', {
                title: eventTitle.trim(),
                description: eventDescription.trim() || undefined,
                location: eventLocation.trim() || undefined,
                startDate: new Date(eventStartDate).toISOString(),
                endDate: new Date(eventEndDate).toISOString(),
                type: eventType,
                allDay: true,
                isPublic: true
            });

            toast.success(response.message || 'Evento guardado');
            setShowCreateModal(false);
            await fetchData();
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Error al guardar el evento');
        } finally {
            setSavingEvent(false);
        }
    };

    const handleCreateAbsence = async (event: React.FormEvent) => {
        event.preventDefault();

        // Validate date range
        if (absenceEndDate < absenceStartDate) {
            toast.error('La fecha de fin debe ser igual o posterior a la de inicio');
            return;
        }

        if (!selectedAbsenceEmployee) {
            toast.error('Selecciona un empleado');
            return;
        }

        setSavingAbsence(true);
        try {
            await api.post('/vacations', {
                employeeId: selectedAbsenceEmployee,
                startDate: absenceStartDate,
                endDate: absenceEndDate,
                type: absenceType,
                notes: absenceNotes.trim() || undefined,
                status: 'APPROVED'
            });

            toast.success('Ausencia registrada correctamente');
            setShowAbsenceModal(false);
            setSelectedAbsenceEmployee('');
            setAbsenceStartDate('');
            setAbsenceEndDate('');
            setAbsenceType('VACATION');
            setAbsenceNotes('');
            await fetchData();
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Error al registrar la ausencia');
        } finally {
            setSavingAbsence(false);
        }
    };

    const openAbsenceModal = (date: Date) => {
        const normalizedDate = formatDateInput(date);
        setAbsenceStartDate(normalizedDate);
        setAbsenceEndDate(normalizedDate);
        setShowAbsenceModal(true);
    };

    const handleDeleteCalendarEvent = async (eventItem: UnifiedCalendarEvent) => {
        try {
            await api.delete(`/calendar/events/${eventItem.entityId}`);
            toast.success('Evento eliminado');
            const updatedEvents = selectedDateEvents.filter((item) => item.id !== eventItem.id);
            setSelectedDateEvents(updatedEvents);
            await fetchData();
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Error al eliminar el evento');
        }
    };

    const fetchCalendarLink = async () => {
        try {
            const response = await api.get<ApiEnvelope<CalendarLinkResponse>>('/calendar/link');
            const payload = extractEnvelopeData(response, { url: '' });
            if (payload.url) {
                setCalendarLink(payload.url);
                setShowLinkModal(true);
            }
        } catch (error) {
            console.error(error);
            toast.error('No se pudo generar el enlace de sincronización');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">Calendario global mixto</h1>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                        Agenda de coordinación con vacaciones aprobadas, cumpleaños, eventos y festivos. Las solicitudes y aprobaciones viven en `Vacaciones`.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {user?.employeeId && (
                        <button onClick={fetchCalendarLink} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                            <Clock size={16} className="text-indigo-500" />
                            Sincronizar mis vacaciones
                        </button>
                    )}

                    {canManageCalendarEvents && (
                        <button onClick={() => openCreateModal(selectedDate || new Date())} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700">
                            <Plus size={16} />
                            Nuevo evento
                        </button>
                    )}

                    {canManageCalendarEvents && (
                        <button onClick={() => openAbsenceModal(selectedDate || new Date())} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700">
                            <User size={16} />
                            Nueva ausencia
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
                                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-xl p-1 shrink-0">
                                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all shadow-sm">
                                        <ChevronLeft size={18} />
                                    </button>
                                    <span className="px-3 sm:px-4 font-bold text-slate-700 dark:text-slate-200 min-w-[150px] text-center text-sm capitalize">
                                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                    </span>
                                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all shadow-sm">
                                        <ChevronRight size={18} />
                                    </button>
                                </div>

                                <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-sm font-bold rounded-xl hover:bg-indigo-100 transition-colors shrink-0">
                                    Hoy
                                </button>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <label className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar persona o evento..."
                                        value={searchTerm}
                                        onChange={(inputEvent) => setSearchTerm(inputEvent.target.value)}
                                        className="w-full sm:w-64 pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 border border-transparent focus:border-indigo-500/40"
                                    />
                                </label>

                                {canFilterByDepartment && (
                                    <label className="relative">
                                        <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        <select
                                            value={selectedDepartment}
                                            onChange={(inputEvent) => setSelectedDepartment(inputEvent.target.value)}
                                            className="appearance-none min-w-[220px] pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none border border-transparent focus:border-indigo-500/40"
                                        >
                                            {departments.map((department) => (
                                                <option key={department} value={department}>
                                                    {department === 'ALL' ? 'Todos los departamentos' : department}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                                <CalendarIcon size={14} className="text-indigo-500" />
                                Solo se muestran vacaciones aprobadas en esta vista
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                                <FileText size={14} className="text-slate-500" />
                                Solicitudes, adjuntos y estados viven en `Vacaciones`
                            </span>
                        </div>
                    </div>

                    <div className="p-3 sm:p-6">
                        <div className="grid grid-cols-7 mb-3">
                            {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dayName, index) => (
                                <div key={dayName} className={`text-center py-2 text-[11px] font-bold uppercase tracking-widest ${index >= 5 ? 'text-rose-500/70' : 'text-slate-400'}`}>
                                    {dayName.substring(0, 3)}
                                </div>
                            ))}
                        </div>

                        {loading ? (
                            <div className="min-h-[420px] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400">
                                Cargando calendario...
                            </div>
                        ) : (
                            <div className="grid grid-cols-7 gap-2 min-h-[520px] auto-rows-fr">
                                {Array.from({ length: offset }).map((_, index) => (
                                    <div key={`empty-${index}`} className="rounded-2xl bg-slate-50/60 dark:bg-slate-800/20" />
                                ))}

                                {Array.from({ length: daysInMonth }).map((_, index) => {
                                    const day = index + 1;
                                    const dayEvents = getDayEvents(day);
                                    const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
                                    const weekdayPosition = offset + day;
                                    const isWeekend = weekdayPosition % 7 === 0 || weekdayPosition % 7 === 6;

                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => openDayModal(day)}
                                            className={`relative min-h-[110px] rounded-2xl border p-2 text-left transition-all ${isToday ? 'border-indigo-300 bg-indigo-50/60 dark:border-indigo-700 dark:bg-indigo-900/20' : 'border-slate-100 bg-white hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-indigo-700'} ${isWeekend ? 'bg-slate-50/60 dark:bg-slate-900/60' : ''}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className={`text-sm font-bold ${isToday ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>{day}</span>
                                                {canManageCalendarEvents && (
                                                    <span className="rounded-full bg-slate-100 p-1 text-slate-400 dark:bg-slate-800">
                                                        <Plus size={12} />
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mt-2 space-y-1 overflow-hidden">
                                                {dayEvents.slice(0, 3).map((eventItem) => {
                                                    const appearance = EVENT_APPEARANCE[eventItem.type] || EVENT_APPEARANCE.event;
                                                    return (
                                                        <div key={eventItem.id} className={`rounded-lg px-2 py-1 text-[10px] font-bold text-white truncate ${appearance.color}`} title={getEventTitle(eventItem)}>
                                                            {getEventTitle(eventItem)}
                                                        </div>
                                                    );
                                                })}
                                                {dayEvents.length > 3 && (
                                                    <div className="text-[10px] font-bold text-slate-400">+{dayEvents.length - 3} más</div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 shadow-xl">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <CalendarIcon size={18} className="text-indigo-500" />
                            Próximos eventos
                        </h3>

                        <div className="mt-4 space-y-3">
                            {upcomingEvents.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No hay eventos próximos.</p>
                            ) : (
                                upcomingEvents.map((eventItem) => {
                                    const appearance = EVENT_APPEARANCE[eventItem.type] || EVENT_APPEARANCE.event;
                                    return (
                                        <button
                                            key={eventItem.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedDate(new Date(eventItem.start));
                                                setSelectedDateEvents([eventItem]);
                                                setShowDayModal(true);
                                            }}
                                            className="w-full text-left rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition hover:border-indigo-200 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-indigo-800 dark:hover:bg-slate-800"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`h-10 w-10 rounded-2xl ${appearance.color} flex items-center justify-center text-white shrink-0`}>
                                                    {eventItem.source === 'vacation' ? <User size={18} /> : eventItem.source === 'holiday' ? <Gift size={18} /> : <Briefcase size={18} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{getEventTitle(eventItem)}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {new Date(eventItem.start).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · {getEventSubtitle(eventItem)}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 shadow-xl">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Leyenda</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(EVENT_APPEARANCE).map(([key, appearance]) => (
                                <div key={key} className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${appearance.color}`} />
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{appearance.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showDayModal && selectedDate && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-sm">
                        <motion.div initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }} className="w-full max-w-2xl rounded-t-[2rem] bg-white shadow-2xl dark:bg-slate-900 sm:rounded-[2rem] max-h-[85vh] overflow-y-auto">
                            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-800/50">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                        {selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </h3>
                                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">Eventos del día</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {canManageCalendarEvents && (
                                        <button onClick={() => openCreateModal(selectedDate)} className="rounded-xl bg-indigo-600 p-2 text-white transition hover:bg-indigo-700">
                                            <Plus size={16} />
                                        </button>
                                    )}
                                    <button onClick={() => setShowDayModal(false)} className="rounded-xl p-2 transition hover:bg-slate-200 dark:hover:bg-slate-700">
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                {selectedDateEvents.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400 dark:border-slate-700">
                                        No hay eventos registrados este día.
                                    </div>
                                ) : (
                                    selectedDateEvents.map((eventItem) => {
                                        const appearance = EVENT_APPEARANCE[eventItem.type] || EVENT_APPEARANCE.event;

                                        return (
                                            <article key={eventItem.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-800/40">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h4 className="text-base font-black text-slate-900 dark:text-white">{getEventTitle(eventItem)}</h4>
                                                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${appearance.pill}`}>
                                                                {getEventSubtitle(eventItem)}
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                                            {new Date(eventItem.start).toLocaleDateString('es-ES')} {eventItem.start !== eventItem.end ? `- ${new Date(eventItem.end).toLocaleDateString('es-ES')}` : ''}
                                                        </p>
                                                    </div>

                                                    {canManageCalendarEvents && eventItem.deletable && eventItem.source === 'calendar_event' && (
                                                        <button onClick={() => void handleDeleteCalendarEvent(eventItem)} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-900/20">
                                                            <Trash2 size={16} />
                                                            Eliminar
                                                        </button>
                                                    )}
                                                </div>

                                                {eventItem.description && (
                                                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                                                        {eventItem.description}
                                                    </p>
                                                )}

                                                {eventItem.location && (
                                                    <div className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                                        <MapPin size={15} />
                                                        {eventItem.location}
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showCreateModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-sm">
                        <motion.div initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }} className="w-full max-w-xl rounded-t-[2rem] bg-white shadow-2xl dark:bg-slate-900 sm:rounded-[2rem] max-h-[85vh] overflow-y-auto">
                            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-800/50">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Nuevo evento de calendario</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Esta acción afecta al calendario global mixto, no al flujo de vacaciones.</p>
                                </div>
                                <button onClick={() => setShowCreateModal(false)} className="rounded-xl p-2 transition hover:bg-slate-200 dark:hover:bg-slate-700">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateEvent} className="p-6 space-y-4">
                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Título</label>
                                    <input
                                        type="text"
                                        required
                                        value={eventTitle}
                                        onChange={(inputEvent) => setEventTitle(inputEvent.target.value)}
                                        className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium outline-none ring-0 transition focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800"
                                        placeholder="Ej: Jornada de seguridad, cierre de oficina..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Desde</label>
                                        <input type="date" required value={eventStartDate} onChange={(inputEvent) => setEventStartDate(inputEvent.target.value)} className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800" />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Hasta</label>
                                        <input type="date" required value={eventEndDate} onChange={(inputEvent) => setEventEndDate(inputEvent.target.value)} className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800" />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Tipo</label>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                        {CALENDAR_EVENT_TYPE_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setEventType(option.value)}
                                                className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${eventType === option.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300' : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Ubicación</label>
                                    <input
                                        type="text"
                                        value={eventLocation}
                                        onChange={(inputEvent) => setEventLocation(inputEvent.target.value)}
                                        className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800"
                                        placeholder="Opcional"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Descripción</label>
                                    <textarea
                                        value={eventDescription}
                                        onChange={(inputEvent) => setEventDescription(inputEvent.target.value)}
                                        className="h-28 w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800"
                                        placeholder="Información adicional para el equipo"
                                    />
                                </div>

                                <button type="submit" disabled={savingEvent} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">
                                    <Plus size={16} />
                                    {savingEvent ? 'Guardando...' : 'Guardar evento'}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showAbsenceModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-sm">
                        <motion.div initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }} className="w-full max-w-xl rounded-t-[2rem] bg-white shadow-2xl dark:bg-slate-900 sm:rounded-[2rem] max-h-[85vh] overflow-y-auto">
                            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-800/50">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Nueva ausencia</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Registrar ausencia o vacaciones para un empleado</p>
                                </div>
                                <button onClick={() => setShowAbsenceModal(false)} className="rounded-xl p-2 transition hover:bg-slate-200 dark:hover:bg-slate-700">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateAbsence} className="p-6 space-y-4">
                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Empleado</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <select
                                            required
                                            value={selectedAbsenceEmployee}
                                            onChange={(e) => setSelectedAbsenceEmployee(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                        >
                                            <option value="">Selecciona empleado</option>
                                            {absenceEmployees.map((emp) => (
                                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Desde</label>
                                        <input type="date" required value={absenceStartDate} onChange={(e) => setAbsenceStartDate(e.target.value)} className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:bg-slate-800" />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Hasta</label>
                                        <input type="date" required value={absenceEndDate} onChange={(e) => setAbsenceEndDate(e.target.value)} className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:bg-slate-800" />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Tipo de ausencia</label>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {Object.entries(ABSENCE_TYPES).map(([key, config]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setAbsenceType(key)}
                                                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${absenceType === key ? `border-emerald-500 ${config.bgSoft} ${config.text} dark:bg-emerald-900/20 dark:text-emerald-300` : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                                            >
                                                {config.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Notas</label>
                                    <textarea
                                        value={absenceNotes}
                                        onChange={(e) => setAbsenceNotes(e.target.value)}
                                        className="h-20 w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:bg-slate-800"
                                        placeholder="Opcional"
                                    />
                                </div>

                                <button type="submit" disabled={savingAbsence} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                                    <User size={16} />
                                    {savingAbsence ? 'Guardando...' : 'Registrar ausencia'}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showLinkModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-sm">
                        <motion.div initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }} className="w-full max-w-lg rounded-t-[2rem] bg-white p-6 shadow-2xl dark:bg-slate-900 sm:rounded-[2rem] sm:p-8 text-center space-y-4">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">Sincroniza mis vacaciones</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Este enlace sincroniza tus vacaciones aprobadas y avisos operativos personales. No incluye cumpleaños ni eventos globales del calendario mixto.
                            </p>

                            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-700 dark:bg-slate-800">
                                <code className="flex-1 break-all text-left text-xs text-slate-600 dark:text-slate-300">{calendarLink}</code>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(calendarLink);
                                        toast.success('Enlace copiado');
                                    }}
                                    className="rounded-lg bg-white p-2 text-slate-600 shadow-sm transition hover:text-indigo-600 dark:bg-slate-700 dark:text-slate-200"
                                >
                                    <FileText size={16} />
                                </button>
                            </div>

                            <button onClick={() => setShowLinkModal(false)} className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700">
                                Cerrar
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
