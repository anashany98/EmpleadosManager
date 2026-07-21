import { useCallback, useEffect, useState } from 'react';
import { api, getErrorMessage } from '../api/client';
import { toast } from 'sonner';
import { Play, Square, Coffee, Utensils, MapPin, Loader2, Clock } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { createClientRequestId, OfflineClockQueue } from '../utils/offlineClockQueue';

type TimeStatus = 'OFF' | 'WORKING' | 'BREAK' | 'LUNCH';
type ClockType = 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END' | 'LUNCH_START' | 'LUNCH_END';

interface LastEntry {
    type: string;
    timestamp: string;
    location?: string | null;
}

interface ClockPayload {
    type: ClockType;
    latitude: number | null;
    longitude: number | null;
    device: string;
    timestamp: string;
    clientRequestId: string;
}

interface TimeStatusResponse {
    success: boolean;
    data: {
        status: TimeStatus;
        lastEntry: LastEntry | null;
    };
}

interface ClockMutationResponse {
    success: boolean;
    data: {
        entry: LastEntry;
        deduplicated: boolean;
        dedupedBy: 'clientRequestId' | 'timestamp' | null;
    };
}

interface ApiErrorLike extends Error {
    response?: {
        data?: {
            message?: string;
        };
    };
}

function getCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
}

function getNextStatus(type: ClockType): TimeStatus {
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
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return getErrorMessage(error, 'Error al fichar');
}

function isNetworkError(error: unknown): boolean {
    if (!navigator.onLine) {
        return true;
    }

    if (!(error instanceof Error)) {
        return false;
    }

    return error.message.includes('Failed to fetch') || error.message.includes('NetworkError');
}

export default function TimeTrackerWidget() {
    const [status, setStatus] = useState<TimeStatus>('OFF');
    const [lastEntry, setLastEntry] = useState<LastEntry | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [elapsed, setElapsed] = useState('00:00:00');
    const [pendingCount, setPendingCount] = useState(0);
    const isOnline = useNetworkStatus();

    const applyLocalClock = useCallback((type: ClockType, timestamp?: string) => {
        setStatus(getNextStatus(type));
        setLastEntry({
            type,
            timestamp: timestamp || new Date().toISOString(),
            location: 'Registrado sin conexion'
        });
    }, []);

    const fetchStatus = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<TimeStatusResponse>('/time-entries/status');
            if (res.success) {
                setStatus(res.data.status);
                setLastEntry(res.data.lastEntry);
            }
        } catch (error) {
            console.error('Error fetching time status', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const hydrateOfflineState = useCallback(() => {
        const pending = OfflineClockQueue.getAll();
        setPendingCount(pending.length);

        if (pending.length === 0) {
            return;
        }

        const lastPending = pending[pending.length - 1];
        applyLocalClock(lastPending.type as ClockType, lastPending.payload.timestamp);
    }, [applyLocalClock]);

    const flushPending = useCallback(async () => {
        if (!isOnline) {
            return;
        }

        const pending = OfflineClockQueue.getAll();
        if (pending.length === 0) {
            setPendingCount(0);
            return;
        }

        for (const item of pending) {
            try {
                await api.post<ClockMutationResponse>('/time-entries/clock', item.payload);
                OfflineClockQueue.remove(item.id);
            } catch (error) {
                console.warn('Pending clock sync failed', error);
                break;
            }
        }

        const remaining = OfflineClockQueue.count();
        setPendingCount(remaining);

        if (remaining === 0) {
            toast.success('Fichajes pendientes sincronizados');
            await fetchStatus();
            return;
        }

        hydrateOfflineState();
    }, [fetchStatus, hydrateOfflineState, isOnline]);

    const updateTimer = useCallback(() => {
        if (status === 'OFF' || !lastEntry) {
            setElapsed('00:00:00');
            return;
        }

        const start = new Date(lastEntry.timestamp).getTime();
        const now = Date.now();
        const diff = Math.max(0, now - start);

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setElapsed(
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
    }, [lastEntry, status]);

    useEffect(() => {
        setPendingCount(OfflineClockQueue.count());
    }, []);

    useEffect(() => {
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [updateTimer]);

    useEffect(() => {
        if (isOnline) {
            void fetchStatus();
            void flushPending();
            return;
        }

        setLoading(false);
        hydrateOfflineState();
    }, [fetchStatus, flushPending, hydrateOfflineState, isOnline]);

    const handleClock = useCallback(async (type: ClockType) => {
        setActionLoading(true);

        const clientRequestId = createClientRequestId();
        let payload: ClockPayload | null = null;

        try {
            if (!navigator.geolocation) {
                toast.error('Tu navegador no soporta geolocalizacion. Es obligatoria para fichar.');
                return;
            }

            let latitude: number | null = null;
            let longitude: number | null = null;

            try {
                const highAccuracyPosition = await getCurrentPosition({
                    timeout: 10000,
                    enableHighAccuracy: true
                });

                latitude = highAccuracyPosition.coords.latitude;
                longitude = highAccuracyPosition.coords.longitude;
            } catch (geoError) {
                let message = 'No se pudo obtener la ubicacion.';

                if (geoError instanceof GeolocationPositionError) {
                    if (geoError.code === 1) {
                        message = 'Permiso de ubicacion denegado. Es obligatorio para fichar.';
                    } else if (geoError.code === 2) {
                        message = 'Ubicacion no disponible.';
                    } else if (geoError.code === 3) {
                        message = 'Tiempo de espera agotado al obtener ubicacion.';
                    }
                }

                try {
                    const fallbackPosition = await getCurrentPosition({
                        timeout: 10000,
                        enableHighAccuracy: false
                    });

                    latitude = fallbackPosition.coords.latitude;
                    longitude = fallbackPosition.coords.longitude;
                } catch {
                    toast.error(`${message} Es obligatorio tener ubicacion para fichar.`);
                    return;
                }
            }

            payload = {
                type,
                latitude,
                longitude,
                device: navigator.userAgent,
                timestamp: new Date().toISOString(),
                clientRequestId
            };

            if (!isOnline) {
                OfflineClockQueue.enqueue({ type, payload });
                setPendingCount(OfflineClockQueue.count());
                applyLocalClock(type, payload.timestamp);
                toast.info('Sin conexion: fichaje guardado y pendiente de sincronizar.');
                return;
            }

            const response = await api.post<ClockMutationResponse>('/time-entries/clock', payload);
            if (response.success) {
                toast.success(response.data.deduplicated ? 'Fichaje ya registrado' : 'Fichaje registrado correctamente');
                await fetchStatus();
            }
        } catch (error) {
            if (isNetworkError(error)) {
                const fallbackPayload: ClockPayload = payload || {
                    type,
                    latitude: null,
                    longitude: null,
                    device: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                    clientRequestId
                };

                OfflineClockQueue.enqueue({
                    type,
                    payload: fallbackPayload
                });
                setPendingCount(OfflineClockQueue.count());
                applyLocalClock(type, fallbackPayload.timestamp);
                toast.info('Sin conexion: fichaje guardado y pendiente de sincronizar.');
                return;
            }

            toast.error(getErrorMessage(error));
        } finally {
            setActionLoading(false);
        }
    }, [applyLocalClock, fetchStatus, isOnline]);

    if (loading) {
        return <div className="animate-pulse h-32 bg-slate-100 rounded-xl"></div>;
    }

    const getStatusColor = () => {
        switch (status) {
            case 'WORKING':
                return 'text-green-500 bg-green-50 border-green-200';
            case 'BREAK':
                return 'text-amber-500 bg-amber-50 border-amber-200';
            case 'LUNCH':
                return 'text-orange-500 bg-orange-50 border-orange-200';
            default:
                return 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400';
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'WORKING':
                return 'TRABAJANDO';
            case 'BREAK':
                return 'EN PAUSA';
            case 'LUNCH':
                return 'COMIENDO';
            default:
                return 'FUERA DE TURNO';
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
                            <span className="truncate max-w-[150px]">{lastEntry.location || 'Ubicacion registrada'}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {status === 'OFF' ? (
                    <button
                        onClick={() => void handleClock('IN')}
                        disabled={actionLoading}
                        className="col-span-4 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/20 active:scale-95 disabled:opacity-50"
                    >
                        {actionLoading ? <Loader2 className="animate-spin" /> : <Play fill="currentColor" />}
                        ENTRAR A TRABAJAR
                    </button>
                ) : (
                    <>
                        <button
                            onClick={() => void handleClock('OUT')}
                            disabled={actionLoading}
                            className="col-span-1 md:col-span-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all shadow-lg shadow-rose-500/20 active:scale-95 disabled:opacity-50 text-xs"
                        >
                            {actionLoading ? <Loader2 className="animate-spin" /> : <Square fill="currentColor" size={20} />}
                            SALIR
                        </button>

                        <button
                            onClick={() => void handleClock(status === 'BREAK' ? 'BREAK_END' : 'BREAK_START')}
                            disabled={actionLoading || status === 'LUNCH'}
                            className={`col-span-1 md:col-span-1 py-4 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50 text-xs border ${status === 'BREAK'
                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                            }`}
                        >
                            <Coffee size={20} />
                            {status === 'BREAK' ? 'VOLVER' : 'PAUSA CAFE'}
                        </button>

                        <button
                            onClick={() => void handleClock(status === 'LUNCH' ? 'LUNCH_END' : 'LUNCH_START')}
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
                    {isOnline ? 'En linea' : 'Sin conexion'}
                </div>
                {pendingCount > 0 && (
                    <div className="px-2 py-1 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
                        {pendingCount} fichaje(s) pendiente(s)
                    </div>
                )}
            </div>

            <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] text-slate-300 dark:text-slate-700 pointer-events-none">
                <MapPin size={10} />
                GPS requerido
            </div>
        </div>
    );
}
