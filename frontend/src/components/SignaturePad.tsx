import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, Check, RotateCcw } from 'lucide-react';

interface SignaturePadProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (signatureBase64: string) => void;
    title?: string;
}

export default function SignaturePad({ isOpen, onClose, onSave, title = "Firma del Documento" }: SignaturePadProps) {
    const sigCanvas = useRef<SignatureCanvas>(null);
    const [isEmpty, setIsEmpty] = useState(true);

    const clear = () => {
        sigCanvas.current?.clear();
        setIsEmpty(true);
    };

    const save = () => {
        if (sigCanvas.current?.isEmpty()) return;
        const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
        if (dataUrl) {
            onSave(dataUrl);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
                        <p className="text-xs text-slate-500">Por favor, firma dentro del recuadro</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-950 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden touch-none">
                        <SignatureCanvas
                            ref={sigCanvas}
                            penColor="black"
                            canvasProps={{
                                className: "w-full h-64 cursor-crosshair",
                            }}
                            onBegin={() => setIsEmpty(false)}
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={clear}
                            className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2"
                        >
                            <RotateCcw size={18} />
                            Limpiar
                        </button>
                        <button
                            onClick={save}
                            disabled={isEmpty}
                            className="flex-[2] px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <Check size={18} />
                            Guardar Firma
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
