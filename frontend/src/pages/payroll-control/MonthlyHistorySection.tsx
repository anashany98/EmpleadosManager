import { Download, History, Loader2 } from 'lucide-react';
import { MONTHS, PERIOD_STATUS_LABELS } from './types';
import type { MonthlyHistoryItem, PayrollExportHistoryItem } from './types';

interface MonthlyHistorySectionProps {
    loadingHistory: boolean;
    history: MonthlyHistoryItem[];
    year: number;
    month: number;
    onOpenHistoryPeriod: (historyPeriod: MonthlyHistoryItem) => void;
    period: any;
    loadingExports: boolean;
    exportHistory: PayrollExportHistoryItem[];
    onDownloadExport: (item: PayrollExportHistoryItem) => void;
}

export default function MonthlyHistorySection({
    loadingHistory, history, year, month, onOpenHistoryPeriod,
    period, loadingExports, exportHistory, onDownloadExport
}: MonthlyHistorySectionProps) {
    return (
        <>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-labelledby="monthly-history-title">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-slate-900 p-2 text-white dark:bg-slate-100 dark:text-slate-900">
                            <History size={18} />
                        </div>
                        <div>
                            <h2 id="monthly-history-title" className="font-bold text-slate-900 dark:text-white">Historial mensual</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Abre cualquier cierre anterior en esta misma hoja.</p>
                        </div>
                    </div>
                    {loadingHistory && <Loader2 size={18} className="animate-spin text-blue-600" aria-label="Cargando historial" />}
                </div>

                <div className="overflow-x-auto">
                    {!loadingHistory && history.length === 0 && (
                        <div className="m-4 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700">
                            Los periodos aparecerán aquí cuando abras o prepares un mes.
                        </div>
                    )}
                    {history.length > 0 && (
                        <table className="w-full min-w-[780px] text-sm">
                            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800/70">
                                <tr>
                                    <th className="px-5 py-2.5">Periodo</th>
                                    <th className="px-3 py-2.5">Estado</th>
                                    <th className="px-3 py-2.5 text-right">Empleados</th>
                                    <th className="px-3 py-2.5 text-right">H. extra (€)</th>
                                    <th className="px-3 py-2.5 text-right">Dietas</th>
                                    <th className="px-3 py-2.5 text-right">Bruto</th>
                                    <th className="px-3 py-2.5 text-right">Exportaciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {history.map((historyPeriod) => {
                                    const selected = historyPeriod.year === year && historyPeriod.month === month;
                                    const completed = historyPeriod.completedEmployeeCount ?? historyPeriod.employeeCount;
                                    return (
                                        <tr
                                            key={historyPeriod.id}
                                            role="button"
                                            aria-label={`Abrir ${MONTHS[historyPeriod.month - 1]} ${historyPeriod.year}`}
                                            onClick={() => onOpenHistoryPeriod(historyPeriod)}
                                            tabIndex={0}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') onOpenHistoryPeriod(historyPeriod);
                                            }}
                                            className={`cursor-pointer outline-none transition hover:bg-blue-50 focus:bg-blue-50 dark:hover:bg-blue-950/20 ${selected ? 'bg-blue-50/80 dark:bg-blue-950/30' : ''}`}
                                            aria-current={selected ? 'true' : undefined}
                                        >
                                            <td className="px-5 py-3 font-bold capitalize text-slate-950 dark:text-white">{MONTHS[historyPeriod.month - 1]} {historyPeriod.year}</td>
                                            <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-700 dark:bg-slate-700 dark:text-slate-200">{PERIOD_STATUS_LABELS[historyPeriod.status] || historyPeriod.status}</span></td>
                                            <td className="px-3 py-3 text-right font-mono">
                                                {completed}/{historyPeriod.employeeCount}
                                                <span className="sr-only">{historyPeriod.employeeCount} empleados</span>
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono">{Number(historyPeriod.totalOvertimeAmount || 0).toFixed(2)} €</td>
                                            <td className="px-3 py-3 text-right font-mono">{Number(historyPeriod.totalDiets || 0).toFixed(2)} €</td>
                                            <td className="px-3 py-3 text-right font-mono font-bold">{Number(historyPeriod.totalGross || 0).toFixed(2)} €</td>
                                            <td className="px-3 py-3 text-right font-mono">{historyPeriod.exportCount}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>

            {period && (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-labelledby="export-history-title">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
                        <div>
                            <h2 id="export-history-title" className="font-bold text-slate-900 dark:text-white">Historial de gestoría</h2>
                            <p className="text-xs text-slate-500">Cada archivo generado queda guardado como una versión inmutable y descargable.</p>
                        </div>
                        {loadingExports && <Loader2 size={16} className="animate-spin text-emerald-600" />}
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {!loadingExports && exportHistory.length === 0 && (
                            <p className="px-5 py-4 text-sm text-slate-500">Este período todavía no tiene exportaciones.</p>
                        )}
                        {exportHistory.map((item, index) => (
                            <div key={item.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                        Versión {exportHistory.length - index} · {item.filename}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {new Date(item.createdAt).toLocaleString('es-ES')} · {item.createdBy.email}
                                    </p>
                                    <p className="mt-1 truncate font-mono text-[10px] text-slate-400" title={item.outputHash}>
                                        SHA-256 salida: {item.outputHash}
                                    </p>
                                </div>
                                <button type="button" onClick={() => onDownloadExport(item)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30">
                                    <Download size={14} />
                                    Descargar versión
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </>
    );
}
