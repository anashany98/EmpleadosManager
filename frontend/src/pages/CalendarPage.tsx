import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Clock, Baby, Plane, Stethoscope, FileText, MoreHorizontal } from 'lucide-react';
import { api } from '../api/client';

const ABSENCE_TYPES = {
    VACATION: { label: 'Vacaciones', color: 'bg-emerald-100 text-emerald-700', icon: Plane },
    SICK: { label: 'Baja Médica', color: 'bg-rose-100 text-rose-700', icon: Stethoscope },
    BIRTH: { label: 'Nacimiento/Cuidado', color: 'bg-blue-100 text-blue-700', icon: Baby },
    MEDICAL_HOURS: { label: 'Horas Médicas', color: 'bg-indigo-100 text-indigo-700', icon: Clock },
    PERSONAL: { label: 'Asuntos Propios', color: 'bg-amber-100 text-amber-700', icon: FileText },
    OTHER: { label: 'Otros', color: 'bg-slate-100 text-slate-700', icon: MoreHorizontal },
};

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [vacations, setVacations] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState('ALL');

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
        try {
            const [vacDocs, empDocs] = await Promise.all([
                api.get('/vacations'),
                api.get('/employees')
            ]);
            setVacations(vacDocs);
            setEmployees(empDocs);
            setVacations(vacDocs);
            setEmployees(empDocs);
        } catch (e) { console.error(e); }
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
            // Start new selection
            setSelectionStart(clickedDate);
            setSelectionEnd(null);
        } else {
            // Complete selection
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
            alert('Ausencia registrada correctamente');
        } catch (error) {
            alert('Error al guardar');
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

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Calendario de Ausencias</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        {selectedDepartment === 'ALL' ? 'Vista Global de la Empresa' : `Departamento: ${selectedDepartment}`}
                    </p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* Department Sidebar */}
                <div className="w-full lg:w-64 shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Departamentos</h3>
                    <div className="space-y-1">
                        {departments.map(dept => (
                            <button
                                key={dept}
                                onClick={() => setSelectedDepartment(dept)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${selectedDepartment === dept
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <span className="truncate">{dept === 'ALL' ? 'Todos' : dept}</span>
                                {selectedDepartment === dept && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                            </button>
                        ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Resumen</h3>
                        <div className="space-y-3 px-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500">Ausencias Mes</span>
                                <span className="text-sm font-bold dark:text-white">{filteredVacations.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Calendar Content */}
                <div className="flex-1 w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden select-none">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2 capitalize">
                            <CalendarIcon size={20} className="text-blue-500" />
                            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </h2>
                        <div className="flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-inner border border-slate-100 dark:border-slate-700">
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                <ChevronLeft size={20} />
                            </button>
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(new Date().getMonth(), new Date().getDate())))} className="px-3 py-1 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                Hoy
                            </button>
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="p-6">
                        <div className="grid grid-cols-7 mb-2">
                            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                                <div key={d} className="text-center font-semibold text-slate-400 text-sm uppercase">{d}</div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-2 lg:gap-3">
                            {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} className="min-h-[160px]" />)}

                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const events = getDayEvents(day);
                                const today = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
                                const selected = isSelected(day);

                                return (
                                    <div
                                        key={day}
                                        onClick={() => handleDayClick(day)}
                                        className={`
                                min-h-[160px] p-3 rounded-xl transition-all cursor-pointer border
                                ${selected
                                                ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700 z-10 scale-[1.02] shadow-sm'
                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'}
                                ${today ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : ''}
                             `}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-sm font-bold ${today ? 'text-blue-600' : 'text-slate-700 dark:text-slate-300'}`}>{day}</span>
                                            {events.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>}
                                        </div>

                                        <div className="space-y-1">
                                            {events.slice(0, 3).map((v, idx) => {
                                                const typeConfig = ABSENCE_TYPES[v.type as keyof typeof ABSENCE_TYPES] || ABSENCE_TYPES.VACATION;
                                                return (
                                                    <div key={idx} className={`text-[10px] px-1.5 py-0.5 rounded ${typeConfig.color} font-medium truncate flex justify-between items-center`} title={`${v.employee?.name} - ${typeConfig.label}`}>
                                                        <span>{v.employee?.name.split(' ')[0]}</span>
                                                        {v.type === 'MEDICAL_HOURS' && v.reason && <span className="font-bold opacity-70 ml-1">{v.reason}h</span>}
                                                    </div>
                                                )
                                            })}
                                            {events.length > 3 && (
                                                <div className="text-[10px] text-slate-400 pl-1">+ {events.length - 3} más</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold dark:text-white">Nueva Ausencia</h3>
                                <button onClick={() => { setShowModal(false); setSelectionStart(null); setSelectionEnd(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Date Range Display */}
                                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex-1 text-center border-r border-slate-200 dark:border-slate-700 pr-4">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Desde</p>
                                        <p className="font-medium text-slate-900 dark:text-white">{selectionStart?.toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex-1 text-center pl-4">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Hasta</p>
                                        <p className="font-medium text-slate-900 dark:text-white">{(selectionEnd || selectionStart)?.toLocaleDateString()}</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Empleado</label>
                                    <select
                                        required
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        value={selectedEmployee}
                                        onChange={(e) => setSelectedEmployee(e.target.value)}
                                    >
                                        <option value="">Seleccionar empleado...</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tipo de Ausencia</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {Object.entries(ABSENCE_TYPES).map(([key, config]) => {
                                            const Icon = config.icon;
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => setVacationType(key)}
                                                    className={`p-3 rounded-xl border text-sm font-medium transition-all flex items-center gap-2
                                            ${vacationType === key
                                                            ? `ring-2 ring-blue-500 border-transparent bg-blue-600 text-white shadow-md`
                                                            : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}
                                         `}
                                                >
                                                    <Icon size={16} />
                                                    {config.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {vacationType === 'MEDICAL_HOURS' && (
                                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-bold text-indigo-700 dark:text-indigo-300 uppercase">Horas Médicas</label>
                                            <Clock size={16} className="text-indigo-500" />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                step="0.5"
                                                required
                                                min="0.5"
                                                value={medicalHours}
                                                onChange={(e) => setMedicalHours(e.target.value)}
                                                placeholder="Ej: 2.5"
                                                className="w-32 p-3 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-black text-lg"
                                            />
                                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">horas justificadas</span>
                                        </div>
                                    </div>
                                )}

                                {vacationType === 'OTHER' && (
                                    <div className="animate-in slide-in-from-top-2 duration-300">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Especificar Motivo</label>
                                        <textarea
                                            required
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            placeholder="Ej: Permiso por mudanza, examen oficial..."
                                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[100px]"
                                        />
                                    </div>
                                )}

                                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 transform">
                                    Confirmar Registro
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
