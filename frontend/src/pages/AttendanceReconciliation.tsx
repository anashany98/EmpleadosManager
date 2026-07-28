import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, ArrowLeft, Plus, Check, Search } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { buildLocalDayRange, buildLocalTimestamp } from './attendanceDateUtils';

interface AttendanceSegment {
    type: string;
    start: string;
    end?: string | null;
}

interface AttendanceSummary {
    employeeName: string;
    date: string;
    status: string;
    totalHours: number;
    segments: AttendanceSegment[];
}

export default function AttendanceReconciliation() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const employeeId = searchParams.get('employeeId');
    const date = searchParams.get('date');

    const [summary, setSummary] = useState<AttendanceSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showFixModal, setShowFixModal] = useState(false);
    const [fixType, setFixType] = useState('OUT');
    const [fixTime, setFixTime] = useState('18:00');

    const loadData = useCallback(async () => {
        if (!employeeId || !date) {
            setSummary(null);
            setLoadError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setLoadError(null);
        try {
            const { start, end } = buildLocalDayRange(date);
            const query = new URLSearchParams({ employeeId, start, end });
            const res = await api.get(`/reports/attendance-summary?${query.toString()}`);
            if (res.data && res.data.length > 0) {
                setSummary(res.data[0]);
            } else {
                setSummary(null);
            }
        } catch (_error) {
            setSummary(null);
            setLoadError('No se pudieron cargar los datos de asistencia.');
            toast.error('Error al cargar datos de asistencia');
        } finally {
            setLoading(false);
        }
    }, [date, employeeId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleApplyFix = async () => {
        try {
            if (!employeeId || !date) return;
            const timestamp = buildLocalTimestamp(date, fixTime);
            await api.post('/time-entries/manual', {
                employeeId,
                type: fixType,
                timestamp,
                location: 'Corrección Manual (Admin)',
                comment: 'Reparación de fichaje incompleto'
            });
            toast.success('Fichaje corregido correctamente');
            setShowFixModal(false);
            loadData();
        } catch (_error) {
            toast.error('Error al aplicar la corrección');
        }
    };

    if (loading) return <div className="p-10 text-slate-500 italic">Cargando detalles de asistencia...</div>;
    if (!employeeId || !date) {
        return (
            <div className="p-8 max-w-3xl mx-auto">
                <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                        <Search size={24} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">Selecciona un fichaje para conciliar</h1>
                    <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                        Esta pantalla necesita un empleado y un día concretos. Abre el control de fichajes o una anomalía y elige la acción de revisión.
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/timesheet')}
                            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
                        >
                            Ir a Control de fichajes
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/anomalies')}
                            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            Ver anomalías
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    if (loadError) {
        return (
            <div className="p-8 max-w-3xl mx-auto">
                <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/60 dark:bg-red-950/20">
                    <AlertTriangle className="mx-auto text-red-600" size={28} />
                    <h1 className="mt-3 text-xl font-black text-red-900 dark:text-red-200">No se pudo abrir la conciliación</h1>
                    <p className="mt-2 text-sm text-red-700 dark:text-red-300">{loadError}</p>
                    <button type="button" onClick={loadData} className="mt-5 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700">
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }
    if (!summary) return <div className="p-10 text-slate-500">No se encontraron fichajes para este empleado y día.</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-bold uppercase tracking-wider">
                <ArrowLeft size={16} /> Volver
            </button>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">Reconciliación de Asistencia</h1>
                        <p className="text-slate-500 mt-1">{summary.employeeName} • {new Date(summary.date).toLocaleDateString()}</p>
                    </div>
                    <div className={`px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-widest border ${summary.status === 'INCOMPLETE' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                        {summary.status === 'INCOMPLETE' ? 'Fichaje Incompleto' : 'Fichaje Completo'}
                    </div>
                </div>

                <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Horas Calculadas</p>
                        <p className="text-4xl font-black text-slate-900 dark:text-white">{summary.totalHours}h</p>
                    </div>
                    <div className="col-span-2 space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Timeline del Día</p>
                        {summary.segments.map((s, idx) => (
                            <div key={idx} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                <div className={`p-2 rounded-xl ${s.type === 'WORK' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                    <Clock size={16} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                                        {s.type === 'WORK' ? 'Jornada' : s.type}
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                        {new Date(s.start).toLocaleTimeString()} - {s.end ? new Date(s.end).toLocaleTimeString() : <span className="text-red-500 font-bold underline">Falta Salida</span>}
                                    </p>
                                </div>
                                {!s.end && (
                                    <button
                                        onClick={() => { setFixType('OUT'); setShowFixModal(true); }}
                                        className="px-3 py-1.5 bg-red-500 text-white text-[10px] font-black rounded-lg hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                                    >
                                        REPARAR
                                    </button>
                                )}
                            </div>
                        ))}
                        {summary.status === 'INCOMPLETE' && summary.segments.every((s) => s.end) && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
                                <AlertTriangle className="text-red-500" size={20} />
                                <p className="text-xs text-red-700 font-medium">Hay una inconsistencia en los fichajes. Faltan registros para cerrar el día adecuadamente.</p>
                                <button
                                    onClick={() => { setFixType('IN'); setShowFixModal(true); }}
                                    className="ml-auto px-4 py-2 bg-red-600 text-white text-[10px] font-black rounded-xl"
                                >
                                    AÑADIR MANUALMENTE
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-500/5 rounded-full blur-3xl -ml-24 -mb-24 pointer-events-none"></div>
            </div>

            {showFixModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 w-full max-w-md border border-slate-100 dark:border-slate-800 shadow-2xl space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                                <Plus size={24} />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 dark:text-white">Corregir Fichaje</h1>
                                <p className="text-xs text-slate-500">Inserta el fichaje manual para completar el día</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Acción</label>
                                <select
                                    value={fixType}
                                    onChange={e => setFixType(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-red-500/20"
                                >
                                    <option value="IN">ENTRADA (IN)</option>
                                    <option value="OUT">SALIDA (OUT)</option>
                                    <option value="BREAK_START">INICIO PAUSA</option>
                                    <option value="BREAK_END">FIN PAUSA</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Hora</label>
                                <input
                                    type="time"
                                    value={fixTime}
                                    onChange={e => setFixTime(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-red-500/20"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button
                                onClick={() => setShowFixModal(false)}
                                className="flex-1 px-6 py-4 bg-slate-100 text-slate-500 text-xs font-black rounded-2xl hover:bg-slate-200 transition-colors uppercase tracking-widest"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleApplyFix}
                                className="flex-1 px-6 py-4 bg-red-500 text-white text-xs font-black rounded-2xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30 uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                <Check size={16} /> Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
