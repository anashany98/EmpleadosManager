import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    CheckCircle2,
    DollarSign,
    Image as ImageIcon,
    Loader2,
    Receipt,
    ScanLine,
    Upload,
    UserRound,
    X
} from 'lucide-react';
import { api } from '../../api/client';
import { toast } from 'sonner';
import type { ExpenseEmployeeOption } from '../../features/self-service/expenses/types';

interface ExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    employeeId?: string;
    employees?: ExpenseEmployeeOption[];
}

export default function ExpenseModal({ isOpen, onClose, onSuccess, employeeId, employees = [] }: ExpenseModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isLoadingOCR, setIsLoadingOCR] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeId || '');

    const [formData, setFormData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: 'MEALS',
        description: '',
        paymentMethod: 'CASH'
    });

    const [fieldErrors, setFieldErrors] = useState<{ amount?: string; category?: string; employee?: string }>({});

    const validateAmount = (value: string): string | null => {
        if (!value) return 'El importe es requerido';
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) return 'Introduce un valor positivo';
        return null;
    };

    const handleAmountBlur = () => {
        const error = validateAmount(formData.amount);
        setFieldErrors(prev => ({ ...prev, amount: error || undefined }));
    };

    const handleCategoryBlur = () => {
        if (!formData.category) {
            setFieldErrors(prev => ({ ...prev, category: 'Selecciona una categoría' }));
        } else {
            setFieldErrors(prev => ({ ...prev, category: undefined }));
        }
    };

    const handleEmployeeBlur = () => {
        const targetEmployeeId = employeeId || selectedEmployeeId;
        if (!targetEmployeeId) {
            setFieldErrors(prev => ({ ...prev, employee: 'Selecciona un empleado' }));
        } else {
            setFieldErrors(prev => ({ ...prev, employee: undefined }));
        }
    };

    useEffect(() => {
        if (isOpen) {
            setSelectedEmployeeId(employeeId || '');
        }
    }, [employeeId, isOpen]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;

        const selectedFile = e.target.files[0];
        setFile(selectedFile);
        setPreview(selectedFile.type.startsWith('image/') ? URL.createObjectURL(selectedFile) : null);
        void processOCR(selectedFile);
    };

    const processOCR = async (selectedFile: File) => {
        setIsLoadingOCR(true);

        try {
            const receiptData = new FormData();
            receiptData.append('receipt', selectedFile);

            const res = await api.post('/expenses/ocr', receiptData);
            const data = res.data || res;

            if (data) {
                setFormData(prev => ({
                    ...prev,
                    amount: data.suggestedAmount ? String(data.suggestedAmount) : prev.amount,
                    date: data.suggestedDate || prev.date,
                    description: data.text ? `${data.text.substring(0, 100)}...` : prev.description
                }));
                toast.success('Ticket escaneado con exito', {
                    description: 'Revisa los datos autocompletados.'
                });
            }
        } catch (error) {
            console.error('OCR Error', error);
            toast.error('No se pudo leer el ticket automaticamente', {
                description: 'Introduce los datos manualmente.'
            });
        } finally {
            setIsLoadingOCR(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const targetEmployeeId = employeeId || selectedEmployeeId;
        const errors: { amount?: string; category?: string; employee?: string } = {};

        const amountError = validateAmount(formData.amount);
        if (amountError) errors.amount = amountError;
        if (!formData.category) errors.category = 'Selecciona una categoría';
        if (!targetEmployeeId) errors.employee = 'Selecciona un empleado';

        setFieldErrors(errors);

        if (Object.keys(errors).length > 0) {
            return;
        }

        setIsSubmitting(true);
        try {
            const submitData = new FormData();
            submitData.append('employeeId', targetEmployeeId);
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
            console.error(error);
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
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex justify-between items-center text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md">
                                <Receipt className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight">Nuevo Gasto</h2>
                                <p className="text-blue-100 text-xs font-medium opacity-90">Sube tu ticket y digitalizalo</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`
                                        relative aspect-[3/4] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden group
                                        ${preview || file ? 'border-blue-500/50 bg-slate-50 dark:bg-slate-950' : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800/50'}
                                    `}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        accept="image/*,.pdf,application/pdf"
                                        className="hidden"
                                    />

                                    {preview ? (
                                        <>
                                            <img src={preview} alt="Receipt" className="w-full h-full object-contain p-2" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                                                    <Upload size={16} /> Cambiar archivo
                                                </div>
                                            </div>
                                            {isLoadingOCR && (
                                                <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-[2px] flex flex-col items-center justify-center text-white z-10">
                                                    <ScanLine className="w-12 h-12 animate-pulse mb-3" />
                                                    <span className="font-bold text-lg drop-shadow-md">Escaneando ticket...</span>
                                                </div>
                                            )}
                                        </>
                                    ) : file ? (
                                        <div className="text-center p-6 space-y-4">
                                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                                <Receipt size={32} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-700 dark:text-slate-200 break-all">{file.name}</p>
                                                <p className="text-xs text-slate-400 mt-1">Archivo seleccionado</p>
                                            </div>
                                            {isLoadingOCR && (
                                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl text-xs font-bold">
                                                    <ScanLine className="w-4 h-4 animate-pulse" /> Escaneando
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center p-6 space-y-4">
                                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                                                <ImageIcon size={32} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-700 dark:text-slate-200">Sube una foto del recibo</p>
                                                <p className="text-xs text-slate-400 mt-1">JPG, PNG o PDF</p>
                                            </div>
                                            <div className="inline-block px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold">
                                                Seleccionar archivo
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {!employeeId && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Empleado</label>
                                        <div className="relative">
                                            <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <select
                                                required
                                                value={selectedEmployeeId}
                                                onChange={e => setSelectedEmployeeId(e.target.value)}
                                                onBlur={handleEmployeeBlur}
                                                disabled={employees.length === 0}
                                                className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-60 ${fieldErrors.employee ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}
                                            >
                                                <option value="">Selecciona empleado</option>
                                                {employees.map((employee) => (
                                                    <option key={employee.id} value={employee.id}>
                                                        {employee.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {fieldErrors.employee && (
                                            <p className="text-red-500 text-sm mt-1 ml-1">{fieldErrors.employee}</p>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Importe total</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            onBlur={handleAmountBlur}
                                            className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border rounded-xl font-mono text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all ${fieldErrors.amount ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    {fieldErrors.amount && (
                                        <p className="text-red-500 text-sm mt-1 ml-1">{fieldErrors.amount}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Fecha del gasto</label>
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
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Categoria</label>
                                        <select
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                            onBlur={handleCategoryBlur}
                                            className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all ${fieldErrors.category ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}
                                        >
                                            <option value="MEALS">Dietas</option>
                                            <option value="TRANSPORT">Transporte / Taxi</option>
                                            <option value="ACCOMMODATION">Alojamiento</option>
                                            <option value="SUPPLIES">Material Oficina</option>
                                            <option value="EQUIPMENT">Equipamiento</option>
                                            <option value="OTHER">Otros</option>
                                        </select>
                                        {fieldErrors.category && (
                                            <p className="text-red-500 text-sm mt-1 ml-1">{fieldErrors.category}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Metodo pago</label>
                                        <select
                                            value={formData.paymentMethod}
                                            onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        >
                                            <option value="CASH">Efectivo (Reembolsar)</option>
                                            <option value="COMPANY_CARD">Tarjeta empresa</option>
                                            <option value="PERSONAL_CARD">Tarjeta personal</option>
                                            <option value="TRANSFER">Transferencia</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Descripcion / Concepto</label>
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
                                        Registrar gasto
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
