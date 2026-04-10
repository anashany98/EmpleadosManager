import { useCallback, useEffect, useState } from 'react';
import { Clock, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../api/client';
import { useConfirm } from '../../../context/ConfirmContext';
import { isHoliday } from '../../../utils/holidays';
import type { OvertimeEntry, OvertimeRate } from '../types';

function extractArray<T>(payload: unknown): T[] {
    if (Array.isArray(payload)) {
        return payload as T[];
    }

    if (payload && typeof payload === 'object' && 'data' in payload) {
        const data = (payload as { data?: unknown }).data;
        return Array.isArray(data) ? (data as T[]) : [];
    }

    return [];
}

export function OvertimeTracker({ employeeId, category }: { employeeId: string; category: string }) {
    const confirmAction = useConfirm();
    const [hours, setHours] = useState<number>(0);
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [rateType, setRateType] = useState<'NORMAL' | 'HOLIDAY'>('NORMAL');
    const [rateInfo, setRateInfo] = useState({ normal: 0, holiday: 0 });
    const [entries, setEntries] = useState<OvertimeEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const currentRate = rateType === 'NORMAL' ? rateInfo.normal : rateInfo.holiday;

    useEffect(() => {
        if (!date) return;
        const currentDate = new Date(date);
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        setRateType(isWeekend || isHoliday(currentDate) ? 'HOLIDAY' : 'NORMAL');
    }, [date]);

    const fetchRateAndEntries = useCallback(async () => {
        setLoading(true);
        try {
            const rates = extractArray<OvertimeRate>(await api.get('/overtime/rates'));
            const categoryRate = rates.find((rate) => rate.category === category);

            setRateInfo({
                normal: categoryRate?.overtimeRate || 0,
                holiday: categoryRate?.holidayOvertimeRate || 0
            });

            setEntries(extractArray<OvertimeEntry>(await api.get(`/overtime/employee/${employeeId}`)));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [category, employeeId]);

    useEffect(() => {
        void fetchRateAndEntries();
    }, [fetchRateAndEntries]);

    const handleAdd = async () => {
        if (hours <= 0) return;
        try {
            await api.post('/overtime', {
                employeeId,
                hours,
                rate: currentRate,
                date: date ? new Date(date) : new Date()
            });
            toast.success('Horas extras registradas');
            setHours(0);
            void fetchRateAndEntries();
        } catch {
            toast.error('Error al registrar horas');
        }
    };

    const handleDelete = useCallback(async (entryId: string) => {
        const confirmed = await confirmAction({
            title: 'Eliminar Registro',
            message: '¿Estás seguro de eliminar este registro de horas extras?',
            confirmText: 'Eliminar',
            type: 'danger'
        });

        if (!confirmed) return;

        try {
            await api.delete(`/overtime/${entryId}`);
            toast.success('Registro eliminado');
            void fetchRateAndEntries();
        } catch {
            toast.error('Error al eliminar');
        }
    }, [confirmAction, fetchRateAndEntries]);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500 rounded-lg text-white">
                        <Clock size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registro de Horas Extras</h2>
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <span>Categoría: <span className="font-semibold text-amber-600">{category || 'Sin categoría'}</span></span>
                            <span>·</span>
                            <span>Tarifa Actual: <span className="font-semibold">{formatCurrency(currentRate)}/h</span></span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Fecha</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(event) => setDate(event.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Tipo de Hora</label>
                            <div className="flex p-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setRateType('NORMAL')}
                                    className={`flex-1 py-1 px-3 text-xs font-medium rounded-md transition-colors ${rateType === 'NORMAL' ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    Normal
                                </button>
                                <button
                                    onClick={() => setRateType('HOLIDAY')}
                                    className={`flex-1 py-1 px-3 text-xs font-medium rounded-md transition-colors ${rateType === 'HOLIDAY' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    Festivo/Finde
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Cantidad de Horas</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={hours || ''}
                                    onChange={(event) => setHours(parseFloat(event.target.value))}
                                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                                    placeholder="Ej: 2.5"
                                />
                                <button
                                    onClick={handleAdd}
                                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2"
                                >
                                    <Plus size={18} /> Añadir
                                </button>
                            </div>
                        </div>

                        {hours > 0 && (
                            <div className="mt-2 p-3 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700 text-center">
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Estimado</p>
                                <p className="text-lg font-bold text-slate-900 dark:text-white">
                                    {formatCurrency(hours * currentRate)}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-900/10">
                        <h4 className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1">Nota importante</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                            Las tarifas se configuran en el apartado de Ajustes del sistema según el convenio vigente.
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800 relative min-h-[200px]">
                        {loading && (
                            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-10">
                                <Loader2 className="animate-spin text-amber-500" size={32} />
                            </div>
                        )}
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3 text-center">Horas</th>
                                    <th className="px-4 py-3 text-center">Precio/h</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {!loading && entries.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No hay horas extras registradas</td>
                                    </tr>
                                ) : (
                                    entries.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{new Date(entry.date).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">{entry.hours}h</td>
                                            <td className="px-4 py-3 text-center text-slate-500">{formatCurrency(entry.rate)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-600">{formatCurrency(entry.total)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => handleDelete(entry.id)} className="text-slate-300 hover:text-red-500 p-1">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
