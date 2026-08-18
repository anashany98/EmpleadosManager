import { useEffect, useState } from 'react';
import { CalendarDays, UserMinus, X } from 'lucide-react';
import { OFFBOARDING_REASONS } from '../constants/offboardingReasons';

export interface EmployeeDeactivationData {
    terminationType: 'DISMISSAL' | 'VOLUNTARY_LEAVE' | 'CONTRACT_END' | 'OTHER';
    reason: string;
    date: string;
}

export function EmployeeDeactivationDialog({
    open,
    employeeCount,
    busy,
    onClose,
    onConfirm
}: {
    open: boolean;
    employeeCount: number;
    busy: boolean;
    onClose: () => void;
    onConfirm: (data: EmployeeDeactivationData) => void;
}) {
    const [reasonCode, setReasonCode] = useState(OFFBOARDING_REASONS[0].value);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

    useEffect(() => {
        if (!open) return;
        setReasonCode(OFFBOARDING_REASONS[0].value);
        setDate(new Date().toISOString().slice(0, 10));
    }, [open]);

    if (!open) return null;

    const selectedReason = OFFBOARDING_REASONS.find((reason) => reason.value === reasonCode) || OFFBOARDING_REASONS[0];
    const valid = Boolean(date);

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="employee-deactivation-title">
            <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-2xl dark:border-rose-950 dark:bg-slate-900">
                <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                    <div className="flex gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                            <UserMinus size={21} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-500">Salida de plantilla</p>
                            <h2 id="employee-deactivation-title" className="mt-1 text-xl font-black tracking-tight text-slate-950 dark:text-white">
                                Desactivar {employeeCount === 1 ? 'empleado' : `${employeeCount} empleados`}
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                Se cerrará el periodo laboral, se bloqueará el acceso y las vacaciones quedarán en 0.
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} disabled={busy} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" aria-label="Cerrar">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-5 px-6 py-6">
                    <div>
                        <label htmlFor="termination-reason" className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Motivo del cese</label>
                        <select
                            id="termination-reason"
                            value={reasonCode}
                            onChange={(event) => setReasonCode(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-rose-950"
                        >
                            {OFFBOARDING_REASONS.map((reason) => (
                                <option key={reason.value} value={reason.value}>{reason.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="termination-date" className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Fecha efectiva</label>
                        <div className="relative">
                            <CalendarDays className="pointer-events-none absolute left-4 top-3.5 text-slate-400" size={17} />
                            <input
                                id="termination-date"
                                type="date"
                                value={date}
                                onChange={(event) => setDate(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-rose-950"
                            />
                        </div>
                    </div>

                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <button type="button" onClick={onClose} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800">
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={!valid || busy}
                        onClick={() => onConfirm({ terminationType: selectedReason.type, reason: selectedReason.label, date })}
                        className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-rose-600/20 transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        {busy ? 'Desactivando…' : 'Registrar baja y desactivar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
