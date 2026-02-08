import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { FaceRecognitionService } from '../services/faceRecognition';
import { X, Loader2, Sparkles } from 'lucide-react';
import { api } from '../api/client';

interface FaceVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    employeeId: string;
    onSuccess: () => void;
}

type LivenessState = 'START' | 'BLINK' | 'SMILE' | 'SUCCESS' | 'FAILED';

export const FaceVerificationModal: React.FC<FaceVerificationModalProps> = ({ isOpen, onClose, employeeId, onSuccess }) => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState<string>('Inicializando...');
    const [isModelsLoaded, setIsModelsLoaded] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [liveness, setLiveness] = useState<LivenessState>('START');

    useEffect(() => {
        if (isOpen) {
            FaceRecognitionService.loadModels().then(() => {
                setIsModelsLoaded(true);
                setStatus('Listo para verificar');
            });
        }
    }, [isOpen]);

    // HUD and Landmarks Loop
    useEffect(() => {
        let animationId: number;
        const draw = async () => {
            if (webcamRef.current?.video && canvasRef.current && isModelsLoaded) {
                const video = webcamRef.current.video;
                const canvas = canvasRef.current;
                if (video.readyState === 4) {
                    const ctx = canvas.getContext('2d');
                    const detection = await FaceRecognitionService.getFullDetection(video);

                    if (ctx) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        if (detection) {
                            ctx.fillStyle = '#3b82f6';
                            detection.landmarks.positions.forEach(p => {
                                ctx.beginPath();
                                ctx.arc(p.x * (canvas.width / video.videoWidth), p.y * (canvas.height / video.videoHeight), 1, 0, 2 * Math.PI);
                                ctx.fill();
                            });
                        }
                    }
                }
            }
            animationId = requestAnimationFrame(draw);
        };
        if (isOpen && isModelsLoaded) draw();
        return () => cancelAnimationFrame(animationId);
    }, [isOpen, isModelsLoaded]);

    const runLiveness = useCallback(async () => {
        if (!webcamRef.current?.video || !isModelsLoaded) return;
        setProcessing(true);
        setError(null);

        try {
            // 1. Identity Match (Capture current frame)
            setStatus('Comprobando identidad...');
            const screenshot = webcamRef.current.getScreenshot();
            const match = await api.post('/kiosk/verify', {
                employeeId,
                image: screenshot
            });

            if (!match.data?.verified) {
                throw new Error('Identidad no verificada. Asegúrate de estar bien iluminado.');
            }

            // 2. Blink Detection Loop
            setLiveness('BLINK');
            setStatus('VERIFICANDO: Parpadea ahora');

            let blinkDetected = false;
            const startTime = Date.now();

            while (!blinkDetected && Date.now() - startTime < 6000) { // Reduced timeout to 6s
                if (!webcamRef.current?.video) break;
                const detection = await FaceRecognitionService.getFullDetection(webcamRef.current.video);
                if (detection && FaceRecognitionService.detectBlink(detection.landmarks)) {
                    blinkDetected = true;
                }
                await new Promise(r => setTimeout(r, 100)); // Sample every 100ms
            }

            if (!blinkDetected) throw new Error('No se detectó el parpadeo. Inténtalo de nuevo.');

            setLiveness('SUCCESS');
            setStatus('IDENTIDAD CONFIRMADA');

            setTimeout(() => {
                onSuccess();
                onClose();
            }, 800);

        } catch (err: any) {
            setError(err.message || 'Fallo en la verificación');
            setLiveness('FAILED');
        } finally {
            setProcessing(false);
        }
    }, [employeeId, isModelsLoaded, onClose, onSuccess]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden border border-white/10 relative">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                            <div className="p-2 bg-blue-500 rounded-xl text-white">
                                <Sparkles size={20} />
                            </div>
                            Verificación Facial
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-black">Seguridad Biométrica Activa</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    <div className="relative aspect-square max-w-[320px] mx-auto rounded-[3.5rem] overflow-hidden shadow-2xl border-4 border-slate-100 dark:border-slate-800 bg-slate-900">
                        {isModelsLoaded ? (
                            <>
                                <Webcam
                                    ref={webcamRef}
                                    audio={false}
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={{ facingMode: 'user' }}
                                    className="w-full h-full object-cover grayscale brightness-110"
                                />
                                <canvas
                                    ref={canvasRef}
                                    width={480}
                                    height={480}
                                    className="absolute inset-0 w-full h-full pointer-events-none"
                                />
                            </>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-4">
                                <Loader2 className="animate-spin" size={32} />
                                <span className="text-xs font-black uppercase tracking-widest">Iniciando IA...</span>
                            </div>
                        )}

                        {/* Scanner HUD Overlay */}
                        <div className="absolute inset-0 border-[30px] border-black/20 pointer-events-none"></div>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className={`w-56 h-56 border-2 border-dashed rounded-full transition-all duration-700 ${processing ? 'border-blue-500 animate-pulse scale-110' : 'border-white/20'}`}></div>
                        </div>

                        {/* Liveness Indicator */}
                        {liveness !== 'START' && liveness !== 'FAILED' && (
                            <div className={`absolute top-6 left-1/2 -translate-x-1/2 px-6 py-2 ${liveness === 'SUCCESS' ? 'bg-green-500' : 'bg-blue-600'} text-white text-[10px] font-black rounded-full shadow-2xl animate-bounce flex items-center gap-2`}>
                                <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                                {liveness === 'BLINK' ? 'PARPADEA AHORA' : liveness === 'SMILE' ? 'SONRÍE' : 'VERIFICADO'}
                            </div>
                        )}
                    </div>

                    <div className="text-center space-y-4">
                        <div className={`text-sm font-black tracking-tight uppercase ${error ? 'text-red-500 animate-shake' : 'text-slate-900 dark:text-white'}`}>
                            {error || status}
                        </div>
                        {error && (
                            <button
                                onClick={() => { setError(null); setStatus('Listo'); setLiveness('START'); }}
                                className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-200 transition-all"
                            >
                                Reintentar
                            </button>
                        )}
                    </div>

                    {!processing && !error && liveness === 'START' && (
                        <button
                            onClick={runLiveness}
                            disabled={!isModelsLoaded}
                            className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/40 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            Comenzar Identificación
                        </button>
                    )}

                    {processing && (
                        <div className="w-full flex justify-center py-2">
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
