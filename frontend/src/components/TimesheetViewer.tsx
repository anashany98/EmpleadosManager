import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Clock, LogIn, LogOut, Coffee, Calendar, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

interface TimeEntry {
    id: string;
    date: string;
    checkIn?: string;
    checkOut?: string;
    lunchStart?: string;
    lunchEnd?: string;
    totalHours: number;
    lunchHours: number;
    notes?: string;
}

interface TimesheetViewerProps {
    employeeId: string;
}

import { useConfirm } from '../context/ConfirmContext';

export function TimesheetViewer({ employeeId }: TimesheetViewerProps) {
    const confirmAction = useConfirm();
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [showAddModal, setShowAddModal] = useState(false);
    const [summary, setSummary] = useState({
        totalHours: 0,
        totalLunchHours: 0,
        daysWorked: 0,
        daysIncomplete: 0
    });

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        checkIn: '',
        checkOut: '',
        lunchStart: '',
        lunchEnd: '',
        notes: ''
    });

    useEffect(() => {
        fetchEntries();
    }, [employeeId, currentMonth]);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth() + 1;
            const result = await api.get(`/time-entries/employee/${employeeId}/month/${year}/${month}`);
            setEntries(result.entries || []);
            setSummary(result.summary || { totalHours: 0, totalLunchHours: 0, daysWorked: 0, daysIncomplete: 0 });
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar fichajes');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        try {
            const payload = {
                employeeId,
                date: formData.date,
                checkIn: formData.checkIn ? `${formData.date}T${formData.checkIn}:00` : null,
                checkOut: formData.checkOut ? `${formData.date}T${formData.checkOut}:00` : null,
                lunchStart: formData.lunchStart ? `${formData.date}T${formData.lunchStart}:00` : null,
                lunchEnd: formData.lunchEnd ? `${formData.date}T${formData.lunchEnd}:00` : null,
                notes: formData.notes || null
            };

            await api.post('/time-entries', payload);
            toast.success('Fichaje guardado correctamente');
            setShowAddModal(false);
            setFormData({
                date: new Date().toISOString().split('T')[0],
                checkIn: '',
                checkOut: '',
                lunchStart: '',
                lunchEnd: '',
                notes: ''
            });
            fetchEntries();
        } catch (error) {
            toast.error('Error al guardar fichaje');
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await confirmAction({
            title: 'Eliminar Fichaje',
            message: '¿Estás seguro de eliminar este registro de fichaje?',
            confirmText: 'Eliminar',
            type: 'danger'
        });

        if (!ok) return;
        try {
            await api.delete(`/time-entries/${id}`);
            toast.success('Fichaje eliminado');
            fetchEntries();
        } catch (error) {
            toast.error('Error al eliminar fichaje');
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
        return new Date(dateString).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    if (loading) {
        return <div className="p-10 text-center animate-pulse">Cargando fichajes...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header with Month Navigation */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Clock className="text-blue-500" size={24} />
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Control de Fichajes</h3>
                        <p className="text-sm text-slate-500">Registro de entradas y salidas</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button onClick={prevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors">
                            <ChevronLeft size={18} />
                        </button>
                        <span className="px-4 py-1 font-medium text-sm">
                            {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={nextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={18} />
                        Añadir Fichaje
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-medium mb-1">
                        <Clock size={16} />
                        Total Horas
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {summary.totalHours.toFixed(1)}h
                    </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium mb-1">
                        <Calendar size={16} />
                        Días Trabajados
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {summary.daysWorked}
                    </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl">
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-sm font-medium mb-1">
                        <Coffee size={16} />
                        Horas Pausa
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {summary.totalLunchHours.toFixed(1)}h
                    </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/20 dark:to-slate-700/20 rounded-xl">
                    <div className="text-sm font-medium mb-1 text-slate-600 dark:text-slate-400">
                        Promedio/Día
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {summary.daysWorked > 0 ? (summary.totalHours / summary.daysWorked).toFixed(1) : '0'}h
                    </div>
                </div>
            </div>

            {/* Entries List */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Entrada</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Salida</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pausa</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Total</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {entries.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                        No hay fichajes registrados este mes
                                    </td>
                                </tr>
                            ) : (
                                entries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-900 dark:text-white">
                                                {formatDate(entry.date)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                                <LogIn size={14} />
                                                {formatTime(entry.checkIn)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                                <LogOut size={14} />
                                                {formatTime(entry.checkOut)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {entry.lunchStart && entry.lunchEnd ? (
                                                <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                                    <Coffee size={14} />
                                                    {entry.lunchHours.toFixed(1)}h
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-bold text-blue-600 dark:text-blue-400">
                                                {entry.totalHours.toFixed(2)}h
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(entry.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Añadir Fichaje</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha</label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hora Entrada</label>
                                    <input
                                        type="time"
                                        value={formData.checkIn}
                                        onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hora Salida</label>
                                    <input
                                        type="time"
                                        value={formData.checkOut}
                                        onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Inicio Pausa</label>
                                    <input
                                        type="time"
                                        value={formData.lunchStart}
                                        onChange={(e) => setFormData({ ...formData, lunchStart: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fin Pausa</label>
                                    <input
                                        type="time"
                                        value={formData.lunchEnd}
                                        onChange={(e) => setFormData({ ...formData, lunchEnd: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notas (opcional)</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    rows={2}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
