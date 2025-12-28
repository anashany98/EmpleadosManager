import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Clock, Baby, Plane, Stethoscope, FileText, MoreHorizontal, Filter, Sparkles, User, Check } from 'lucide-react';
import { api } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const ABSENCE_TYPES = {
    VACATION: { label: 'Vacaciones', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500', icon: Plane },
    SICK: { label: 'Baja Médica', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', dot: 'bg-rose-500', icon: Stethoscope },
    BIRTH: { label: 'Nacimiento', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', dot: 'bg-blue-500', icon: Baby },
    MEDICAL_HOURS: { label: 'Horas Médicas', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20', dot: 'bg-indigo-500', icon: Clock },
    PERSONAL: { label: 'Asuntos Propios', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', dot: 'bg-amber-500', icon: FileText },
    OTHER: { label: 'Otros', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', dot: 'bg-slate-500', icon: MoreHorizontal },
};

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [vacations, setVacations] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState('ALL');
    const [loading, setLoading] = useState(true);

    // Selection State
    const [selectionStart, setSelectionStart] = useState<Date | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<Date | null>(null);

    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [vacationType, setVacationType] = useState('VACATION');
    const [reason, setReason] = useState('');
    const [medicalHours, setMedicalHours] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [vacRes, empRes] = await Promise.all([
                api.get('/vacations'),
                api.get('/employees')
            ]);
            setVacations(vacRes.data || vacRes || []);
            setEmployees(empRes.data || empRes || []);
        } catch (e) {
            console.error(e);
            toast.error("Error al cargar datos");
        } finally {
            setLoading(false);
        }
    };

    const departments = ['ALL', ...new Set(employees.map(e => e.department).filter(Boolean))];

    const filteredVacations = selectedDepartment === 'ALL'
        ? vacations
        : vacations.filter(v => v.employee?.department === selectedDepartment);

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    const handleDayClick = (day: number) => {
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);

        if (!selectionStart || (selectionStart && selectionEnd)) {
            setSelectionStart(clickedDate);
            setSelectionEnd(null);
        } else {
            if (clickedDate < selectionStart) {
                setSelectionEnd(selectionStart);
                setSelectionStart(clickedDate);
            } else {
                setSelectionEnd(clickedDate);
            }
            setShowModal(true);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployee || !selectionStart) return;

        const end = selectionEnd || selectionStart;
        const toastId = toast.loading('Guardando ausencia...');

        try {
            await api.post('/vacations', {
                employeeId: selectedEmployee,
                startDate: selectionStart.toISOString(),
                endDate: end.toISOString(),
                type: vacationType,
                reason: vacationType === 'MEDICAL_HOURS' ? medicalHours : (vacationType === 'OTHER' ? reason : null)
            });
            setShowModal(false);
            setSelectionStart(null);
            setSelectionEnd(null);
            setReason('');
            fetchData();
            toast.success('Ausencia registrada correctamente', { id: toastId });
        } catch (error) {
            toast.error('Error al guardar', { id: toastId });
        }
    };

    const getDayEvents = (day: number) => {
        const target = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const targetTime = target.getTime();

        return filteredVacations.filter(v => {
            const start = new Date(v.startDate).setHours(0, 0, 0, 0);
            const end = new Date(v.endDate).setHours(23, 59, 59, 999);
            return targetTime >= start && targetTime <= end;
        });
    }

    const isSelected = (day: number) => {
        if (!selectionStart) return false;
        const target = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getTime();
        const start = selectionStart.getTime();
        const end = selectionEnd ? selectionEnd.getTime() : start;
        return target >= start && target <= end;
    }

    const isToday = (day: number) => {
        const today = new Date();
        return day === today.getDate() &&
            currentDate.getMonth() === today.getMonth() &&
            currentDate.getFullYear() === today.getFullYear();
    }

    return (
        <div className="min-h-screen space-y-8 animate-in fade-in duration-700 pb-20">
            {/* Elegant Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="text-blue-500 w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Gestión de Tiempo</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Calendario de Ausencias</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                        Planifica y visualiza el equipo de un vistazo
                    </p>
                </div>

                <div className="flex gap-2 p-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-x-auto max-w-full">
                    {departments.map(dept => (
                        <button
                            key={dept}
                            onClick={() => setSelectedDepartment(dept)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${selectedDepartment === dept
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            {dept === 'ALL' ? 'Toda la Empresa' : dept}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Full Width Layout */}
                <div className="w-full space-y-6">
                    {/* Horizontal Legend Bar */}
                    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[32px] border border-white/20 dark:border-slate-800/50 p-6 shadow-xl flex flex-wrap items-center justify-center gap-6 sm:justify-between">
                        <div className="flex items-center gap-6 flex-wrap justify-center">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                    <Filter size={16} />
                                </div>
                                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-xs">Leyenda</h3>
                            </div>
                            <div className="flex flex-wrap gap-4 justify-center">
                                {Object.entries(ABSENCE_TYPES).map(([key, config]) => (
                                    <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 transition-colors group">
                                        <div className={`w-3 h-3 rounded-full ${config.dot}`} />
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">{config.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="h-10 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                            <div className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white shadow-lg shadow-blue-500/20 flex items-center gap-3">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Total:</p>
                                <h4 className="text-xl font-black">{filteredVacations.length}</h4>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[40px] border border-white/20 dark:border-slate-800/50 shadow-2xl overflow-hidden min-h-[900px] flex flex-col">
                        {/* Custom Header */}
                        <div className="p-8 flex flex-col sm:flex-row justify-between items-center bg-slate-50/30 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800 gap-6">
                            <div className="flex items-center gap-6">
                                <motion.h2
                                    key={currentDate.getMonth()}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="text-4xl font-black text-slate-900 dark:text-white capitalize flex items-center gap-3"
                                >
                                    <div className="w-2 h-10 bg-blue-500 rounded-full" />
                                    {currentDate.toLocaleString('default', { month: 'long' })}
                                    <span className="text-slate-300 dark:text-slate-700 text-2xl ml-2 font-medium">{currentDate.getFullYear()}</span>
                                </motion.h2>
                            </div>

                            <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-950/50 p-2 rounded-[24px] border border-slate-100 dark:border-slate-800">
                                <button
                                    onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                                    className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all text-slate-600 dark:text-slate-400 hover:text-blue-500"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <button
                                    onClick={() => setCurrentDate(new Date())}
                                    className="px-6 py-2 text-sm font-black uppercase tracking-widest text-blue-600 hover:bg-white dark:hover:bg-slate-800 rounded-2xl transition-all"
                                >
                                    Hoy
                                </button>
                                <button
                                    onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                                    className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all text-slate-600 dark:text-slate-400 hover:text-blue-500"
                                >
                                    <ChevronRight size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Calendar Grid */}
                        <div className="p-8 flex-1">
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center space-y-4 animate-pulse">
                                    <div className="w-16 h-16 bg-blue-500/10 rounded-[20px] flex items-center justify-center text-blue-500">
                                        <CalendarIcon size={32} />
                                    </div>
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Sincronizando calendario...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-7 mb-6">
                                        {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((d, i) => (
                                            <div key={d} className={`text-center font-black text-xs uppercase tracking-[0.2em] ${i > 4 ? 'text-rose-400' : 'text-slate-400'}`}>
                                                {d}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-7 gap-4">
                                        {Array.from({ length: offset }).map((_, i) => (
                                            <div key={`empty-${i}`} className="aspect-square opacity-0" />
                                        ))}

                                        {Array.from({ length: daysInMonth }).map((_, i) => {
                                            const day = i + 1;
                                            const events = getDayEvents(day);
                                            const today = isToday(day);
                                            const selected = isSelected(day);
                                            const isWeekend = (offset + day) % 7 === 0 || (offset + day) % 7 === 6;

                                            return (
                                                <motion.div
                                                    key={day}
                                                    whileHover={{ scale: 1.01, y: -2 }}
                                                    onClick={() => handleDayClick(day)}
                                                    className={`
                                                        relative min-h-[220px] p-6 rounded-[34px] transition-all cursor-pointer border-2 group
                                                        ${selected
                                                            ? 'bg-blue-600 border-blue-400 shadow-xl shadow-blue-900/30 z-10'
                                                            : today
                                                                ? 'bg-white dark:bg-slate-800 border-blue-500/50 shadow-lg shadow-blue-500/10'
                                                                : isWeekend
                                                                    ? 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-100/50 dark:border-slate-800/50'
                                                                    : 'bg-white/50 dark:bg-slate-900/50 border-white/50 dark:border-slate-800/50 hover:bg-white dark:hover:bg-slate-900 hover:border-blue-500/20'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex justify-between items-start mb-4">
                                                        <span className={`
                                                            text-2xl font-black transition-colors
                                                            ${selected ? 'text-white' : today ? 'text-blue-600' : 'text-slate-900 dark:text-white'}
                                                        `}>
                                                            {day}
                                                        </span>
                                                        {events.length > 0 && !selected && (
                                                            <div className="flex -space-x-1">
                                                                {events.slice(0, 3).map((_, idx) => (
                                                                    <div key={idx} className="w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 bg-blue-500" />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-2 h-[80px] overflow-y-auto no-scrollbar">
                                                        {events.map((v, idx) => {
                                                            const typeConfig = ABSENCE_TYPES[v.type as keyof typeof ABSENCE_TYPES] || ABSENCE_TYPES.VACATION;
                                                            return (
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: 5 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: idx * 0.05 }}
                                                                    key={idx}
                                                                    className={`
                                                                        text-[10px] px-3 py-1.5 rounded-xl font-bold truncate flex items-center justify-between border
                                                                        ${selected ? 'bg-white/10 text-white border-white/20' : `${typeConfig.color}`}
                                                                    `}
                                                                >
                                                                    <span className="truncate">{v.employee?.name}</span>
                                                                    {v.type === 'MEDICAL_HOURS' && v.reason && <span className="opacity-70 ml-1">{v.reason}h</span>}
                                                                </motion.div>
                                                            )
                                                        })}
                                                    </div>

                                                    {!selected && events.length === 0 && (
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                                <Filter size={16} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowModal(false)}
                            className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20 dark:border-slate-800"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-500" />

                            <div className="p-10">
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Registro de Ausencia</h3>
                                        <p className="text-slate-500 font-medium mt-1">Completa los detalles de la solicitud</p>
                                    </div>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 transition-all flex items-center justify-center"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-8">
                                    {/* Innovative Date Display */}
                                    <div className="grid grid-cols-2 gap-4 p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-[32px] border border-blue-100/50 dark:border-blue-800/30">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest px-1">Fecha Inicio</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-blue-500 shadow-sm font-black text-lg">
                                                    {selectionStart?.getDate()}
                                                </div>
                                                <div className="font-bold text-slate-900 dark:text-white">
                                                    {selectionStart?.toLocaleString('default', { month: 'short', year: 'numeric' })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-1 border-l border-blue-100 dark:border-blue-800 pl-6">
                                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest px-1">Fecha Final</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-blue-500 shadow-sm font-black text-lg">
                                                    {(selectionEnd || selectionStart)?.getDate()}
                                                </div>
                                                <div className="font-bold text-slate-900 dark:text-white">
                                                    {(selectionEnd || selectionStart)?.toLocaleString('default', { month: 'short', year: 'numeric' })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                                <User size={12} className="text-blue-500" />
                                                Colaborador
                                            </label>
                                            <select
                                                required
                                                className="w-full p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:border-blue-500 outline-none transition-all appearance-none"
                                                value={selectedEmployee}
                                                onChange={(e) => setSelectedEmployee(e.target.value)}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {employees.map(emp => (
                                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                                <Clock size={12} className="text-blue-500" />
                                                Categoría
                                            </label>
                                            <select
                                                required
                                                className="w-full p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:border-blue-500 outline-none transition-all appearance-none"
                                                value={vacationType}
                                                onChange={(e) => setVacationType(e.target.value)}
                                            >
                                                {Object.entries(ABSENCE_TYPES).map(([key, config]) => (
                                                    <option key={key} value={key}>{config.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Conditional Inputs with Smooth Reveal */}
                                    <AnimatePresence mode="wait">
                                        {vacationType === 'MEDICAL_HOURS' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="p-8 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-[32px] border border-indigo-200/50 dark:border-indigo-800/30"
                                            >
                                                <div className="flex justify-between items-center mb-4">
                                                    <label className="font-black text-indigo-700 dark:text-indigo-300 uppercase text-xs tracking-widest">Horas Justificadas</label>
                                                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                                                        <Clock size={18} />
                                                    </div>
                                                </div>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    required
                                                    min="0.5"
                                                    value={medicalHours}
                                                    onChange={(e) => setMedicalHours(e.target.value)}
                                                    placeholder="0.0"
                                                    className="w-full bg-transparent text-5xl font-black text-indigo-600 dark:text-indigo-400 outline-none placeholder:opacity-20"
                                                />
                                            </motion.div>
                                        )}

                                        {vacationType === 'OTHER' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="space-y-3"
                                            >
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Especificar Razón</label>
                                                <textarea
                                                    required
                                                    value={reason}
                                                    onChange={(e) => setReason(e.target.value)}
                                                    placeholder="Describe el motivo del permiso..."
                                                    className="w-full p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:border-blue-500 outline-none transition-all min-h-[120px]"
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <button
                                        type="submit"
                                        className="w-full group relative overflow-hidden bg-slate-900 dark:bg-blue-600 text-white font-black py-6 rounded-[28px] shadow-2xl transition-all active:scale-[0.98] mt-4"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                        <span className="relative flex items-center justify-center gap-3 text-lg tracking-tight">
                                            Confirmar Registro <Check size={20} className="stroke-[3]" />
                                        </span>
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
