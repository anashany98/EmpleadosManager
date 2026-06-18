import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Settings, Wifi, WifiOff, Delete } from 'lucide-react';
import { API_URL } from '../../api/client';
import { KioskAdminPanel } from '../../components/KioskAdminPanel';

const KIOSK_SECRET = import.meta.env.VITE_KIOSK_DEVICE_SECRET || '';

const createClientRequestId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getKioskHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (KIOSK_SECRET) {
        headers['x-kiosk-secret'] = KIOSK_SECRET;
    }
    return headers;
};

const postKiosk = async (path: string, body: unknown) => {
    const response = await fetch(`${API_URL}/kiosk${path}`, {
        method: 'POST',
        headers: getKioskHeaders(),
        body: JSON.stringify(body)
    });

    return response.json();
};

const logoutSession = async () => {
    await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
    }).catch(() => undefined);
};

type OfflineQueueItem = {
    payload: {
        employeeId: string;
        pin: string;
        timestamp: string;
        clientRequestId: string;
    };
    attempts: number;
    nextAttemptAt: number;
};

const useTextToSpeech = () => {
    const speak = (text: string) => {
        if (!window.speechSynthesis) {
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';

        const voices = window.speechSynthesis.getVoices();
        const spanishVoice = voices.find((voice) => voice.lang.startsWith('es'));
        if (spanishVoice) {
            utterance.voice = spanishVoice;
        }

        window.speechSynthesis.speak(utterance);
    };

    return { speak };
};

const useOfflineQueue = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (!isOnline) {
            return;
        }

        const interval = setInterval(async () => {
            const queue = JSON.parse(localStorage.getItem('kiosk_queue') || '[]') as OfflineQueueItem[];
            if (queue.length === 0) {
                return;
            }

            const remaining: OfflineQueueItem[] = [];
            const now = Date.now();

            for (const entry of queue) {
                try {
                    if (entry.nextAttemptAt && now < entry.nextAttemptAt) {
                        remaining.push(entry);
                        continue;
                    }

                    const response = await postKiosk('/clock', entry.payload);
                    if (!response.success) {
                        throw new Error(response.message || 'Sync failed');
                    }
                } catch {
                    const attempts = entry.attempts + 1;
                    if (attempts < 5) {
                        remaining.push({
                            ...entry,
                            attempts,
                            nextAttemptAt: now + Math.min(60000, 2000 * 2 ** attempts)
                        });
                    }
                }
            }

            localStorage.setItem('kiosk_queue', JSON.stringify(remaining));
        }, 10000);

        return () => clearInterval(interval);
    }, [isOnline]);

    const addToQueue = (payload: OfflineQueueItem['payload']) => {
        const queue = JSON.parse(localStorage.getItem('kiosk_queue') || '[]') as OfflineQueueItem[];
        queue.push({
            payload,
            attempts: 0,
            nextAttemptAt: Date.now()
        });
        localStorage.setItem('kiosk_queue', JSON.stringify(queue));
    };

    return { isOnline, addToQueue };
};

interface Employee {
    id: string;
    name: string;
    firstName?: string | null;
    lastName?: string | null;
    department?: string | null;
}

const KioskPage: React.FC = () => {
    const navigate = useNavigate();
    const { speak } = useTextToSpeech();
    const { isOnline, addToQueue } = useOfflineQueue();

    const [status, setStatus] = useState('Listo');
    const [subStatus, setSubStatus] = useState('Selecciona tu nombre');
    const [isIdle, setIsIdle] = useState(false);
    const [showAdmin, setShowAdmin] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [lastActivity, setLastActivity] = useState(Date.now());

    useEffect(() => {
        fetchEmployees();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            if (!showAdmin && Date.now() - lastActivity > 30000 && !isIdle) {
                setIsIdle(true);
                setSelectedEmployee(null);
                setPin('');
            }
        }, 5000);

        return () => clearInterval(timer);
    }, [isIdle, showAdmin, lastActivity]);

    const fetchEmployees = async () => {
        try {
            const headers = getKioskHeaders();
            const response = await fetch(`${API_URL}/employees?status=active&limit=200`, {
                headers: { ...headers, 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const data = await response.json();
            const list = Array.isArray(data.data) ? data.data : data.data?.data || [];
            setEmployees(list);
        } catch {
            setEmployees([]);
        }
    };

    const wakeUp = () => {
        if (isIdle) {
            setIsIdle(false);
        }
        setLastActivity(Date.now());
    };

    const closeAdminPanel = useCallback(async () => {
        await logoutSession();
        setShowAdmin(false);
        fetchEmployees();
    }, []);

    const handleClockIn = useCallback(async () => {
        if (!selectedEmployee || pin.length < 4) return;

        setLoading(true);
        setLastActivity(Date.now());

        try {
            const payload = {
                employeeId: selectedEmployee.id,
                pin,
                timestamp: new Date().toISOString(),
                clientRequestId: createClientRequestId()
            };

            let entryType = 'REGISTRADO';

            if (isOnline) {
                const clockData = await postKiosk('/clock', payload);
                if (clockData.success) {
                    entryType = clockData.data.entry.type === 'IN' ? 'ENTRADA' : 'SALIDA';
                    setStatus(`${entryType} CORRECTA`);
                    speak(`${entryType} confirmada para ${selectedEmployee.name.split(' ')[0]}`);
                } else {
                    setStatus(clockData.message || 'Error al fichar');
                    speak('Hubo un error al fichar');
                }
            } else {
                addToQueue(payload);
                setStatus('Fichaje guardado offline');
                speak('Fichaje guardado en modo sin conexion');
            }

            setSubStatus(selectedEmployee.name);
            setPin('');

            setTimeout(() => {
                setStatus('Listo');
                setSubStatus('Selecciona tu nombre');
                setSelectedEmployee(null);
            }, 4000);
        } catch {
            setStatus('Error de conexion');
        } finally {
            setLoading(false);
        }
    }, [addToQueue, isOnline, pin, selectedEmployee, speak]);

    const handlePinDigit = (digit: string) => {
        setLastActivity(Date.now());
        if (pin.length < 12) {
            setPin(prev => prev + digit);
        }
    };

    const handlePinDelete = () => {
        setLastActivity(Date.now());
        setPin(prev => prev.slice(0, -1));
    };

    const handlePinClear = () => {
        setLastActivity(Date.now());
        setPin('');
    };

    const handleSelectEmployee = (emp: Employee) => {
        setSelectedEmployee(emp);
        setPin('');
        setLastActivity(Date.now());
    };

    const handleBack = () => {
        setSelectedEmployee(null);
        setPin('');
        setLastActivity(Date.now());
    };

    const filteredEmployees = employees.filter(emp => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (emp.name || '').toLowerCase().includes(q)
            || (emp.firstName || '').toLowerCase().includes(q)
            || (emp.lastName || '').toLowerCase().includes(q);
    });

    if (showAdmin) {
        return <div className="min-h-screen bg-slate-900"><KioskAdminPanel onClose={() => void closeAdminPanel()} /></div>;
    }

    if (isIdle) {
        return (
            <div
                className="min-h-screen bg-black flex flex-col items-center justify-center text-white cursor-pointer transition-opacity duration-1000"
                onClick={wakeUp}
            >
                <div className="animate-pulse flex flex-col items-center gap-4 opacity-50">
                    <Moon size={64} className="text-blue-500" />
                    <h1 className="text-4xl font-thin tracking-widest">KIOSCO EN REPOSO</h1>
                    <p className="text-xl text-slate-500">Toca para activar</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center text-white p-4 relative" onClick={wakeUp}>
            <div className="absolute top-4 left-4 flex gap-4 text-slate-500">
                {isOnline ? <Wifi size={20} className="text-green-500" /> : <WifiOff size={20} className="text-red-500" />}
            </div>

            <button
                onClick={() => setShowAdmin(true)}
                className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors"
                title="Admin Mode"
            >
                <Settings size={24} />
            </button>

            <h1 className="text-3xl font-bold mb-2 text-center mt-16">Punto de Fichaje</h1>
            <p className="text-slate-400 mb-6 text-center h-6">{subStatus}</p>

            {/* Status feedback */}
            <div className={`text-xl font-medium mb-4 transition-colors duration-300 ${
                status.includes('CORRECTA') ? 'text-green-400' :
                status.includes('Error') ? 'text-red-400' :
                status.includes('guardado') ? 'text-yellow-400' :
                'text-white'
            }`}>
                {status}
            </div>

            {!selectedEmployee ? (
                /* Employee Selection */
                <div className="w-full max-w-md">
                    <div className="relative mb-4">
                        <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setLastActivity(Date.now()); }}
                            className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-96 overflow-y-auto space-y-2 rounded-xl">
                        {filteredEmployees.length === 0 && (
                            <p className="text-center text-slate-500 py-8">No hay empleados</p>
                        )}
                        {filteredEmployees.map(emp => (
                            <button
                                key={emp.id}
                                onClick={() => handleSelectEmployee(emp)}
                                className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-left transition-colors border border-slate-700 hover:border-blue-500"
                            >
                                <span className="font-medium text-lg">{emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()}</span>
                                {emp.department && <span className="text-slate-400 text-sm ml-2">({emp.department})</span>}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                /* PIN Entry */
                <div className="w-full max-w-sm">
                    <button
                        onClick={handleBack}
                        className="text-slate-400 hover:text-white mb-4 text-sm"
                    >
                        &larr; Cambiar empleado
                    </button>

                    <div className="text-center mb-6">
                        <p className="text-xl font-bold">{selectedEmployee.name}</p>
                        <p className="text-slate-400 text-sm">{selectedEmployee.department}</p>
                    </div>

                    {/* PIN Display */}
                    <div className="flex justify-center gap-3 mb-6">
                        {Array.from({ length: Math.max(4, pin.length + 1) }).map((_, i) => (
                            <div
                                key={i}
                                className={`w-4 h-4 rounded-full transition-colors ${
                                    i < pin.length ? 'bg-blue-500' : 'bg-slate-700'
                                }`}
                            />
                        ))}
                    </div>

                    {/* PIN Pad */}
                    <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((key, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    if (key === 'del') handlePinDelete();
                                    else if (key !== null) handlePinDigit(String(key));
                                }}
                                disabled={key === null || loading}
                                className={`h-16 rounded-xl text-2xl font-bold transition-all ${
                                    key === null
                                        ? 'invisible'
                                        : key === 'del'
                                            ? 'bg-slate-700 hover:bg-slate-600 flex items-center justify-center'
                                            : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700'
                                }`}
                            >
                                {key === 'del' ? <Delete size={24} /> : key}
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 mt-4 max-w-xs mx-auto">
                        <button
                            onClick={handlePinClear}
                            disabled={pin.length === 0 || loading}
                            className="flex-1 h-12 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-30 transition text-sm"
                        >
                            Borrar
                        </button>
                        <button
                            onClick={() => void handleClockIn()}
                            disabled={pin.length < 4 || loading}
                            className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 transition font-bold"
                        >
                            {loading ? 'Fichando...' : 'Fichar'}
                        </button>
                    </div>
                </div>
            )}

            <button
                className="mt-8 px-6 py-3 bg-slate-800 rounded-full hover:bg-slate-700 transition text-sm text-slate-400 border border-slate-700"
                onClick={() => navigate('/login')}
            >
                Entrar al sistema
            </button>
        </div>
    );
};

export default KioskPage;
