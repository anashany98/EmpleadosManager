import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { ControlHorarioTotals, PayrollRecord } from './types';

interface SettlementSummaryProps {
    record: PayrollRecord;
    isLocked: boolean;
    totals: ControlHorarioTotals;
    onUpdateField: (field: keyof PayrollRecord, value: string | number) => void;
    onRestoreOvertimeAmount: () => void;
}

export function SettlementSummary({
    record,
    isLocked,
    totals,
    onUpdateField,
    onRestoreOvertimeAmount
}: SettlementSummaryProps) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Datos para la liquidación mensual</h4>
                <p className="text-xs text-slate-500">Las horas y dietas proceden automáticamente de la tabla diaria y se trasladan al control de gestoría.</p>
            </div>

            {((totals.overtime > 0 && Number(record.overtimeRate || 0) === 0) || (totals.holiday > 0 && Number(record.holidayOvertimeRate || 0) === 0)) && (
                <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                    <AlertTriangle size={18} className="shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                        Hay horas computadas ({totals.overtime > 0 ? `${totals.overtime.toFixed(2)}h extras` : ''} {totals.holiday > 0 ? `${totals.holiday.toFixed(2)}h festivas` : ''}) pero su tarifa está a 0.00 €/h. Introduce el precio/hora para que el importe se calcule correctamente para gestoría.
                    </span>
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Código Gestoría
                    <input
                        type="text"
                        disabled={isLocked}
                        value={record.gestoriaCode || ''}
                        placeholder="Sin código"
                        onChange={(event) => onUpdateField('gestoriaCode', event.target.value.trim() || '')}
                        className={`mt-1 h-9 w-full rounded-lg border px-3 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 dark:bg-slate-800 ${!record.gestoriaCode ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700' : 'border-slate-300 bg-white dark:border-slate-600'}`}
                    />
                </label>
                {[
                    ['overtimeRate', 'Precio hora extra', '0.01'],
                    ['holidayOvertimeRate', 'Precio hora festiva', '0.01'],
                    ['positiveVariable', 'Variable positiva', '0.01'],
                    ['negativeVariable', 'Variable negativa', '0.01']
                ].map(([field, label, step]) => (
                    <label key={field} className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {label}
                        <input type="number" min="0" step={step} disabled={isLocked} value={Number(record[field as keyof PayrollRecord] || 0)} onChange={(event) => onUpdateField(field as keyof PayrollRecord, event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-800" />
                    </label>
                ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Observaciones del mes
                    <textarea rows={2} disabled={isLocked} value={record.observations || ''} onChange={(event) => onUpdateField('observations', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-800" />
                </label>
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">
                    <div><span className="block text-slate-500">Horas extra</span><strong>{totals.overtime.toFixed(2)} h</strong></div>
                    <div><span className="block text-slate-500">Horas festivas</span><strong>{totals.holiday.toFixed(2)} h</strong></div>
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="block text-slate-500">Importe horas</span>
                            {record.isTotalOvertimeAmountManual && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">Manual</span>
                            )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                            <strong>{Number(record.totalOvertimeAmount || 0).toFixed(2)} €</strong>
                            {record.isTotalOvertimeAmountManual && !isLocked && (
                                <button
                                    type="button"
                                    onClick={onRestoreOvertimeAmount}
                                    title="Restaurar cálculo automático desde tarifas"
                                    className="rounded p-0.5 text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50"
                                >
                                    <RotateCcw size={13} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
