import React, { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';
import { Moon, Settings, Wifi, WifiOff } from 'lucide-react';
import { API_URL } from '../../api/client';
import { KioskAdminPanel } from '../../components/KioskAdminPanel';
import { FaceRecognitionService } from '../../services/faceRecognition';

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

type OfflineQueueItem = {
    payload: {
        employeeId: string;
        method: string;
        descriptor?: number[];
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

interface IdentifiedEmployee {
    id: string;
    name: string;
    jobTitle?: string;
}

const KioskPage: React.FC = () => {
    const webcamRef = useRef<Webcam>(null);
    const lastActivity = useRef<number>(0);
    const navigate = useNavigate();
    const { speak } = useTextToSpeech();
    const { isOnline, addToQueue } = useOfflineQueue();

    const [status, setStatus] = useState('Cargando Cerebro IA...');
    const [subStatus, setSubStatus] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [lastDetection, setLastDetection] = useState(0);
    const [requireSmile, setRequireSmile] = useState(false);
    const [detectedEmployee, setDetectedEmployee] = useState<IdentifiedEmployee | null>(null);
    const [isIdle, setIsIdle] = useState(false);
    const [showAdmin, setShowAdmin] = useState(false);

    useEffect(() => {
        lastActivity.current = Date.now();
        FaceRecognitionService.loadModels()
            .then(() => {
                setStatus('Listo');
                setSubStatus('Mira a la camara');
                setIsScanning(true);
            })
            .catch((error) => setStatus(`Error IA: ${error.message}`));
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            if (!showAdmin && Date.now() - lastActivity.current > 30000 && !isIdle) {
                setIsIdle(true);
            }
        }, 5000);

        return () => clearInterval(timer);
    }, [isIdle, showAdmin]);

    const wakeUp = () => {
        if (isIdle) {
            setIsIdle(false);
        }
        lastActivity.current = Date.now();
    };

    const handleClockIn = useCallback(async (employee: IdentifiedEmployee, descriptor?: number[]) => {
        setIsScanning(false);
        setSubStatus('Fichando...');

        try {
            const payload = {
                employeeId: employee.id,
                method: 'face',
                descriptor,
                timestamp: new Date().toISOString(),
                clientRequestId: createClientRequestId()
            };

            let entryType = 'REGISTRADO';

            if (isOnline) {
                const clockData = await postKiosk('/clock', payload);
                if (clockData.success) {
                    entryType = clockData.data.entry.type === 'IN' ? 'ENTRADA' : 'SALIDA';
                    setStatus(`${entryType} CORRECTA`);
                    speak(`${entryType} confirmada para ${employee.name.split(' ')[0]}`);
                } else {
                    setStatus('Error al fichar');
                    speak('Hubo un error al fichar');
                }
            } else {
                addToQueue(payload);
                setStatus('Fichaje guardado offline');
                speak('Fichaje guardado en modo sin conexion');
            }

            setSubStatus(employee.name);

            setTimeout(() => {
                setStatus('Listo');
                setSubStatus('Mira a la camara');
                setIsScanning(true);
                setRequireSmile(false);
                setDetectedEmployee(null);
            }, 4000);
        } catch {
            setStatus('Error de conexion');
            setIsScanning(true);
        }
    }, [addToQueue, isOnline, speak]);

    const captureAndCheck = useCallback(async () => {
        if (!webcamRef.current || !isScanning || isIdle) {
            return;
        }

        if (Date.now() - lastDetection < 500) {
            return;
        }

        const video = webcamRef.current.video;
        if (!video || video.readyState !== 4) {
            return;
        }

        try {
            lastActivity.current = Date.now();

            if (requireSmile && detectedEmployee) {
                setStatus(`Hola ${detectedEmployee.name}`);
                setSubStatus('Sonrie para confirmar');

                const expressions = await FaceRecognitionService.detectExpressions(video);
                if (expressions && (expressions.happy > 0.7 || expressions.surprised > 0.6)) {
                    const freshDescriptor = await FaceRecognitionService.getFaceDescriptor(video);
                    await handleClockIn(detectedEmployee, Array.from(freshDescriptor || []));
                    setRequireSmile(false);
                    setDetectedEmployee(null);
                }
                return;
            }

            const descriptor = await FaceRecognitionService.getFaceDescriptor(video);
            if (!descriptor) {
                setStatus('Buscando cara...');
                setSubStatus('');
                return;
            }

            setLastDetection(Date.now());
            const data = await postKiosk('/identify', { descriptor: Array.from(descriptor) });

            if (data.success && data.data.identified) {
                const employee = data.data.employee as IdentifiedEmployee;
                setDetectedEmployee(employee);
                setRequireSmile(true);
                speak(`Hola ${employee.name}, sonrie por favor`);
                return;
            }

            setStatus('No reconocido');
            setSubStatus('');
        } catch (error) {
            console.error(error);
            setStatus('Error tecnico');
        }
    }, [detectedEmployee, handleClockIn, isIdle, isScanning, lastDetection, requireSmile, speak]);

    useEffect(() => {
        if (showAdmin) {
            return;
        }

        const interval = setInterval(() => {
            void captureAndCheck();
        }, 500);

        return () => clearInterval(interval);
    }, [captureAndCheck, showAdmin]);

    if (showAdmin) {
        return <div className="min-h-screen bg-slate-900"><KioskAdminPanel onClose={() => setShowAdmin(false)} /></div>;
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
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4 relative" onClick={wakeUp}>
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

            <h1 className="text-3xl font-bold mb-2 text-center">Punto de Fichaje Inteligente</h1>
            <p className="text-slate-400 mb-6 text-center h-6">{subStatus}</p>

            <div className={`relative rounded-2xl overflow-hidden shadow-2xl border-4 transition-colors duration-300 w-full max-w-md aspect-[3/4] ${requireSmile ? 'border-yellow-400' : 'border-blue-500'}`}>
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: 'user' }}
                    mirrored={true}
                    className="w-full h-full object-cover scale-x-[-1]"
                />

                <div className="absolute bottom-0 inset-x-0 bg-black/60 p-4 text-center backdrop-blur-sm transition-all duration-300">
                    <p className={`text-xl font-medium ${requireSmile ? 'text-yellow-300 animate-bounce' : 'text-white'}`}>
                        {status}
                    </p>
                </div>
            </div>

            <button
                className="mt-8 px-6 py-3 bg-slate-800 rounded-full hover:bg-slate-700 transition text-sm text-slate-400 border border-slate-700"
                onClick={() => navigate('/login')}
            >
                Entrar con PIN / Contrasena
            </button>
        </div>
    );
};

export default KioskPage;
