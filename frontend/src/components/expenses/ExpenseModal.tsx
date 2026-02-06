import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Receipt, Loader2, CheckCircle2, DollarSign, Calendar, ScanLine, Image as ImageIcon } from 'lucide-react';
import { api } from '../../api/client';
import { toast } from 'sonner';

interface ExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    employeeId: string;
}

export default function ExpenseModal({ isOpen, onClose, onSuccess, employeeId }: ExpenseModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isLoadingOCR, setIsLoadingOCR] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    // const [step, setStep] = useState<'upload' | 'details'>('upload');
    const [formData, setFormData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: 'DIETAS',
        description: '',
        paymentMethod: 'CASH' // CASH | COMPANY_CARD
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
            processOCR(selectedFile);
        }
    };

    const processOCR = async (file: File) => {
        setIsLoadingOCR(true);
        // setStep('details'); // Move to details view immediately with loader

        try {
            const formData = new FormData();
            formData.append('receipt', file);

            const res = await api.post('/expenses/ocr', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
                // Client.ts handles "instanceof FormData" check to remove json content-type
            });

            const data = res.data || res;

            if (data) {
                setFormData(prev => ({
                    ...prev,
                    amount: data.suggestedAmount || prev.amount,
                    date: data.suggestedDate || prev.date,
                    description: data.text ? data.text.substring(0, 100) + '...' : ''
                }));
                toast.success('Ticket escaneado con éxito', {
                    description: 'Revisa los datos autocompletados.'
                });
            }

        } catch (error) {
            console.error('OCR Error', error);
            toast.error('No se pudo leer el ticket automáticamente', {
                description: 'Por favor, introduce los datos manualmente.'
            });
        } finally {
            setIsLoadingOCR(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.amount || !formData.category) {
            toast.error('Completa los campos obligatorios');
            return;
        }

        setIsSubmitting(true);
        try {
            const submitData = new FormData();
            submitData.append('employeeId', employeeId);
            submitData.append('category', formData.category);
            submitData.append('amount', formData.amount);
            submitData.append('date', formData.date);
            submitData.append('description', formData.description);
            submitData.append('paymentMethod', formData.paymentMethod);
            if (file) {
                submitData.append('receipt', file);
            }

            await api.post('/expenses/upload', submitData);

            toast.success('Gasto registrado correctamente');
            onSuccess();
            onClose();
        } catch (error) {
            toast.error('Error al registrar el gasto');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex justify-between items-center text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md">
                                <Receipt className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight">Nuevo Gasto</h2>
                                <p className="text-blue-100 text-xs font-medium opacity-90">Sube tu ticket y digitalízalo</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                            {/* Left Col: Upload/Preview */}
                            <div className="space-y-4">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`
                                        relative aspect-[3/4] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden group
                                        ${preview ? 'border-blue-500/50 bg-slate-50 dark:bg-slate-950' : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800/50'}
                                    `}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        accept="image/*"
                                        className="hidden"
                                    />

                                    {preview ? (
                                        <>
                                            <img src={preview} alt="Receipt" className="w-full h-full object-contain p-2" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                                                    <Upload size={16} /> Cambiar Foto
                                                </div>
                                            </div>
                                            {isLoadingOCR && (
                                                <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-[2px] flex flex-col items-center justify-center text-white z-10">
                                                    <ScanLine className="w-12 h-12 animate-pulse mb-3" />
                                                    <span className="font-bold text-lg drop-shadow-md">Escaneando Ticket...</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center p-6 space-y-4">
                                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                                                <ImageIcon size={32} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-700 dark:text-slate-200">Sube una foto del recibo</p>
                                                <p className="text-xs text-slate-400 mt-1">JPG, PNG (Max 5MB)</p>
                                            </div>
                                            <div className="inline-block px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold">
                                                Seleccionar Archivo
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Col: Form */}
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Importe Total (€)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Fecha del Gasto</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="date"
                                            required
                                            value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Categoría</label>
                                        <select
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        >
                                            <option value="DIETAS">Dietas</option>
                                            <option value="TRANSPORTE">Transporte / Taxi</option>
                                            <option value="ALOJAMIENTO">Alojamiento</option>
                                            <option value="MATERIAL">Material Oficina</option>
                                            <option value="OTROS">Otros</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Método Pago</label>
                                        <select
                                            value={formData.paymentMethod}
                                            onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        >
                                            <option value="CASH">Efectivo (Reembolsar)</option>
                                            <option value="COMPANY_CARD">Tarjeta Empresa</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Descripción / Concepto</label>
                                    <textarea
                                        rows={3}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                        placeholder="Comida con cliente..."
                                    />
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        disabled={isSubmitting}
                                        className="flex-1 py-3.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || isLoadingOCR}
                                        className="flex-[2] py-3.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                                        Registrar Gasto
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
