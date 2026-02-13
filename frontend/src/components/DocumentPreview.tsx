import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Download, ShieldCheck, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { FaceVerificationModal } from './FaceVerificationModal';
import SignaturePad from './SignaturePad';

interface DocumentPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    fileUrl: string;
    title: string;
    documentId?: string;
    employeeId?: string;
    canSign?: boolean;
}

export default function DocumentPreview({ isOpen, onClose, fileUrl, title, documentId, employeeId, canSign = false }: DocumentPreviewProps) {
    const [verifying, setVerifying] = useState(false);
    const [signing, setSigning] = useState(false);
    const [isSigned, setIsSigned] = useState(false);
    const [processing, setProcessing] = useState(false);

    const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/uploads/${fileUrl}`;

    // Signature functions temporarily unused
    /*
    const handleStartSigning = () => {
        setVerifying(true);
    };
    */

    const handleVerificationSuccess = () => {
        setVerifying(false);
        setSigning(true);
    };

    const handleSaveSignature = async (signatureBase64: string) => {
        if (!documentId) return;
        setProcessing(true);
        try {
            await api.post(`/documents/${documentId}/sign`, {
                signatureDataUrl: signatureBase64
            });
            toast.success('Documento firmado correctamente');
            setIsSigned(true);
            setSigning(false);
            // We might want to refresh the document list or the PDF view
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err: any) {
            toast.error('Error al firmar documento: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-white dark:bg-slate-900 w-full max-w-6xl h-full max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10 flex flex-col"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white leading-tight">{title}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Previsualización Segura</span>
                                    {isSigned && (
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                            <CheckCircle2 size={10} /> FIRMADO
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Signature feature temporarily disabled
                            {canSign && !isSigned && (
                                <button
                                    onClick={() => setVerifying(true)}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2"
                                >
                                    <PenTool size={16} />
                                    Firmar Ahora
                                </button>
                            )}
                            */}
                            <a
                                href={fullUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2.5 text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                                title="Abrir en pestaña nueva"
                            >
                                <ExternalLink size={20} />
                            </a>
                            <a
                                href={fullUrl}
                                download
                                className="p-2.5 text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                                title="Descargar"
                            >
                                <Download size={20} />
                            </a>
                            <div className="w-px h-8 bg-slate-100 dark:border-slate-800 mx-1"></div>
                            <button
                                onClick={onClose}
                                className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-4 md:p-8 overflow-auto flex flex-col">
                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative group">
                            <iframe
                                src={`${fullUrl}#toolbar=0`}
                                className="w-full h-full border-none"
                                title="Document Preview"
                            />

                            {/* Security Overlay */}
                            <div className="absolute top-4 left-4 p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/20 shadow-lg flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                <div className="p-2 bg-emerald-500 rounded-xl text-white">
                                    <ShieldCheck size={18} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Encriptado</p>
                                    <p className="text-[12px] font-bold text-slate-900 dark:text-white">Conexión Segura</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Status */}
                    {isSigned && (
                        <div className="p-4 bg-emerald-500 text-white text-center font-black text-xs uppercase tracking-widest shrink-0 animate-in slide-in-from-bottom duration-500">
                            Documento firmado y verificado facialmente
                        </div>
                    )}
                </motion.div>

                {/* Verification/Signing Modals */}
                {verifying && employeeId && (
                    <FaceVerificationModal
                        isOpen={verifying}
                        onClose={() => setVerifying(false)}
                        employeeId={employeeId}
                        onSuccess={handleVerificationSuccess}
                    />
                )}

                {signing && (
                    <SignaturePad
                        isOpen={signing}
                        onClose={() => setSigning(false)}
                        onSave={handleSaveSignature}
                        title={`Firmar: ${title}`}
                    />
                )}

                {processing && (
                    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-md flex items-center justify-center">
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4 border border-white/10">
                            <Loader2 className="animate-spin text-blue-500" size={48} />
                            <p className="font-black text-xs uppercase tracking-[0.2em] text-slate-500">Procesando Firma...</p>
                        </div>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
