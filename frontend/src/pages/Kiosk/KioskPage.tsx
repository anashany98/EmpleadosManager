import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { FaceRecognitionService } from '../../services/faceRecognition';
import { useNavigate } from 'react-router-dom';
import { Settings, Wifi, WifiOff, Moon } from 'lucide-react';
import { KioskAdminPanel } from '../../components/KioskAdminPanel';

// --- Text-to-Speech Hook ---
const useTextToSpeech = () => {
    const speak = (text: string) => {
        if (!window.speechSynthesis) return;
        // Cancel previous
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';

        // Try to find a good Spanish voice
        const voices = window.speechSynthesis.getVoices();
        const spanishVoice = voices.find(v => v.lang.startsWith('es'));
        if (spanishVoice) utterance.voice = spanishVoice;

        window.speechSynthesis.speak(utterance);
    };
    return { speak };
};

// --- Offline Queue Hook ---
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

    // Sync loop
    useEffect(() => {
        if (!isOnline) return;
        const interval = setInterval(async () => {
            const queue = JSON.parse(localStorage.getItem('kiosk_queue') || '[]');
            if (queue.length === 0) return;

            console.log(`Syncing ${queue.length} offline entries...`);
            const remaining = [];

            for (const entry of queue) {
                try {
                    await fetch('/api/kiosk/clock', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(entry)
                    });
                } catch (e) {
                    remaining.push(entry); // Keep if failed
                }
            }

            localStorage.setItem('kiosk_queue', JSON.stringify(remaining));
        }, 10000); // Check every 10s

        return () => clearInterval(interval);
    }, [isOnline]);

    const addToQueue = (data: { employeeId: string; method: string }) => {
        const queue = JSON.parse(localStorage.getItem('kiosk_queue') || '[]');
        queue.push({ ...data, offlineTimestamp: new Date().toISOString() });
        localStorage.setItem('kiosk_queue', JSON.stringify(queue));
    };

    return { isOnline, addToQueue };
};

const KioskPage: React.FC = () => {
    const webcamRef = useRef<Webcam>(null);
    const [status, setStatus] = useState<string>('Inicializando...');
    const [subStatus, setSubStatus] = useState<string>('');
    const [isScanning, setIsScanning] = useState(false);
    const [lastDetection, setLastDetection] = useState<number>(0);
    const [requireSmile, setRequireSmile] = useState(false); // Anti-spoofing stage

    interface IdentifiedEmployee {
        id: string;
        name: string;
        jobTitle?: string;
    }
    const [detectedEmployee, setDetectedEmployee] = useState<IdentifiedEmployee | null>(null); // Temp storage for spoof check

    // Screensaver
    const [isIdle, setIsIdle] = useState(false);
    const lastActivity = useRef(Date.now());

    const navigate = useNavigate();
    const { speak } = useTextToSpeech();
    const { isOnline, addToQueue } = useOfflineQueue();
    const [showAdmin, setShowAdmin] = useState(false);

    // Initial Load
    useEffect(() => {
        setStatus('Cargando Cerebro IA...');
        FaceRecognitionService.loadModels()
            .then(() => {
                setStatus('Listo');
                setIsScanning(true);
                lastActivity.current = Date.now();
            })
            .catch(err => setStatus('Error IA: ' + err.message));
    }, []);

    // Idle Timer
    useEffect(() => {
        const timer = setInterval(() => {
            if (!showAdmin && Date.now() - lastActivity.current > 30000) { // 30s idle
                if (!isIdle) setIsIdle(true);
            }
        }, 5000);
        return () => clearInterval(timer);
    }, [isIdle, showAdmin]);

    const wakeUp = () => {
        if (isIdle) setIsIdle(false);
        lastActivity.current = Date.now();
    };

    // --- Main Loop ---
    const captureAndCheck = useCallback(async () => {
        if (!webcamRef.current || !isScanning || isIdle) return;

        // Throttling
        if (Date.now() - lastDetection < 500) return;

        const video = webcamRef.current.video;
        if (!video || video.readyState !== 4) return;

        try {
            // Wake up on simple movement or stay awake if scanning
            lastActivity.current = Date.now();

            if (requireSmile && detectedEmployee) {
                // STAGE 2: Liveness Check (Smile)
                setStatus(`¡Hola ${detectedEmployee.name}!`);
                setSubStatus('👋 Sonríe para confirmar');

                const expressions = await FaceRecognitionService.detectExpressions(video);
                if (expressions && (expressions.happy > 0.7 || expressions.surprised > 0.6)) {
                    // Get current descriptor for clock-in (fresher)
                    const freshDescriptor = await FaceRecognitionService.getFaceDescriptor(video);
                    await handleClockIn(detectedEmployee, Array.from(freshDescriptor || []));
                    setRequireSmile(false);
                    setDetectedEmployee(null);
                }
                return;
            }

            // STAGE 1: Identity Check
            const descriptor = await FaceRecognitionService.getFaceDescriptor(video);

            if (descriptor) {
                setLastDetection(Date.now());

                // Convert Float32Array
                const descriptorArray = Array.from(descriptor);

                // Identify
                const response = await fetch('/api/kiosk/identify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ descriptor: descriptorArray })
                });

                const data = await response.json();

                if (data.success && data.data.identified) {
                    const emp = data.data.employee;

                    // Trigger Anti-Spoofing
                    setDetectedEmployee(emp);
                    setRequireSmile(true);
                    speak(`Hola ${emp.name}, sonríe por favor`);
                } else {
                    setStatus('No reconocido');
                    setSubStatus('');
                }
            } else {
                setStatus('Buscando cara...');
                setSubStatus('');
            }
        } catch (error) {
            console.error(error);
            setStatus('Error técnico');
        }
    }, [isScanning, lastDetection, isIdle, requireSmile, detectedEmployee, speak]);


    const handleClockIn = async (emp: IdentifiedEmployee, descriptor?: number[]) => {
        setIsScanning(false);
        setSubStatus('Fichando...');

        try {
            const payload = {
                employeeId: emp.id,
                method: 'face',
                descriptor: descriptor
            };

            let type = 'REGISTRADO';

            if (isOnline) {
                const clockRes = await fetch('/api/kiosk/clock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const clockData = await clockRes.json();

                if (clockData.success) {
                    type = clockData.data.entry.type === 'IN' ? 'ENTRADA' : 'SALIDA';
                    setStatus(`✅ ${type} CORRECTA`);
                    speak(`${type} confirmada para ${emp.name.split(' ')[0]}`);
                } else {
                    setStatus('❌ Error al fichar');
                    speak('Hubo un error al fichar');
                }
            } else {
                // Offline fallback
                addToQueue(payload);
                setStatus('💾 Fichaje guardado (Offline)');
                speak('Fichaje guardado en modo sin conexión');
            }

            setSubStatus(emp.name);

            // Cooldown
            setTimeout(() => {
                setStatus('Listo');
                setSubStatus('Mira a la cámara');
                setIsScanning(true);
                setRequireSmile(false);
                setDetectedEmployee(null);
            }, 4000);

        } catch (e) {
            setStatus('Error de conexión');
            setIsScanning(true);
        }
    };


    // Polling effect
    useEffect(() => {
        if (showAdmin) return;
        const interval = setInterval(captureAndCheck, 500);
        return () => clearInterval(interval);
    }, [captureAndCheck, showAdmin]);

    if (showAdmin) {
        return <div className="min-h-screen bg-slate-900"><KioskAdminPanel onClose={() => setShowAdmin(false)} /></div>;
    }

    // SCREENSAVER VIEW
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
            {/* Status Icons */}
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

            <div className={`relative rounded-2xl overflow-hidden shadow-2xl border-4 transition-colors duration-300 w-full max-w-md aspect-[3/4] ${requireSmile ? 'border-yellow-400' : 'border-blue-500'
                }`}>
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: 'user' }}
                    mirrored={true}
                    className="w-full h-full object-cover scale-x-[-1]"
                />

                {/* Overlay UI */}
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
                Entrar con PIN / Contraseña
            </button>
        </div>
    );
};

export default KioskPage;
