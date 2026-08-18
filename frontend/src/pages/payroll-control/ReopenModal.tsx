import { Unlock } from 'lucide-react';

interface ReopenModalProps {
    open: boolean;
    reason: string;
    onReasonChange: (value: string) => void;
    onCancel: () => void;
    onSubmit: () => void;
}

export default function ReopenModal({ open, reason, onReasonChange, onCancel, onSubmit }: ReopenModalProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 text-amber-600">
                    <Unlock size={24} />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reabrir Período Mensual</h3>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Por motivos de seguridad y auditoría, debe introducir una justificación explicativa para reabrir este período mensual de control.
                </p>

                <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Motivo de reapertura <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                        rows={3}
                        value={reason}
                        onChange={(e) => onReasonChange(e.target.value)}
                        placeholder="Ej: Ajuste solicitado por RRHH tras revisión de horas extra de carpintería..."
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                    />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium rounded-xl transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
                    >
                        Confirmar Reapertura
                    </button>
                </div>
            </div>
        </div>
    );
}
