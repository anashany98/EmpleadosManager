import { useState, useEffect } from 'react';
import { api, API_URL } from '../api/client';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Plane, Calendar as CalendarIcon, Check, X, Clock, FileText, Stethoscope, Baby, MoreHorizontal, Filter, Paperclip, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AbsenceTypeConfig {
    label: string;
    color: string;
    text: string;
    bgSoft: string;
    border: string;
    icon: any;
}

const ABSENCE_TYPES: Record<string, AbsenceTypeConfig> = {
    VACATION: { label: 'Vacaciones', color: 'bg-emerald-500', text: 'text-emerald-700', bgSoft: 'bg-emerald-50', border: 'border-emerald-200', icon: Plane },
    SICK: { label: 'Baja Médica', color: 'bg-rose-500', text: 'text-rose-700', bgSoft: 'bg-rose-50', border: 'border-rose-200', icon: Stethoscope },
    BIRTH: { label: 'Nacimiento', color: 'bg-blue-500', text: 'text-blue-700', bgSoft: 'bg-blue-50', border: 'border-blue-200', icon: Baby },
    MEDICAL_HOURS: { label: 'Médico', color: 'bg-indigo-500', text: 'text-indigo-700', bgSoft: 'bg-indigo-50', border: 'border-indigo-200', icon: Clock },
    PERSONAL: { label: 'Personal', color: 'bg-amber-500', text: 'text-amber-700', bgSoft: 'bg-amber-50', border: 'border-amber-200', icon: FileText },
    OTHER: { label: 'Otros', color: 'bg-slate-500', text: 'text-slate-700', bgSoft: 'bg-slate-50', border: 'border-slate-200', icon: MoreHorizontal },
};

interface VacationRequest {
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    type: string;
    reason?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    days: number;
    fileUrl?: string;
    employee?: {
        name: string;
        department?: string;
    };
}

export default function VacationRequests() {
    const { user } = useAuth();
    // Admin defaults to CALENDAR, others to MY_REQUESTS
    const [activeTab, setActiveTab] = useState<'MY_REQUESTS' | 'MANAGE' | 'CALENDAR'>(user?.role === 'admin' ? 'CALENDAR' : 'MY_REQUESTS');
    const [myRequests, setMyRequests] = useState<VacationRequest[]>([]);
    const [pendingRequests, setPendingRequests] = useState<VacationRequest[]>([]);
    const [calendarVacations, setCalendarVacations] = useState<VacationRequest[]>([]); // For Calendar
    const [departments, setDepartments] = useState<string[]>([]);
    const [selectedDept, setSelectedDept] = useState('ALL');

    // Form / Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null); // For Calendar Details

    // Create Form State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [type, setType] = useState('VACATION');
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        try {
            if (activeTab === 'MY_REQUESTS') {
                const res = await api.get('/vacations/my-vacations');
                if (res.success) setMyRequests(res.data);
            } else if (activeTab === 'MANAGE') {
                const res = await api.get('/vacations/manage');
                if (res.success) setPendingRequests(res.data);
            } else if (activeTab === 'CALENDAR') {
                // Admin gets everything, Employee gets theirs
                const endpoint = user?.role === 'admin' ? '/vacations' : '/vacations/my-vacations';
                const res = await api.get(endpoint);
                if (res.success) setCalendarVacations(res.data);
            }
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar solicitudes");
        }
    };

    const [stats, setStats] = useState({ total: 30, used: 0, pending: 0, available: 30 });

    useEffect(() => {
        if (activeTab === 'MY_REQUESTS' && user?.employeeId) {
            fetchEmployeeStats();
        }
    }, [activeTab, user]);

    useEffect(() => {
        if (activeTab === 'CALENDAR' && user?.role === 'admin') {
            fetchDepartments();
        }
    }, [activeTab, user]);

    const fetchDepartments = async () => {
        try {
            const res = await api.get('/employees/departments');
            if (res.success) setDepartments(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const filteredCalendarVacations = selectedDept === 'ALL'
        ? calendarVacations
        : calendarVacations.filter((v) => v.employee?.department === selectedDept);

    const fetchEmployeeStats = async () => {
        try {
            const [empRes, vacRes] = await Promise.all([
                api.get(`/employees/${user?.employeeId}`),
                api.get('/vacations/my-vacations')
            ]);

            const emp = empRes.data || empRes;
            const vacations = vacRes.data || vacRes;

            const total = emp.vacationDaysTotal || 30;
            const used = vacations.filter((v: VacationRequest) => v.status === 'APPROVED').reduce((sum: number, v: VacationRequest) => sum + (v.days || 0), 0);
            const pending = vacations.filter((v: VacationRequest) => v.status === 'PENDING').reduce((sum: number, v: VacationRequest) => sum + (v.days || 0), 0);

            setStats({
                total,
                used,
                pending,
                available: total - used
            });
            setMyRequests(vacations); // Update requests too
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('employeeId', user?.employeeId || '');
            formData.append('startDate', new Date(startDate).toISOString());
            formData.append('endDate', new Date(endDate).toISOString());
            formData.append('type', type);
            formData.append('reason', reason);
            if (attachment) {
                formData.append('attachment', attachment);
            }

            await api.post('/vacations', formData);

            toast.success("Solicitud enviada");
            setShowModal(false);
            fetchData();
            if (activeTab === 'MY_REQUESTS') fetchEmployeeStats();

            // Reset form
            setStartDate('');
            setEndDate('');
            setReason('');
            setAttachment(null);
        } catch (error: any) {
            toast.error(error.message || "Error al crear solicitud");
        }
    };

    const handleStatusUpdate = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        try {
            await api.put(`/vacations/${id}/status`, { status });
            toast.success(`Solicitud ${status === 'APPROVED' ? 'aprobada' : 'rechazada'}`);
            fetchData();
            if (selectedRequest && selectedRequest.id === id) {
                // Update selected request in modal if open
                setSelectedRequest({ ...selectedRequest, status });
            }
        } catch (error) {
            toast.error("Error al actualizar estado");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestión de Ausencias</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {user?.role === 'admin' ? 'Supervisión global y aprobaciones.' : 'Solicita y gestiona tus vacaciones y permisos.'}
                    </p>
                </div>

                <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    {user?.role !== 'admin' && (
                        <button
                            onClick={() => setActiveTab('MY_REQUESTS')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'MY_REQUESTS' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            Mis Solicitudes
                        </button>
                    )}

                    <button
                        onClick={() => setActiveTab('CALENDAR')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'CALENDAR' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                    >
                        {user?.role === 'admin' ? 'Calendario Global' : 'Calendario'}
                    </button>

                    {(user?.role === 'admin' || user?.role === 'manager') && (
                        <button
                            onClick={() => setActiveTab('MANAGE')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'MANAGE' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            {user?.role === 'admin' ? 'Solicitudes Pendientes' : 'Gestionar Equipo'}
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'CALENDAR' && (
                <CalendarView
                    vacations={filteredCalendarVacations}
                    onSelectRequest={(req) => setSelectedRequest(req)}
                    isAdmin={user?.role === 'admin'}
                    departments={departments}
                    selectedDept={selectedDept}
                    onDeptChange={setSelectedDept}
                />
            )}

            {activeTab === 'MY_REQUESTS' && (
                <div className="space-y-6">
                    {/* Quota Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Plane size={40} /></div>
                            <div className="text-sm font-medium text-slate-500 mb-1">Días Disponibles</div>
                            <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{stats.available}</div>
                            <div className="text-xs text-slate-400 mt-2">De un total de {stats.total}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <div className="text-sm font-medium text-slate-500 mb-1">Días Disfrutados</div>
                            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{stats.used}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <div className="text-sm font-medium text-slate-500 mb-1">Días Pendientes</div>
                            <div className="text-3xl font-black text-amber-500">{stats.pending}</div>
                            <div className="text-xs text-slate-400 mt-2">Esperando aprobación</div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30">
                            <Plane size={18} />
                            Nueva Solicitud
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {myRequests.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 p-12 rounded-[2rem] text-center border border-slate-200 dark:border-slate-800 border-dashed">
                                <Plane size={48} className="mx-auto text-slate-300 mb-4" />
                                <p className="text-slate-500 font-medium">No tienes solicitudes registradas.</p>
                            </div>
                        ) : (
                            myRequests.map((req) => (
                                <RequestCard key={req.id} req={req} isManager={false} />
                            ))
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'MANAGE' && (
                <div className="grid grid-cols-1 gap-4">
                    {pendingRequests.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 p-12 rounded-[2rem] text-center border border-slate-200 dark:border-slate-800 border-dashed">
                            <Check size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-500 font-medium">No hay solicitudes pendientes de aprobación.</p>
                        </div>
                    ) : (
                        pendingRequests.map((req) => (
                            <RequestCard
                                key={req.id}
                                req={req}
                                isManager={true}
                                onApprove={() => handleStatusUpdate(req.id, 'APPROVED')}
                                onReject={() => handleStatusUpdate(req.id, 'REJECTED')}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Modal for New Request (User) */}
            <AnimatePresence>
                {showModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">Nueva Solicitud</h3>
                                <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
                            </div>
                            <form onSubmit={handleCreate} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Desde</label>
                                        <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Hasta</label>
                                        <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {Object.entries(ABSENCE_TYPES).map(([k, c]) => (
                                            <button type="button" key={k} onClick={() => setType(k)} className={`p-2 rounded-xl border text-xs font-bold transition-all ${type === k ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{c.label}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Motivo</label>
                                    <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium h-24 resize-none" placeholder="Opcional..." />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Adjunto (Justificante)</label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            onChange={e => setAttachment(e.target.files?.[0] || null)}
                                            className="hidden"
                                            id="vacation-attachment"
                                        />
                                        <label
                                            htmlFor="vacation-attachment"
                                            className="flex items-center gap-2 w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 transition-colors cursor-pointer"
                                        >
                                            <Paperclip size={18} className="text-slate-400" />
                                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                                {attachment ? attachment.name : 'Seleccionar archivo...'}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all">Enviar Solicitud</button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal for Request Details (Admin/Calendar) */}
            <AnimatePresence>
                {selectedRequest && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">Detalle de Solicitud</h3>
                                <button onClick={() => setSelectedRequest(null)}><X size={20} className="text-slate-400" /></button>
                            </div>
                            <div className="p-6">
                                <RequestCard
                                    req={selectedRequest}
                                    isManager={true} // Allow actions
                                    onApprove={() => handleStatusUpdate(selectedRequest.id, 'APPROVED')}
                                    onReject={() => handleStatusUpdate(selectedRequest.id, 'REJECTED')}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Sub-component for Calendar Logic
function CalendarView({
    vacations,
    onSelectRequest,
    isAdmin,
    departments,
    selectedDept,
    onDeptChange
}: {
    vacations: VacationRequest[],
    onSelectRequest: (r: VacationRequest) => void,
    isAdmin: boolean,
    departments: string[],
    selectedDept: string,
    onDeptChange: (d: string) => void
}) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    const getDayEvents = (day: number) => {
        const target = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const targetTime = target.getTime();

        return vacations.filter(v => {
            const start = new Date(v.startDate).setHours(0, 0, 0, 0);
            const end = new Date(v.endDate).setHours(23, 59, 59, 999);
            return targetTime >= start && targetTime <= end;
        });
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-xl p-1">
                    <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all shadow-sm"><span className="text-xs">◀</span></button>
                    <span className="px-4 font-bold text-slate-700 dark:text-slate-200 min-w-[140px] text-center capitalize">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all shadow-sm"><span className="text-xs">▶</span></button>
                </div>
                <div className="flex items-center gap-4">
                    {isAdmin && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800">
                            <Filter size={14} className="text-slate-400" />
                            <select
                                value={selectedDept}
                                onChange={(e) => onDeptChange(e.target.value)}
                                className="bg-transparent text-[10px] font-bold outline-none text-slate-700 dark:text-slate-200"
                            >
                                <option value="ALL">TODOS LOS DEPTOS.</option>
                                {departments.map(d => (
                                    <option key={d} value={d}>{d.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden md:block">
                        {isAdmin ? 'Vista Global' : 'Mi Calendario'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 mb-2">
                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((d, i) => (
                    <div key={d} className={`text-center py-2 text-[10px] font-bold uppercase tracking-widest ${i >= 5 ? 'text-rose-500/70' : 'text-slate-400'}`}>
                        {d.substring(0, 3)}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-2 min-h-[600px] auto-rows-fr">
                {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} className="bg-slate-50/50 dark:bg-slate-800/20 rounded-xl" />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const events = getDayEvents(day);
                    const isWeekend = (offset + day) % 7 === 0 || (offset + day) % 7 === 6;
                    const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();

                    return (
                        <div key={day} className={`
                            relative p-2 rounded-xl border flex flex-col gap-1 transition-all h-full min-h-[100px]
                            ${isToday ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-800' : 'bg-transparent border-slate-100 dark:border-slate-800'}
                            ${isWeekend ? 'bg-slate-50/50 dark:bg-slate-900/50' : ''}
                        `}>
                            <span className={`text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}>{day}</span>

                            <div className="flex flex-col gap-1 overflow-y-auto max-h-[120px] custom-scrollbar">
                                {events.map((ev, idx) => {
                                    const conf = ABSENCE_TYPES[ev.type] || ABSENCE_TYPES.VACATION;
                                    const isPending = ev.status === 'PENDING';
                                    const isRejected = ev.status === 'REJECTED';
                                    // const isApproved = ev.status === 'APPROVED';

                                    return (
                                        <button
                                            key={idx}
                                            onClick={(e) => { e.stopPropagation(); onSelectRequest(ev); }}
                                            className={`
                                                w-full text-left px-1.5 py-1 rounded-md text-[9px] font-bold truncate flex items-center gap-1 border transition-all
                                                ${isPending
                                                    ? 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200'
                                                    : isRejected
                                                        ? 'bg-slate-100 text-slate-500 border-slate-200 opacity-60 hover:opacity-100'
                                                        : `${conf.bgSoft} ${conf.text} ${conf.border} hover:brightness-95`
                                                }
                                            `}
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full ${isPending ? 'bg-amber-500 animate-pulse' : isRejected ? 'bg-slate-400' : conf.color}`} />
                                            {ev.employee?.name.split(' ')[0]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function RequestCard({ req, isManager, onApprove, onReject }: any) {
    const conf = ABSENCE_TYPES[req.type] || ABSENCE_TYPES.VACATION;
    const start = new Date(req.startDate);
    const end = new Date(req.endDate);

    return (
        <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 md:items-center">
            <div className={`w-12 h-12 rounded-2xl ${conf.bgSoft} ${conf.text} flex items-center justify-center shrink-0`}>
                <conf.icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{req.employee?.name || 'Yo'}</h3>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : req.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {req.status === 'PENDING' ? 'Pendiente' : req.status === 'APPROVED' ? 'Aprobada' : 'Rechazada'}
                    </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><CalendarIcon size={14} /> {start.toLocaleDateString()} - {end.toLocaleDateString()}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">({req.days} días)</span>
                    {req.reason && <span className="italic truncate max-w-[200px]">— {req.reason}</span>}
                    {req.fileUrl && (
                        <a
                            href={`${API_URL}/vacations/${req.id}/attachment`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold"
                        >
                            <ExternalLink size={14} /> Ver Adjunto
                        </a>
                    )}
                </div>
            </div>

            {isManager && req.status === 'PENDING' && (
                <div className="flex items-center gap-2 mt-2 md:mt-0">
                    <button onClick={onReject} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-colors flex items-center gap-2">
                        <X size={16} /> Rechazar
                    </button>
                    <button onClick={onApprove} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2">
                        <Check size={16} /> Aprobar
                    </button>
                </div>
            )}
        </div>
    );
}
