import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Play, Square, Coffee, Utensils, MapPin, Loader2, Clock } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { OfflineClockQueue } from '../utils/offlineClockQueue';

export default function TimeTrackerWidget() {
    const [status, setStatus] = useState<'OFF' | 'WORKING' | 'BREAK' | 'LUNCH'>('OFF');
    const [lastEntry, setLastEntry] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [elapsed, setElapsed] = useState('00:00:00');
    const [pendingCount, setPendingCount] = useState(0);
    const isOnline = useNetworkStatus();

    useEffect(() => {
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [lastEntry, status]);

    useEffect(() => {
        setPendingCount(OfflineClockQueue.count());
    }, []);

    useEffect(() => {
        if (isOnline) {
            fetchStatus();
            flushPending();
        } else {
            setLoading(false);
            hydrateOfflineState();
        }
    }, [isOnline]);

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const res = await api.get('/time-entries/status');
            if (res.success) {
                setStatus(res.data.status);
                setLastEntry(res.data.lastEntry);
            }
        } catch (error) {
            console.error('Error fetching time status', error);
        } finally {
            setLoading(false);
        }
    };

    const updateTimer = () => {
        if (status === 'OFF' || !lastEntry) {
            setElapsed('00:00:00');
            return;
        }

        const start = new Date(lastEntry.timestamp).getTime();
        const now = new Date().getTime();
        const diff = Math.max(0, now - start);

        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        setElapsed(
            `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        );
    };

    const getNextStatus = (type: string) => {
        switch (type) {
            case 'IN':
            case 'BREAK_END':
            case 'LUNCH_END':
                return 'WORKING';
            case 'BREAK_START':
                return 'BREAK';
            case 'LUNCH_START':
                return 'LUNCH';
            case 'OUT':
            default:
                return 'OFF';
        }
    };

    const applyLocalClock = (type: string) => {
        setStatus(getNextStatus(type));
        setLastEntry({
            type,
            timestamp: new Date().toISOString(),
            location: 'Registrado sin conexión'
        });
    };

    const hydrateOfflineState = () => {
        const pending = OfflineClockQueue.getAll();
        if (pending.length === 0) return;
        const last = pending[pending.length - 1];
        applyLocalClock(last.type);
        setPendingCount(pending.length);
    };

    const flushPending = async () => {
        if (!navigator.onLine) return;
        const pending = OfflineClockQueue.getAll();
        if (pending.length === 0) return;

        for (const item of pending) {
            try {
                await api.post('/time-entries/clock', item.payload);
                OfflineClockQueue.remove(item.id);
            } catch (error) {
                break;
            }
        }

        const remaining = OfflineClockQueue.count();
        setPendingCount(remaining);
        if (remaining === 0) {
            toast.success('Fichajes pendientes sincronizados');
            fetchStatus();
        }
    };

    const handleClock = async (type: string) => {
        setActionLoading(true);
        let payload: any = null;
        try {
            // STRICT GEOLOCATION ENFORCEMENT
            if (!navigator.geolocation) {
                toast.error('Tu navegador no soporta geolocalización. Es obligatoria para fichar.');
                setActionLoading(false);
                return;
            }

            let locationData = { latitude: null, longitude: null };

            try {
                const pos: any = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        timeout: 10000,
                        enableHighAccuracy: true
                    });
                });
                locationData = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude
                };
            } catch (e: any) {
                console.warn('Geolocation error:', e);
                let msg = 'No se pudo obtener la ubicación.';
                if (e.code === 1) msg = 'Permiso de ubicación denegado. Es obligatorio para fichar.';
                else if (e.code === 2) msg = 'Ubicación no disponible.';
                else if (e.code === 3) msg = 'Tiempo de espera agotado al obtener ubicación.';

                // FALLBACK: Try low accuracy if high accuracy fails
                try {
                    console.log('Retrying with low accuracy...');
                    const pos: any = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            timeout: 10000,
                            enableHighAccuracy: false
                        });
                    });
                    locationData = {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude
                    };
                } catch (fallbackError) {
                    toast.error(msg + ' Es OBLIGATORIO tener ubicación para fichar.');
                    setActionLoading(false);
                    return; // BLOCK ACTION STRICTLY
                }
            }

            payload = {
                type,
                ...locationData,
                device: navigator.userAgent,
                timestamp: new Date().toISOString()
            };

            if (!isOnline) {
                OfflineClockQueue.enqueue({
                    type,
                    payload
                });
                setPendingCount(OfflineClockQueue.count());
                applyLocalClock(type);
                toast.info('Sin conexión: fichaje guardado y se enviará al recuperar Internet.');
                return;
            }

            const res = await api.post('/time-entries/clock', payload);

            if (res.success) {
                toast.success('Fichaje registrado correctamente');
                fetchStatus();
            }
        } catch (error: any) {
            const isNetworkError =
                !navigator.onLine ||
                (typeof error?.message === 'string' &&
                    (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')));

            if (isNetworkError) {
                const fallbackPayload = payload || {
                    type,
                    latitude: null,
                    longitude: null,
                    device: navigator.userAgent,
                    timestamp: new Date().toISOString()
                };
                OfflineClockQueue.enqueue({
                    type,
                    payload: fallbackPayload
                });
                setPendingCount(OfflineClockQueue.count());
                applyLocalClock(type);
                toast.info('Sin conexión: fichaje guardado y se enviará al recuperar Internet.');
            } else {
                toast.error(error.response?.data?.message || 'Error al fichar');
            }
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="animate-pulse h-32 bg-slate-100 rounded-xl"></div>;

    const getStatusColor = () => {
        switch (status) {
            case 'WORKING': return 'text-green-500 bg-green-50 border-green-200';
            case 'BREAK': return 'text-amber-500 bg-amber-50 border-amber-200';
            case 'LUNCH': return 'text-orange-500 bg-orange-50 border-orange-200';
            default: return 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400';
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'WORKING': return 'TRABAJANDO';
            case 'BREAK': return 'EN PAUSA';
            case 'LUNCH': return 'COMIENDO';
            default: return 'FUERA DE TURNO';
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Clock size={20} className="text-blue-500" />
                        Control Horario
                    </h3>
                    <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor()}`}>
                        <div className={`w-2 h-2 rounded-full ${status === 'OFF' ? 'bg-slate-400' : 'bg-current animate-pulse'}`}></div>
                        {getStatusText()}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-mono font-bold text-slate-900 dark:text-white tracking-widest">
                        {elapsed}
                    </div>
                    {lastEntry?.location && (
                        <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 mt-1">
                            <MapPin size={10} />
                            <span className="truncate max-w-[150px]">{lastEntry.location || 'Ubicación registrada'}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {status === 'OFF' ? (
                    <button
                        onClick={() => handleClock('IN')}
                        disabled={actionLoading}
                        className="col-span-4 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/20 active:scale-95 disabled:opacity-50"
                    >
                        {actionLoading ? <Loader2 className="animate-spin" /> : <Play fill="currentColor" />}
                        ENTRAR A TRABAJAR
                    </button>
                ) : (
                    <>
                        <button
                            onClick={() => handleClock('OUT')}
                            disabled={actionLoading}
                            className="col-span-1 md:col-span-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all shadow-lg shadow-rose-500/20 active:scale-95 disabled:opacity-50 text-xs"
                        >
                            {actionLoading ? <Loader2 className="animate-spin" /> : <Square fill="currentColor" size={20} />}
                            SALIR
                        </button>

                        <button
                            onClick={() => handleClock(status === 'BREAK' ? 'BREAK_END' : 'BREAK_START')}
                            disabled={actionLoading || status === 'LUNCH'}
                            className={`col-span-1 md:col-span-1 py-4 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50 text-xs border ${status === 'BREAK'
                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                }`}
                        >
                            <Coffee size={20} />
                            {status === 'BREAK' ? 'VOLVER' : 'PAUSA CAFÉ'}
                        </button>

                        <button
                            onClick={() => handleClock(status === 'LUNCH' ? 'LUNCH_END' : 'LUNCH_START')}
                            disabled={actionLoading || status === 'BREAK'}
                            className={`col-span-2 md:col-span-2 py-4 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50 text-xs border ${status === 'LUNCH'
                                ? 'bg-orange-100 text-orange-700 border-orange-200'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                }`}
                        >
                            <Utensils size={20} />
                            {status === 'LUNCH' ? 'VOLVER DE COMER' : 'PAUSA COMIDA'}
                        </button>
                    </>
                )}
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] font-semibold">
                <div className={`px-2 py-1 rounded-full border ${isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {isOnline ? 'En línea' : 'Sin conexión'}
                </div>
                {pendingCount > 0 && (
                    <div className="px-2 py-1 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
                        {pendingCount} fichaje(s) pendiente(s)
                    </div>
                )}
            </div>

            {/* Geolocation visual feedback */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] text-slate-300 dark:text-slate-700 pointer-events-none">
                <MapPin size={10} />
                GPS requerido
            </div>
        </div>
    );
}
