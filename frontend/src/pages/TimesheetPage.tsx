import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Clock, Calendar, ChevronLeft, ChevronRight, User } from 'lucide-react';

interface Employee {
    id: string;
    name: string;
    department: string;
}

interface TimeEntry {
    id: string;
    date: string;
    checkIn?: string;
    checkOut?: string;
    lunchStart?: string;
    lunchEnd?: string;
    totalHours: number;
    lunchHours: number;
    employee: {
        id: string;
        name: string;
        department: string;
    };
}

export default function TimesheetPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

    useEffect(() => {
        fetchEmployees();
    }, []);

    useEffect(() => {
        fetchEntries();
    }, [selectedEmployee, currentMonth]);

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/employees');
            setEmployees(res.data || res || []);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar empleados');
        }
    };

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth() + 1;
            const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];

            const url = selectedEmployee === 'all'
                ? `/time-entries/range?from=${startDate}&to=${endDate}`
                : `/time-entries/range?from=${startDate}&to=${endDate}&employeeId=${selectedEmployee}`;

            const res = await api.get(url);
            setEntries(res.data || res || []);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar fichajes');
        } finally {
            setLoading(false);
        }
    };

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };

    const formatTime = (dateString?: string) => {
        if (!dateString) return '--:--';
        return new Date(dateString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };

    // Filter Logic
    const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort();

    // Filter employees for dropdown
    const filteredEmployees = employees.filter(emp =>
        selectedDepartment === 'all' || emp.department === selectedDepartment
    );

    // Filter actual time entries
    const displayedEntries = entries.filter(entry =>
        selectedDepartment === 'all' || entry.employee.department === selectedDepartment
    );

    // Calcular resumen (using displayedEntries)
    const summary = {
        totalHours: displayedEntries.reduce((sum, e) => sum + e.totalHours, 0),
        totalLunchHours: displayedEntries.reduce((sum, e) => sum + e.lunchHours, 0),
        daysWorked: displayedEntries.filter(e => e.checkIn && e.checkOut).length,
        uniqueEmployees: new Set(displayedEntries.map(e => e.employee.id)).size
    };

    // Agrupar entradas por fecha para vista calendario
    const entriesByDate = displayedEntries.reduce((acc, entry) => {
        const date = entry.date.split('T')[0];
        if (!acc[date]) acc[date] = [];
        acc[date].push(entry);
        return acc;
    }, {} as Record<string, TimeEntry[]>);

    // Generar días del mes
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
        days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 rounded-xl text-white">
                        <Clock size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Control de Fichajes</h1>
                        <p className="text-slate-500">Vista global de entradas y salidas</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Department Filter */}
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Departamento
                        </label>
                        <select
                            value={selectedDepartment}
                            onChange={(e) => {
                                setSelectedDepartment(e.target.value);
                                setSelectedEmployee('all'); // Reset employee filter when department changes
                            }}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                        >
                            <option value="all">Todos los departamentos</option>
                            {departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>

                    {/* Employee Filter */}
                    <div className="flex-1 min-w-[250px]">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            <User size={16} className="inline mr-1" />
                            Empleado
                        </label>
                        <select
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                        >
                            <option value="all">Todos ({filteredEmployees.length})</option>
                            {filteredEmployees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Month Navigation */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            <Calendar size={16} className="inline mr-1" />
                            Mes
                        </label>
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                            <button onClick={prevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors">
                                <ChevronLeft size={18} />
                            </button>
                            <span className="px-4 py-1 font-medium text-sm min-w-[150px] text-center">
                                {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                            </span>
                            <button onClick={nextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors">
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>

                    {/* View Mode Toggle */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Vista</label>
                        <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${viewMode === 'calendar'
                                    ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400'
                                    }`}
                            >
                                Calendario
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${viewMode === 'list'
                                    ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400'
                                    }`}
                            >
                                Lista
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl">
                    <div className="text-blue-600 dark:text-blue-400 text-sm font-medium mb-1">Total Horas</div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{summary.totalHours.toFixed(1)}h</div>
                </div>
                <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl">
                    <div className="text-green-600 dark:text-green-400 text-sm font-medium mb-1">Fichajes Registrados</div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{summary.daysWorked}</div>
                </div>
                <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl">
                    <div className="text-orange-600 dark:text-orange-400 text-sm font-medium mb-1">Empleados Activos</div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{summary.uniqueEmployees}</div>
                </div>
                <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl">
                    <div className="text-purple-600 dark:text-purple-400 text-sm font-medium mb-1">Promedio/Día</div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">
                        {summary.daysWorked > 0 ? (summary.totalHours / summary.daysWorked).toFixed(1) : '0'}h
                    </div>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-20 text-center">
                    <div className="animate-pulse text-slate-500">Cargando fichajes...</div>
                </div>
            ) : viewMode === 'calendar' ? (
                /* Calendar View */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="p-6">
                        <div className="grid grid-cols-7 gap-2">
                            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
                                <div key={day} className="text-center font-bold text-slate-500 text-sm py-2">
                                    {day}
                                </div>
                            ))}
                            {days.map((day, idx) => {
                                if (!day) return <div key={idx} className="aspect-square" />;

                                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const dayEntries = entriesByDate[dateKey] || [];
                                const totalHours = dayEntries.reduce((sum, e) => sum + e.totalHours, 0);

                                return (
                                    <div
                                        key={idx}
                                        className={`aspect-square border border-slate-100 dark:border-slate-800 rounded-lg p-2 text-center ${dayEntries.length > 0 ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                            }`}
                                    >
                                        <div className="text-xs font-medium text-slate-500">{day}</div>
                                        {dayEntries.length > 0 && (
                                            <div className="mt-1">
                                                <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                    {dayEntries.length} {dayEntries.length === 1 ? 'persona' : 'personas'}
                                                </div>
                                                <div className="text-xs text-slate-600 dark:text-slate-400">
                                                    {totalHours.toFixed(1)}h
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : (
                /* List View */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Empleado</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Entrada</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Salida</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pausa</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {displayedEntries.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                            No hay fichajes registrados que coincidan con los filtros
                                        </td>
                                    </tr>
                                ) : (
                                    displayedEntries.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-900 dark:text-white">{entry.employee.name}</div>
                                                <div className="text-xs text-slate-500">{entry.employee.department}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium">{formatDate(entry.date)}</td>
                                            <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400">{formatTime(entry.checkIn)}</td>
                                            <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{formatTime(entry.checkOut)}</td>
                                            <td className="px-4 py-3 text-sm">
                                                {entry.lunchHours > 0 ? `${entry.lunchHours.toFixed(1)}h` : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-bold text-blue-600 dark:text-blue-400">
                                                    {entry.totalHours.toFixed(2)}h
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
