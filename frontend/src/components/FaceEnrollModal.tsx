import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { FaceRecognitionService } from '../services/faceRecognition';
import { X, Camera, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';

interface FaceEnrollModalProps {
    isOpen: boolean;
    onClose: () => void;
    employeeId: string;
    employeeName: string;
    onSuccess: () => void;
}

type EnrollmentStep = 'FRONT' | 'LEFT' | 'RIGHT' | 'DONE';

export const FaceEnrollModal: React.FC<FaceEnrollModalProps> = ({ isOpen, onClose, employeeId, employeeName, onSuccess }) => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState<string>('Cargando modelos...');
    const [isModelsLoaded, setIsModelsLoaded] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [currentStep, setCurrentStep] = useState<EnrollmentStep>('FRONT');
    const [descriptors, setDescriptors] = useState<Float32Array[]>([]);

    useEffect(() => {
        if (isOpen) {
            setStatus('Cargando modelos de IA...');
            FaceRecognitionService.loadModels()
                .then(() => {
                    setStatus('Listo. Mira al centro.');
                    setIsModelsLoaded(true);
                })
                .catch(err => {
                    setError('Error cargando IA: ' + err.message);
                    setStatus('Error');
                });
        }
    }, [isOpen]);

    // Draw landmarks loop
    useEffect(() => {
        let animationId: number;

        const draw = async () => {
            if (webcamRef.current?.video && canvasRef.current && isModelsLoaded) {
                const video = webcamRef.current.video;
                const canvas = canvasRef.current;

                if (video.readyState === 4) {
                    const detection = await FaceRecognitionService.getFullDetection(video);
                    if (detection) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            // Draw minimalist landmarks
                            // Draw mirrored landmarks
                            ctx.save();
                            ctx.scale(-1, 1);
                            ctx.translate(-canvas.width, 0);
                            ctx.fillStyle = '#3b82f6';
                            detection.landmarks.positions.forEach(p => {
                                ctx.beginPath();
                                ctx.arc(p.x * (canvas.width / video.videoWidth), p.y * (canvas.height / video.videoHeight), 2, 0, 2 * Math.PI);
                                ctx.fill();
                            });
                            ctx.restore();
                        }
                    }
                }
            }
            animationId = requestAnimationFrame(draw);
        };

        if (isOpen && isModelsLoaded) draw();
        return () => cancelAnimationFrame(animationId);
    }, [isOpen, isModelsLoaded]);

    const handleCapture = useCallback(async () => {
        if (!webcamRef.current?.video || !isModelsLoaded) return;
        setCapturing(true);
        setError(null);

        try {
            const video = webcamRef.current.video;
            const detection = await FaceRecognitionService.getFullDetection(video);

            if (!detection) {
                throw new Error('No se detectó el rostro. Asegúrate de tener buena iluminación.');
            }

            const orientation = FaceRecognitionService.detectOrientation(detection.landmarks);

            // Validate step orientation
            if (currentStep === 'FRONT' && orientation !== 'CENTER') {
                throw new Error('Por favor, mira directamente a la cámara (Centro).');
            }
            if (currentStep === 'LEFT' && orientation !== 'LEFT') {
                throw new Error('Gira la cabeza un poco hacia tu IZQUIERDA.');
            }
            if (currentStep === 'RIGHT' && orientation !== 'RIGHT') {
                throw new Error('Gira la cabeza un poco hacia tu DERECHA.');
            }

            const newDescriptors = [...descriptors, detection.descriptor];
            setDescriptors(newDescriptors);

            if (currentStep === 'FRONT') {
                setCurrentStep('LEFT');
                setStatus('Bien. Ahora gira un poco a la IZQUIERDA.');
            } else if (currentStep === 'LEFT') {
                setCurrentStep('RIGHT');
                setStatus('Excelente. Ahora gira un poco a la DERECHA.');
            } else if (currentStep === 'RIGHT') {
                setCurrentStep('DONE');
                setStatus('Procesando registro final...');

                // Final Save
                const average = FaceRecognitionService.getAverageDescriptor(newDescriptors);
                await api.post('/kiosk/enroll', {
                    employeeId,
                    descriptor: average
                });

                toast.success(`Biometría de ${employeeName} registrada correctamente.`);
                onSuccess();
                setTimeout(onClose, 1500);
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setCapturing(false);
        }
    }, [currentStep, descriptors, employeeId, employeeName, isModelsLoaded, onClose, onSuccess]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-xl w-full overflow-hidden border border-white/10 relative">
                <div className="p-8 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                            <div className="p-2 bg-blue-600 rounded-xl text-white">
                                <Camera size={20} />
                            </div>
                            Registro Biométrico
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black">Escaneo de Alta Precisión</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                <div className="px-8 pb-8 space-y-8">
                    {/* Progress Steps */}
                    <div className="flex gap-2">
                        {['FRONT', 'LEFT', 'RIGHT'].map((s, idx) => (
                            <div
                                key={s}
                                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${(descriptors.length > idx || currentStep === 'DONE') ? 'bg-green-500' :
                                    currentStep === s ? 'bg-blue-600 animate-pulse' : 'bg-slate-200 dark:bg-slate-800'
                                    }`}
                            />
                        ))}
                    </div>

                    <div className="relative aspect-video bg-slate-950 rounded-[2rem] overflow-hidden shadow-2xl border border-white/5">
                        {isModelsLoaded ? (
                            <>
                                <Webcam
                                    ref={webcamRef}
                                    audio={false}
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={{ facingMode: 'user' }}
                                    mirrored={true}
                                    className="w-full h-full object-cover grayscale opacity-60 scale-x-[-1]"
                                />
                                <canvas
                                    ref={canvasRef}
                                    width={640}
                                    height={480}
                                    className="absolute inset-0 w-full h-full pointer-events-none"
                                />
                                {/* HUD */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className={`w-48 h-64 border-2 rounded-[4rem] border-dashed transition-all duration-300 ${currentStep === 'LEFT' ? 'border-l-4 border-l-blue-500 translate-x-10' :
                                        currentStep === 'RIGHT' ? 'border-r-4 border-r-blue-500 -translate-x-10' :
                                            'border-white/20'
                                        }`}></div>

                                    {/* Visual Arrow Indicators */}
                                    {currentStep === 'LEFT' && (
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 animate-bounce">
                                            <div className="w-0 h-0 border-t-[10px] border-t-transparent border-r-[15px] border-r-blue-500 border-b-[10px] border-b-transparent"></div>
                                        </div>
                                    )}
                                    {currentStep === 'RIGHT' && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-bounce">
                                            <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[15px] border-l-blue-500 border-b-[10px] border-b-transparent"></div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-4">
                                <Loader2 className="animate-spin" size={32} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sincronizando Sensores...</span>
                            </div>
                        )}
                    </div>

                    <div className="text-center space-y-4">
                        <p className={`text-sm font-bold tracking-tight ${error ? 'text-red-500 animate-shake' : 'text-slate-900 dark:text-white'}`}>
                            {error || status}
                        </p>
                        {currentStep === 'DONE' && (
                            <div className="flex justify-center">
                                <div className="p-3 bg-green-500/10 text-green-500 rounded-full">
                                    <Check size={32} className="animate-in zoom-in duration-500" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4">
                        {currentStep !== 'DONE' && (
                            <button
                                onClick={handleCapture}
                                disabled={!isModelsLoaded || capturing}
                                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/30 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-3"
                            >
                                {capturing ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
                                {capturing ? 'Analizando...' : `Capturar ${currentStep === 'FRONT' ? 'Centro' : currentStep === 'LEFT' ? 'Izquierda' : 'Derecha'}`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
