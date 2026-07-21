import { Filter } from 'lucide-react';
import type { ReportType, SummaryCardData } from './reportTypes';
import { getToneClasses } from './reportTypes';
import { formatCurrency, formatNumber, formatPercent, formatDate } from './reportHelpers';

export function FilterSelect({
    icon: Icon,
    value,
    onChange,
    options
}: {
    icon: typeof Filter;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
}) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <Icon size={16} className="text-slate-400" />
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="bg-transparent text-sm font-medium outline-none text-slate-700 dark:text-slate-200"
            >
                {options.map((option) => (
                    <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>
                ))}
            </select>
        </div>
    );
}

export function SummaryCard({ data }: { data: SummaryCardData }) {
  const toneClasses = getToneClasses(data.tone);
  return (
    <div className={`rounded-2xl sm:rounded-3xl border bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm ${toneClasses.border}`}>
      <div className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] ${toneClasses.soft} ${toneClasses.text}`}>
        {data.label}
      </div>
      <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3 sm:mt-4 tracking-tight">{data.value}</div>
      <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1.5 sm:mt-2 leading-4 sm:leading-5">{data.helper}</p>
    </div>
  );
}

export function ReportTableHead({ activeTab }: { activeTab: ReportType }) {
    if (activeTab === 'ATTENDANCE') {
        return (
            <tr>
                <th className="px-6 py-4 font-bold">Empleado</th>
                <th className="px-6 py-4 font-bold">Depto.</th>
                <th className="px-6 py-4 font-bold text-center">Fecha</th>
                <th className="px-6 py-4 font-bold text-center">Primer fichaje</th>
                <th className="px-6 py-4 font-bold text-center">Último fichaje</th>
                <th className="px-6 py-4 font-bold text-right">Horas</th>
                <th className="px-6 py-4 font-bold text-center">Estado</th>
                <th className="px-6 py-4 font-bold">Segmentos</th>
            </tr>
        );
    }

    if (activeTab === 'OVERTIME') {
        return (
            <tr>
                <th className="px-6 py-4 font-bold">Empleado</th>
                <th className="px-6 py-4 font-bold">Depto.</th>
                <th className="px-6 py-4 font-bold text-center">Fecha</th>
                <th className="px-6 py-4 font-bold text-center">Tipo</th>
                <th className="px-6 py-4 font-bold text-right">Horas</th>
                <th className="px-6 py-4 font-bold text-right">Tarifa</th>
                <th className="px-6 py-4 font-bold text-right">Coste</th>
            </tr>
        );
    }

    if (activeTab === 'VACATIONS') {
        return (
            <tr>
                <th className="px-6 py-4 font-bold">Empleado</th>
                <th className="px-6 py-4 font-bold">Departamento</th>
                <th className="px-6 py-4 font-bold text-right">Anuales</th>
                <th className="px-6 py-4 font-bold text-right">Arrastre</th>
                <th className="px-6 py-4 font-bold text-right">Consumido</th>
                <th className="px-6 py-4 font-bold text-right">Pend.</th>
                <th className="px-6 py-4 font-bold text-right">Saldo</th>
                <th className="px-6 py-4 font-bold text-right">Saldo proj.</th>
                <th className="px-6 py-4 font-bold text-right">Uso %</th>
                <th className="px-6 py-4 font-bold text-center">Solicitudes</th>
            </tr>
        );
    }

    if (activeTab === 'COSTS') {
        return (
            <tr>
                <th className="px-6 py-4 font-bold">Empleado</th>
                <th className="px-6 py-4 font-bold">Departamento</th>
                <th className="px-6 py-4 font-bold text-right">Bruto</th>
                <th className="px-6 py-4 font-bold text-right">SS Empresa</th>
                <th className="px-6 py-4 font-bold text-right">IRPF</th>
                <th className="px-6 py-4 font-bold text-right">Neto</th>
                <th className="px-6 py-4 font-bold text-right">Coste total</th>
            </tr>
        );
    }

    if (activeTab === 'ABSENCES_DETAILED') {
        return (
            <tr>
                <th className="px-6 py-4 font-bold">Empleado</th>
                <th className="px-6 py-4 font-bold">Depto.</th>
                <th className="px-6 py-4 font-bold text-center">Inicio</th>
                <th className="px-6 py-4 font-bold text-center">Fin</th>
                <th className="px-6 py-4 font-bold text-right">Días</th>
                <th className="px-6 py-4 font-bold text-center">Tipo</th>
                <th className="px-6 py-4 font-bold">Motivo</th>
            </tr>
        );
    }

    if (activeTab === 'KPIS') {
        return (
            <tr>
                <th className="px-6 py-4 font-bold">Departamento</th>
                <th className="px-6 py-4 font-bold text-center">Empleados</th>
                <th className="px-6 py-4 font-bold text-right">Días ausencia</th>
                <th className="px-6 py-4 font-bold text-right">Días potenciales</th>
                <th className="px-6 py-4 font-bold text-right">Tasa</th>
            </tr>
        );
    }

    if (activeTab === 'OBRA_SUMMARY') {
        return (
            <tr>
                <th className="px-6 py-4 font-bold">Código</th>
                <th className="px-6 py-4 font-bold">Obra</th>
                <th className="px-6 py-4 font-bold">Cliente</th>
                <th className="px-6 py-4 font-bold text-center">Estado</th>
                <th className="px-6 py-4 font-bold text-right">Dietas</th>
                <th className="px-6 py-4 font-bold text-right">Hospedaje</th>
                <th className="px-6 py-4 font-bold text-right">Vuelo</th>
                <th className="px-6 py-4 font-bold text-right">Transp.</th>
                <th className="px-6 py-4 font-bold text-right">Otros</th>
                <th className="px-6 py-4 font-bold text-right">Horas</th>
                <th className="px-6 py-4 font-bold text-right">Presupuesto</th>
                <th className="px-6 py-4 font-bold text-right">% usado</th>
            </tr>
        );
    }

    if (activeTab === 'OBRA_EMPLOYEES') {
        return (
            <tr>
                <th className="px-6 py-4 font-bold">Empleado</th>
                <th className="px-6 py-4 font-bold">Obra</th>
                <th className="px-6 py-4 font-bold text-right">Horas</th>
                <th className="px-6 py-4 font-bold text-right">Dietas</th>
                <th className="px-6 py-4 font-bold text-right">Hospedaje</th>
                <th className="px-6 py-4 font-bold text-right">Vuelo</th>
                <th className="px-6 py-4 font-bold text-right">Transp.</th>
                <th className="px-6 py-4 font-bold text-right">Otros</th>
                <th className="px-6 py-4 font-bold text-right">Total</th>
            </tr>
        );
    }

    return (
        <tr>
            <th className="px-6 py-4 font-bold">Departamento</th>
            <th className="px-6 py-4 font-bold text-center">Hombres</th>
            <th className="px-6 py-4 font-bold text-center">Mujeres</th>
            <th className="px-6 py-4 font-bold text-right">Media H</th>
            <th className="px-6 py-4 font-bold text-right">Media M</th>
            <th className="px-6 py-4 font-bold text-right">Gap</th>
        </tr>
    );
}

export function ReportTableBody({ activeTab, rows }: { activeTab: ReportType; rows: any[] }) {
    return (
        <>
            {rows.map((row, index) => (
                <tr key={`${activeTab}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors align-top">
                    {activeTab === 'ATTENDANCE' ? (
                        <>
                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{row.employee}</td>
                            <td className="px-6 py-4 text-slate-500">{row.department}</td>
                            <td className="px-6 py-4 text-center text-slate-500">{formatDate(row.date)}</td>
                            <td className="px-6 py-4 text-center font-mono text-emerald-600">{row.firstSegment}</td>
                            <td className="px-6 py-4 text-center font-mono text-rose-600">{row.lastSegment}</td>
                            <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">{formatNumber(row.totalHours, ' h')}</td>
                            <td className="px-6 py-4 text-center">
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${row.status === 'COMPLETE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'}`}>
                                    {row.status === 'COMPLETE' ? 'Completa' : 'Incompleta'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-xs leading-6 text-slate-500 max-w-[440px]">{row.segmentsText}</td>
                        </>
                    ) : null}

                    {activeTab === 'OVERTIME' ? (
                        <>
                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{row.employee}</td>
                            <td className="px-6 py-4 text-slate-500">{row.department}</td>
                            <td className="px-6 py-4 text-center">{formatDate(row.date)}</td>
                            <td className="px-6 py-4 text-center"><span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase">{row.type}</span></td>
                            <td className="px-6 py-4 text-right font-semibold">{formatNumber(row.hours, ' h')}</td>
                            <td className="px-6 py-4 text-right">{formatCurrency(row.rate)}</td>
                            <td className="px-6 py-4 text-right font-black text-emerald-600 dark:text-emerald-300">{formatCurrency(row.totalCost)}</td>
                        </>
                    ) : null}

                    {activeTab === 'VACATIONS' ? (
                        <>
                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{row.employee}</td>
                            <td className="px-6 py-4 text-slate-500">{row.department}</td>
                            <td className="px-6 py-4 text-right font-semibold">{formatNumber(row.annualQuotaDays)}</td>
                            <td className="px-6 py-4 text-right text-amber-600 font-semibold">{formatNumber(row.carriedOverDays)}</td>
                            <td className="px-6 py-4 text-right text-rose-500 font-semibold">{formatNumber(row.usedDays)}</td>
                            <td className="px-6 py-4 text-right text-amber-500 font-semibold">{formatNumber(row.pendingDays)}</td>
                            <td className="px-6 py-4 text-right text-emerald-600 font-semibold">{formatNumber(row.remainingDays)}</td>
                            <td className="px-6 py-4 text-right text-emerald-700 font-black">{formatNumber(row.projectedRemainingDays)}</td>
                            <td className="px-6 py-4 text-right">{formatPercent(row.usageRate)}</td>
                            <td className="px-6 py-4 text-center">{row.requests}</td>
                        </>
                    ) : null}

                    {activeTab === 'COSTS' ? (
                        <>
                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{row.employee}</td>
                            <td className="px-6 py-4 text-slate-500">{row.department}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.bruto)}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.ssEmpresa)}</td>
                            <td className="px-6 py-4 text-right font-mono text-amber-600">{formatCurrency(row.irpf)}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.neto)}</td>
                            <td className="px-6 py-4 text-right font-black text-violet-600 dark:text-violet-300">{formatCurrency(row.totalCost)}</td>
                        </>
                    ) : null}

                    {activeTab === 'ABSENCES_DETAILED' ? (
                        <>
                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{row.employee}</td>
                            <td className="px-6 py-4 text-slate-500">{row.department}</td>
                            <td className="px-6 py-4 text-center">{formatDate(row.startDate)}</td>
                            <td className="px-6 py-4 text-center">{formatDate(row.endDate)}</td>
                            <td className="px-6 py-4 text-right font-bold text-rose-500">{formatNumber(row.days)}</td>
                            <td className="px-6 py-4 text-center"><span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase">{row.type}</span></td>
                            <td className="px-6 py-4 text-slate-500 max-w-[360px]">{row.reason}</td>
                        </>
                    ) : null}

                    {activeTab === 'KPIS' ? (
                        <>
                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{row.department}</td>
                            <td className="px-6 py-4 text-center">{row.employees}</td>
                            <td className="px-6 py-4 text-right text-rose-500 font-semibold">{formatNumber(row.absenceDays)}</td>
                            <td className="px-6 py-4 text-right text-slate-500">{formatNumber(row.potentialDays)}</td>
                            <td className="px-6 py-4 text-right font-black text-indigo-600 dark:text-indigo-300">{formatPercent(row.rate)}</td>
                        </>
                    ) : null}

                    {activeTab === 'GENDER_GAP' ? (
                        <>
                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white uppercase tracking-tight text-xs">{row.department}</td>
                            <td className="px-6 py-4 text-center">{row.maleCount}</td>
                            <td className="px-6 py-4 text-center">{row.femaleCount}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.maleAvg)}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.femaleAvg)}</td>
                            <td className={`px-6 py-4 text-right font-black ${row.gap > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{formatPercent(row.gap)}</td>
                        </>
                    ) : null}

                    {activeTab === 'OBRA_SUMMARY' ? (
                        <>
                            <td className="px-6 py-4 font-mono text-xs text-blue-600 dark:text-blue-300">{row.code}</td>
                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{row.name}</td>
                            <td className="px-6 py-4 text-slate-500">{row.clientName}</td>
                            <td className="px-6 py-4 text-center">
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${row.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                                    {row.status === 'ACTIVE' ? 'Activa' : 'Cerrada'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.perDiem)}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.lodging)}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.flight)}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.transport)}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.other)}</td>
                            <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-300">{formatNumber(row.hours, ' h')}</td>
                            <td className="px-6 py-4 text-right font-mono text-violet-600 dark:text-violet-300">{row.budget > 0 ? formatCurrency(row.budget) : '—'}</td>
                            <td className={`px-6 py-4 text-right font-black ${row.budget > 0 && row.pct >= 1 ? 'text-rose-500' : row.budget > 0 && row.pct >= 0.8 ? 'text-amber-500' : 'text-slate-500'}`}>
                                {row.budget > 0 ? formatPercent(row.pct * 100) : '—'}
                            </td>
                        </>
                    ) : null}

                    {activeTab === 'OBRA_EMPLOYEES' ? (
                        <>
                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{row.employee}</td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-sm">
                                <span className="font-mono text-xs text-blue-600 dark:text-blue-300 mr-2">{row.obraCode}</span>
                                {row.obra}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-300">{formatNumber(row.hours, ' h')}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.perDiem)}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.lodging)}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.flight)}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.transport)}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.other)}</td>
                            <td className="px-6 py-4 text-right font-black text-violet-600 dark:text-violet-300">{formatCurrency(row.total)}</td>
                        </>
                    ) : null}
                </tr>
            ))}
        </>
    );
}
