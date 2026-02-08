import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, AlertTriangle, Package, FileText, CheckCircle,
    ChevronRight, ChevronLeft, Loader2, Trash2
} from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

interface OffboardingWizardProps {
    employeeId: string;
    employeeName: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function OffboardingWizard({ employeeId, employeeName, onClose, onSuccess }: OffboardingWizardProps) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
    const [form, setForm] = useState({
        exitDate: new Date().toISOString().split('T')[0],
        reason: 'BAJA_VOLUNTARIA'
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/offboarding/${employeeId}/prepare`);
                if (res.success) {
                    setData(res.data);
                    // Pre-select all assets for return by default
                    setSelectedAssets(res.data.pendingAssets.map((a: any) => a.id));
                }
            } catch (err: any) {
                toast.error('Error cargando datos de baja: ' + err.message);
                onClose();
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [employeeId, onClose]);

    const toggleAsset = (id: string) => {
        setSelectedAssets(prev =>
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    const handleConfirm = async () => {
        setLoading(true);
        try {
            const res = await api.post(`/offboarding/${employeeId}/confirm`, {
                ...form,
                returnAssets: selectedAssets
            });
            if (res.success) {
                toast.success('Baja procesada correctamente');
                onSuccess();
            }
        } catch (err: any) {
            toast.error('Error al procesar la baja: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !data) {
        return (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-blue-500" size={40} />
                    <p className="text-slate-600 dark:text-slate-400 animate-pulse">Preparando proceso de salida...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Trash2 className="text-red-500" size={24} />
                            Baja de Empleado
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Tramitando salida de: <span className="font-semibold text-slate-700 dark:text-slate-200">{employeeName}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800">
                    <motion.div
                        className="h-full bg-red-500"
                        initial={{ width: '0%' }}
                        animate={{ width: `${(step / 3) * 100}%` }}
                    />
                </div>

                {/* Content */}
                <div className="p-8 min-h-[350px]">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-2">
                                    <Package size={24} />
                                    <h3 className="text-xl font-bold">Devolución de Activos</h3>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 text-sm italic">
                                    Marca los artículos que han sido devueltos físicamente por el empleado.
                                </p>

                                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                    {data?.pendingAssets.length > 0 ? (
                                        data.pendingAssets.map((asset: any) => (
                                            <div
                                                key={asset.id}
                                                onClick={() => toggleAsset(asset.id)}
                                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${selectedAssets.includes(asset.id)
                                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10'
                                                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${selectedAssets.includes(asset.id) ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                        <Package size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 dark:text-slate-200">{asset.name}</p>
                                                        <p className="text-xs text-slate-500">{asset.category} {asset.serialNumber && `· S/N: ${asset.serialNumber}`}</p>
                                                    </div>
                                                </div>
                                                {selectedAssets.includes(asset.id) && <CheckCircle className="text-emerald-500" size={20} />}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                            <CheckCircle className="mx-auto text-emerald-500 mb-2" size={32} />
                                            <p className="text-slate-600 dark:text-slate-400 font-medium">Sin activos pendientes de devolución</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-2">
                                    <FileText size={24} />
                                    <h3 className="text-xl font-bold">Datos de Liquidación</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Fecha de Baja Única</label>
                                        <input
                                            type="date"
                                            value={form.exitDate}
                                            onChange={e => setForm({ ...form, exitDate: e.target.value })}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Motivo del Cese</label>
                                        <select
                                            value={form.reason}
                                            onChange={e => setForm({ ...form, reason: e.target.value })}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all"
                                        >
                                            <option value="BAJA_VOLUNTARIA">Baja Voluntaria / Dimisión</option>
                                            <option value="FIN_CONTRATO">Fin de Contrato / No Superación Prueba</option>
                                            <option value="DESPIDO_OBJETIVO">Despido Objetivo</option>
                                            <option value="DESPIDO_DISCIPLINARIO">Despido Disciplinario</option>
                                            <option value="JUBILACION">Jubilación</option>
                                            <option value="OTRO">Otro motivo</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 flex gap-3 text-amber-700 dark:text-amber-400 text-sm">
                                    <AlertTriangle size={20} className="shrink-0" />
                                    <p>Confirmar la baja desactivará automáticamente el acceso del empleado al portal y cerrará cualquier registro horario abierto.</p>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="text-center space-y-6 pt-8"
                            >
                                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white dark:border-slate-900 shadow-xl">
                                    <AlertTriangle size={40} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Confirmar Cese de Actividad</h3>
                                    <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto">
                                        Estás a punto de tramitar la baja definitiva de <strong>{employeeName}</strong> con fecha {new Date(form.exitDate).toLocaleDateString()}.
                                    </p>
                                </div>
                                <div className="text-left bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Resumen de acciones:</p>
                                    <ul className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
                                        <li className="flex items-center gap-2">✅ Devolución de {selectedAssets.length} activos</li>
                                        <li className="flex items-center gap-2">✅ Desactivación de ficha de empleado</li>
                                        <li className="flex items-center gap-2">✅ Bloqueo de credenciales de usuario</li>
                                        <li className="flex items-center gap-2">✅ Histórico de auditoría registrado</li>
                                    </ul>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Buttons */}
                <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button
                        onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                        className="px-6 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold transition-colors"
                    >
                        {step === 1 ? 'Cancelar' : 'Anterior'}
                    </button>

                    <button
                        onClick={() => step < 3 ? setStep(step + 1) : handleConfirm()}
                        disabled={loading}
                        className={`px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg ${step === 3
                                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30'
                                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                            } disabled:opacity-50`}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (step === 3 ? 'Confirmar Baja Definitiva' : 'Siguiente')}
                        {step < 3 && !loading && <ChevronRight size={20} />}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
