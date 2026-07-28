import { useState } from 'react';
import { Loader2, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../../api/client';

export function ReactivateEmployeeDialog({
    employeeId,
    employeeName,
    onClose,
    onSuccess
}: {
    employeeId: string;
    employeeName: string;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [reactivationDate, setReactivationDate] = useState(new Date().toISOString().slice(0, 10));
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (reason.trim().length < 5) {
            toast.error('Indica un motivo de al menos 5 caracteres.');
            return;
        }
        setSaving(true);
        try {
            await api.post(`/offboarding/${employeeId}/reactivate`, { reactivationDate, reason: reason.trim() });
            toast.success('Empleado reactivado. La baja anterior sigue disponible en el cronograma.');
            onSuccess();
        } catch (error) {
            toast.error(getErrorMessage(error, 'No se pudo reactivar al empleado'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reactivate-title">
            <form onSubmit={submit} className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <header className="flex items-start justify-between border-b border-slate-200 bg-emerald-50 px-6 py-5 dark:border-slate-800 dark:bg-emerald-950/20">
                    <div>
                        <h2 id="reactivate-title" className="flex items-center gap-2 text-lg font-extrabold text-slate-950 dark:text-white">
                            <RotateCcw size={19} className="text-emerald-700" />
                            Reactivar a {employeeName}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Se restaurará el acceso. La baja, su fecha y su motivo permanecerán en el cronograma.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-800" aria-label="Cerrar">
                        <X size={18} />
                    </button>
                </header>
                <div className="space-y-4 p-6">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Fecha de reactivación
                        <input type="date" required value={reactivationDate} onChange={(event) => setReactivationDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800" />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Motivo
                        <textarea required minLength={5} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej.: reincorporación tras nueva contratación" className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800" />
                    </label>
                </div>
                <footer className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                    <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancelar</button>
                    <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                        Reactivar empleado
                    </button>
                </footer>
            </form>
        </div>
    );
}
