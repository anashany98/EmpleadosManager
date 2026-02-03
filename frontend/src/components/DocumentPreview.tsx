// import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Printer, FileText, ExternalLink } from 'lucide-react';

interface DocumentPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    fileUrl: string;
    title?: string;
}

export default function DocumentPreview({ isOpen, onClose, fileUrl, title = 'Previsualización de Documento' }: DocumentPreviewProps) {
    if (!fileUrl) return null;

    // Ensure the URL is absolute for the iframe
    const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/${fileUrl}`;

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = fullUrl;
        link.setAttribute('download', fileUrl.split('/').pop() || 'documento.pdf');
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handlePrint = () => {
        const printWindow = window.open(fullUrl, '_blank');
        if (printWindow) {
            printWindow.onload = () => {
                printWindow.print();
            };
        }
    };

    const handleOpenExternal = () => {
        window.open(fullUrl, '_blank');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-5xl h-full bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1">{title}</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Vista Previa Profesional</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleOpenExternal}
                                    className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                                    title="Abrir en pestaña nueva"
                                >
                                    <ExternalLink size={20} />
                                </button>
                                <button
                                    onClick={handlePrint}
                                    className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                                    title="Imprimir"
                                >
                                    <Printer size={20} />
                                </button>
                                <button
                                    onClick={handleDownload}
                                    className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
                                >
                                    <Download size={18} />
                                    Descargar
                                </button>
                                <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-2 hidden sm:block"></div>
                                <button
                                    onClick={onClose}
                                    className="p-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* PDF Viewer */}
                        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-4 overflow-hidden relative group">
                            <iframe
                                src={`${fullUrl}#toolbar=0&navpanes=0`}
                                className="w-full h-full rounded-xl shadow-lg bg-white"
                                title="PDF Preview"
                            />

                            {/* Mobile specific message if iframe might be tricky */}
                            <div className="md:hidden absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-900/90 backdrop-blur p-4 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 text-center w-[85%]">
                                <p className="text-xs font-medium mb-2">¿Problemas visualizando el documento?</p>
                                <button
                                    onClick={handleDownload}
                                    className="w-full bg-blue-600 text-white py-2 rounded-xl text-xs font-bold"
                                >
                                    Descargar PDF
                                </button>
                            </div>
                        </div>

                        {/* Footer Tips */}
                        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/20 text-[10px] text-slate-400 font-bold uppercase tracking-widest flex justify-center gap-8">
                            <span>Auto-guardado en el expediente</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="hidden sm:inline">Incluye Firma QR verificable</span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
