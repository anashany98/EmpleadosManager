import type { ReactNode } from 'react';
import {
    Building2, CheckCircle2, Download, FileSpreadsheet, Loader2,
    Lock, ShieldAlert, Unlock, AlertCircle
} from 'lucide-react';
import { MONTHS } from './types';
import type { GrandTotals, ReviewSummary } from './types';

interface PayrollControlHeaderProps {
    isGlobalAdmin: boolean;
    companies: Array<{ id: string; name: string }>;
    selectedCompanyId: string;
    loadingCompanies: boolean;
    onCompanyChange: (companyId: string) => void;
    savingState: 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR';
    month: number;
    year: number;
    onMonthChange: (month: number) => void;
    onYearChange: (year: number) => void;
    isClosed: boolean;
    period: any;
    onStatusChange: (status: string) => void;
    exporting: boolean;
    onExportGestoria: () => void;
    recordsLength: number;
    reviewSummary: ReviewSummary;
    grandTotals: GrandTotals;
}

export default function PayrollControlHeader({
    isGlobalAdmin, companies, selectedCompanyId, loadingCompanies, onCompanyChange,
    savingState, month, year, onMonthChange, onYearChange,
    isClosed, period, onStatusChange, exporting, onExportGestoria,
    recordsLength, reviewSummary, grandTotals
}: PayrollControlHeaderProps) {
    const statusAction: { status: string; label: string; icon: ReactNode } | null =
        period?.status === 'DRAFT' || period?.status === 'REOPENED'
            ? { status: 'IN_REVIEW', label: 'Enviar a revisión', icon: <CheckCircle2 size={16} /> }
            : period?.status === 'IN_REVIEW'
                ? { status: 'CLOSED', label: 'Cerrar período', icon: <Lock size={16} /> }
                : null;

    return (
        <>
            {/* Header Principal */}
            <div className="sticky top-0 z-40 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 lg:flex-row lg:items-center">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                            <FileSpreadsheet size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Control General de RRHH</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Hoja de liquidación mensual y preparación para gestoría (según 2026 CONTROL).
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {isGlobalAdmin && (
                        <label className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800">
                            <Building2 size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">Empresa</span>
                            <select
                                aria-label="Empresa"
                                value={selectedCompanyId}
                                onChange={(event) => onCompanyChange(event.target.value)}
                                disabled={loadingCompanies || companies.length === 0}
                                className="min-w-44 bg-transparent text-sm font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {companies.length === 0 && (
                                    <option value="">{loadingCompanies ? 'Cargando empresas…' : 'Sin empresas disponibles'}</option>
                                )}
                                {companies.map((company) => (
                                    <option key={company.id} value={company.id}>{company.name}</option>
                                ))}
                            </select>
                        </label>
                    )}

                    {/* Indicador de Estado de Guardado */}
                    <div className="text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {savingState === 'SAVING' && (
                            <>
                                <Loader2 size={14} className="animate-spin text-blue-500" />
                                <span>Guardando...</span>
                            </>
                        )}
                        {savingState === 'SAVED' && (
                            <>
                                <CheckCircle2 size={14} className="text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">Guardado</span>
                            </>
                        )}
                        {savingState === 'ERROR' && (
                            <>
                                <AlertCircle size={14} className="text-rose-500" />
                                <span className="text-rose-600 dark:text-rose-400">Error al guardar</span>
                            </>
                        )}
                        {savingState === 'IDLE' && (
                            <span>Autoguardado activo</span>
                        )}
                    </div>

                    {/* Selector Año / Mes */}
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                        <select
                            value={month}
                            onChange={(e) => onMonthChange(Number(e.target.value))}
                            className="bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                            {MONTHS.map((m, idx) => (
                                <option key={idx + 1} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={(e) => onYearChange(Number(e.target.value))}
                            className="bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer border-l border-slate-200 dark:border-slate-700 pl-2"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Botón Estado Período */}
                    {isClosed ? (
                        <button
                            type="button"
                            onClick={() => onStatusChange('REOPENED')}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm rounded-xl transition-colors cursor-pointer"
                        >
                            <Unlock size={16} />
                            <span>Reabrir Período</span>
                        </button>
                    ) : statusAction ? (
                        <button
                            type="button"
                            onClick={() => onStatusChange(statusAction.status)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-xl transition-colors cursor-pointer"
                        >
                            {statusAction.icon}
                            <span>{statusAction.label}</span>
                        </button>
                    ) : null}

                    {/* Exportación Gestoría */}
                    <button
                        type="button"
                        onClick={onExportGestoria}
                        disabled={exporting || period?.status !== 'CLOSED'}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                        {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        <span>Exportar a Gestoría</span>
                    </button>
                </div>
            </div>

            {/* Banner de Estado del Período */}
            {isClosed && (
                <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 rounded-2xl text-sm font-medium">
                    <ShieldAlert size={20} className="shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="flex-1">
                        <span className="font-bold">Período CERRADO</span> — La edición de datos está bloqueada en esta pantalla y en la pestaña de perfil del empleado.
                    </div>
                </div>
            )}

            {/* Resumen de preparación del mes */}
            {period && (
                <section className="grid overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm sm:grid-cols-2 xl:grid-cols-5 dark:border-slate-700" aria-label="Resumen de preparación del mes">
                    {[
                        ['Empleados asignados', recordsLength, 'text-white'],
                        ['Con datos mensuales', reviewSummary.withValues, 'text-blue-300'],
                        ['Sin código gestoría', reviewSummary.missingCodes, reviewSummary.missingCodes ? 'text-rose-300' : 'text-emerald-300'],
                        ['Con sobrescrituras', reviewSummary.manualOverrides, reviewSummary.manualOverrides ? 'text-amber-300' : 'text-emerald-300'],
                        ['Bruto efectivo', `${grandTotals.gross.toFixed(2)} €`, 'text-emerald-300']
                    ].map(([label, value, tone]) => (
                        <div key={String(label)} className="border-b border-r border-slate-800 px-4 py-3 last:border-r-0 sm:border-b-0">
                            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</span>
                            <strong className={`mt-1 block font-mono text-lg ${tone}`}>{value}</strong>
                        </div>
                    ))}
                </section>
            )}
        </>
    );
}
