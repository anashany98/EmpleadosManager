import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, Baby, Plane, Stethoscope, FileText, MoreHorizontal, Plus, Trash2, Calendar as CalendarIcon, Filter, Search } from 'lucide-react';
import { api } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const ABSENCE_TYPES = {
    VACATION: { label: 'Vacaciones', color: 'bg-emerald-500', text: 'text-emerald-700', bgSoft: 'bg-emerald-50', border: 'border-emerald-200', icon: Plane },
    SICK: { label: 'Baja Médica', color: 'bg-rose-500', text: 'text-rose-700', bgSoft: 'bg-rose-50', border: 'border-rose-200', icon: Stethoscope },
    BIRTH: { label: 'Nacimiento', color: 'bg-blue-500', text: 'text-blue-700', bgSoft: 'bg-blue-50', border: 'border-blue-200', icon: Baby },
    MEDICAL_HOURS: { label: 'Médico', color: 'bg-indigo-500', text: 'text-indigo-700', bgSoft: 'bg-indigo-50', border: 'border-indigo-200', icon: Clock },
    PERSONAL: { label: 'Personal', color: 'bg-amber-500', text: 'text-amber-700', bgSoft: 'bg-amber-50', border: 'border-amber-200', icon: FileText },
    OTHER: { label: 'Otros', color: 'bg-slate-500', text: 'text-slate-700', bgSoft: 'bg-slate-50', border: 'border-slate-200', icon: MoreHorizontal },
};

export default function CalendarPage() {
    const { user } = useAuth();
    const canManageAllVacations = user?.role === 'admin' || user?.role === 'hr';

    // Core State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [vacations, setVacations] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);

    // UI State
    const [showModal, setShowModal] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState('ALL');
    const [viewMode, setViewMode] = useState<'VIEW' | 'ADD'>('VIEW');
    const [searchTerm, setSearchTerm] = useState('');

    // Selection State
    const [selectionStart, setSelectionStart] = useState<Date | null>(null);
    const [selectedDateEvents, setSelectedDateEvents] = useState<any[]>([]);

    // Form State
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [vacationType, setVacationType] = useState('VACATION');
    const [reason, setReason] = useState('');
    const [medicalHours, setMedicalHours] = useState('');
    const [calendarLink, setCalendarLink] = useState('');
    const [showLinkModal, setShowLinkModal] = useState(false);

    useEffect(() => {
        fetchData();
    }, [canManageAllVacations]);

    useEffect(() => {
        if (!canManageAllVacations && user?.employeeId) {
            setSelectedEmployee(user.employeeId);
        }
    }, [canManageAllVacations, user?.employeeId]);

    const fetchData = async () => {
        try {
            if (canManageAllVacations) {
                const [vacRes, empRes] = await Promise.all([
                    api.get('/vacations'),
                    api.get('/employees')
                ]);
                setVacations(vacRes.data || []);
                const emps = empRes.data || [];
                setEmployees(emps);
                const depts = new Set(emps.map((e: any) => e.department).filter(Boolean));
                setDepartments(['ALL', ...Array.from(depts) as string[]]);
            } else {
                const vacRes = await api.get('/vacations/my-vacations');
                setVacations(vacRes.data || []);
                setEmployees([]);
                setDepartments(['ALL']);
            }
        } catch (e) {
            console.error(e);
            toast.error("Error al cargar datos");
        }
    };

    // Derived Data
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    const filteredVacations = vacations.filter(v => {
        if (selectedDepartment !== 'ALL' && v.employee?.department !== selectedDepartment) return false;
        if (searchTerm && !v.employee?.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    const getDayEvents = (day: number) => {
        const target = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const targetTime = target.getTime();

        return filteredVacations.filter(v => {
            const start = new Date(v.startDate).setHours(0, 0, 0, 0);
            const end = new Date(v.endDate).setHours(23, 59, 59, 999);
            return targetTime >= start && targetTime <= end;
        });
    };

    const upcomingEvents = filteredVacations
        .filter(v => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const end = new Date(v.endDate);
            end.setHours(23, 59, 59, 999);
            return end >= today;
        })
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        .slice(0, 5);

    const handleDayClick = (day: number) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        setSelectionStart(date);
        setSelectedDateEvents(getDayEvents(day));
        setViewMode(getDayEvents(day).length > 0 ? 'VIEW' : 'ADD');
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (await api.delete(`/vacations/${id}`)) {
            toast.success('Evento eliminado');
            fetchData();
            setShowModal(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const targetEmployeeId = canManageAllVacations ? selectedEmployee : user?.employeeId;
            if (!targetEmployeeId) {
                toast.error('No se pudo identificar el empleado');
                return;
            }

            await api.post('/vacations', {
                employeeId: targetEmployeeId,
                startDate: selectionStart?.toISOString(),
                endDate: selectionStart?.toISOString(), // Single day logic for now or expand later
                type: vacationType,
                reason
            });
            fetchData();
            setShowModal(false);
            toast.success('Guardado');
            // Reset form
            if (canManageAllVacations) {
                setSelectedEmployee('');
            }
            setReason('');
        } catch (e) { toast.error('Error al guardar'); }
    };

    const fetchCalendarLink = async () => {
        try {
            const res = await api.get('/calendar/link');
            if (res.data?.success) {
                setCalendarLink(res.data.data.url);
                setShowLinkModal(true);
            }
        } catch (e) { toast.error('Error al generar enlace'); }
    }

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col xl:flex-row gap-6 animate-in fade-in duration-500 font-sans">
            {/* Main Calendar Area */}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
                {/* Toolbar */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-xl p-1">
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all shadow-sm"><ChevronLeft size={18} /></button>
                            <span className="px-4 font-bold text-slate-700 dark:text-slate-200 min-w-[140px] text-center capitalize">
                                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </span>
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all shadow-sm"><ChevronRight size={18} /></button>
                        </div>
                        <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-colors">
                            Hoy
                        </button>
                        <button onClick={fetchCalendarLink} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm border border-slate-200 dark:border-slate-700 text-xs font-bold">
                            <Clock size={16} className="text-indigo-500" />
                            Sincronizar
                        </button>
                    </div>

                    {canManageAllVacations && (
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative group flex-1 md:flex-none">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar empleado..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full md:w-48 pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all border border-transparent focus:border-indigo-500/50"
                                />
                            </div>
                            <div className="relative">
                                <select
                                    value={selectedDepartment}
                                    onChange={(e) => setSelectedDepartment(e.target.value)}
                                    className="appearance-none pl-4 pr-10 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer border border-transparent hover:border-slate-200 focus:border-indigo-500/50 transition-all"
                                >
                                    {departments.map(d => <option key={d} value={d}>{d === 'ALL' ? 'Todos los Departamentos' : d}</option>)}
                                </select>
                                <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Grid */}
                <div className="flex-1 p-6 overflow-y-auto">
                    <div className="grid grid-cols-7 mb-4">
                        {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((d, i) => (
                            <div key={d} className={`text-center py-2 text-[11px] font-bold uppercase tracking-widest ${i >= 5 ? 'text-rose-500/70' : 'text-slate-400'}`}>
                                {d.substring(0, 3)}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 grid-rows-5 gap-2 h-full min-h-[500px]">
                        {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const events = getDayEvents(day);
                            const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth();
                            const isWeekend = (offset + day) % 7 === 0 || (offset + day) % 7 === 6;

                            return (
                                <div key={day} onClick={() => handleDayClick(day)} className={`
                                    relative p-2 rounded-2xl border transition-all cursor-pointer group flex flex-col gap-1
                                    ${isToday ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-800 shadow-inner' : 'bg-transparent border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/50'}
                                    ${isWeekend ? 'bg-slate-50/50 dark:bg-slate-900/50' : ''}
                                `}>
                                    <span className={`text-sm font-bold ${isToday ? 'text-indigo-600' : 'text-slate-700 dark:text-slate-300'}`}>{day}</span>

                                    {/* Events Preview */}
                                    <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                                        {events.slice(0, 3).map((ev, idx) => {
                                            const conf = ABSENCE_TYPES[ev.type as keyof typeof ABSENCE_TYPES] || ABSENCE_TYPES.VACATION;
                                            return (
                                                <div key={idx} className={`h-1.5 rounded-full ${conf.color} w-full opacity-60 group-hover:opacity-100 transition-opacity`} title={`${ev.employee?.name} - ${conf.label}`} />
                                            );
                                        })}
                                        {events.length > 3 && (
                                            <div className="text-[9px] font-bold text-slate-400 pl-0.5">+{events.length - 3}</div>
                                        )}
                                    </div>

                                    {/* Add Button on Hover */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                                            <Plus size={12} strokeWidth={3} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Sidebar (Right) */}
            <div className="w-full xl:w-80 flex flex-col gap-6 shrink-0">
                {/* Upcoming Events Card */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 shadow-xl flex flex-col gap-4 flex-1 max-h-[500px]">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <CalendarIcon size={18} className="text-indigo-500" />
                        Próximos Eventos
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {upcomingEvents.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No hay eventos próximos.</p>
                        ) : (
                            upcomingEvents.map((ev, idx) => {
                                const conf = ABSENCE_TYPES[ev.type as keyof typeof ABSENCE_TYPES] || ABSENCE_TYPES.VACATION;
                                const date = new Date(ev.startDate);
                                return (
                                    <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 group hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                        <div className={`w-10 h-10 rounded-xl ${conf.bgSoft} ${conf.text} flex items-center justify-center shrink-0`}>
                                            <conf.icon size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{ev.employee?.name}</p>
                                            <p className="text-xs text-slate-500 font-medium">{date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} • {conf.label}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Legend */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 shadow-xl">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Leyenda</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.entries(ABSENCE_TYPES).map(([key, conf]) => (
                            <div key={key} className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${conf.color}`} />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{conf.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                        {selectionStart?.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                                    </h3>
                                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">{viewMode === 'VIEW' ? 'Eventos' : 'Nueva Ausencia'}</p>
                                </div>
                                <div className="flex gap-2">
                                    {viewMode === 'VIEW' && <button onClick={() => setViewMode('ADD')} className="p-2 bg-indigo-600 text-white rounded-xl hover:scale-105 transition-transform"><Plus size={16} /></button>}
                                    <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"><X size={18} /></button>
                                </div>
                            </div>

                            <div className="p-6">
                                {viewMode === 'VIEW' ? (
                                    <div className="space-y-3">
                                        {selectedDateEvents.length === 0 ? <p className="text-center text-slate-400 text-sm">Sin eventos</p> : selectedDateEvents.map((ev, i) => {
                                            const conf = ABSENCE_TYPES[ev.type as keyof typeof ABSENCE_TYPES] || ABSENCE_TYPES.VACATION;
                                            return (
                                                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                    <div className={`w-8 h-8 rounded-full ${conf.color} flex items-center justify-center text-white`}><conf.icon size={14} /></div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{ev.employee?.name}</p>
                                                        <p className="text-xs text-slate-500">{conf.label}</p>
                                                    </div>
                                                    <button onClick={() => handleDelete(ev.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={16} /></button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        {canManageAllVacations ? (
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Empleado</label>
                                                <select required value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-medium transition-all">
                                                    <option value="">Seleccionar...</option>
                                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Empleado</label>
                                                <div className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300">
                                                    Tu solicitud se registrará en tu perfil.
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {Object.entries(ABSENCE_TYPES).map(([k, c]) => (
                                                    <button type="button" key={k} onClick={() => setVacationType(k)} className={`p-2 rounded-xl border text-xs font-bold transition-all ${vacationType === k ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{c.label}</button>
                                                ))}
                                            </div>
                                        </div>

                                        {vacationType === 'MEDICAL_HOURS' && (
                                            <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                                                <label className="text-xs font-bold text-indigo-500 uppercase">Horas Médicas</label>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={medicalHours}
                                                    onChange={(e) => setMedicalHours(e.target.value)}
                                                    placeholder="Ej: 2.5"
                                                    className="w-full p-3 rounded-xl bg-indigo-50/50 border-indigo-100 dark:bg-slate-800 dark:border-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-bold transition-all"
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Observaciones</label>
                                            <textarea
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                                placeholder="Detalles opcionales..."
                                                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-medium transition-all resize-none h-20"
                                            />
                                        </div>

                                        <button className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 transition-all">Guardar Evento</button>
                                    </form>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showLinkModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden p-8 text-center space-y-6">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">Sincroniza tu Calendario</h3>
                            <p className="text-sm text-slate-500">Copia este enlace y añádelo como "Suscripción a URL" en Google Calendar, Outlook o Apple Calendar para ver tus vacaciones sincronizadas.</p>

                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                <code className="flex-1 text-xs font-mono break-all text-left text-slate-600 dark:text-slate-400 select-all">{calendarLink}</code>
                                <button onClick={() => { navigator.clipboard.writeText(calendarLink); toast.success('Enlace copiado'); }} className="p-2 bg-white dark:bg-slate-700 shadow-sm rounded-lg hover:text-indigo-600">
                                    <FileText size={16} />
                                </button>
                            </div>

                            <button onClick={() => setShowLinkModal(false)} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">Cerrar</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
