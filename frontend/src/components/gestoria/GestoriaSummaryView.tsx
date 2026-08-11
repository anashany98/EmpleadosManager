/**
 * GestoriaSummaryView — pestaña "Resumen" del módulo de gestoría.
 *
 * Muestra la tabla de BRUTO/IRPF/TGSS por empleado + totales por categoría,
 * generada por el endpoint `GET /api/gestoria/periods/:id/summary`.
 *
 * Es read-only (los importes se calculan en backend; el operador no los
 * edita a mano). Se actualiza al recargar el periodo o cambiar de mes.
 */
import { useEffect, useState, useMemo } from 'react';
import { Loader2, AlertCircle, Calculator, Check } from 'lucide-react';
import { gestoriaApi, type GestoriaSummary, type GestoriaSummaryRow } from '../../api/gestoria';
import { getErrorMessage } from '../../api/client';
import { EmptyState } from '../ui/EmptyState';
import { EditableTable, type Column } from '../ui/EditableTable';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface GestoriaSummaryViewProps {
    periodId: string;
    year: number;
    month: number;
}

export default function GestoriaSummaryView({ periodId, year, month }: GestoriaSummaryViewProps) {
    const [summary, setSummary] = useState<GestoriaSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        gestoriaApi.getSummary(periodId)
            .then((res) => { if (alive) setSummary(res.data); })
            .catch((e) => { if (alive) setError(getErrorMessage(e, 'Error al cargar el resumen')); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [periodId]);

    if (loading) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <Loader2 className="inline animate-spin mr-2" size={18} />
                Calculando resumen…
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
            </div>
        );
    }

    if (!summary || summary.rows.length === 0) {
        return <EmptyState title="Sin datos" description="No hay empleados con datos para resumir en este periodo." />;
    }

    const periodLabel = `${MONTHS[month - 1]} ${year}`;
    const missing = summary.detected.missing;

    // Columnas del grid de resumen (read-only)
    const columns: Column<GestoriaSummaryRow>[] = [
        { key: 'employeeName', header: 'Empleado',     type: 'readonly', width: 'minmax(220px, 2fr)' },
        { key: 'category',     header: 'Categoría',    type: 'readonly', width: '180px' },
        { key: 'horasExtra',   header: 'H.Ext. (h)',   type: 'readonly', width: '90px', align: 'right',
          render: (v) => <span className="font-mono tabular-nums">{Number(v).toFixed(2)}</span> },
        { key: 'horasFinde',   header: 'H.S/D (h)',    type: 'readonly', width: '90px', align: 'right',
          render: (v) => <span className="font-mono tabular-nums">{Number(v).toFixed(2)}</span> },
        { key: 'precioExtra',  header: '€/h Ext.',     type: 'readonly', width: '90px', align: 'right',
          render: (v) => <span className="font-mono tabular-nums">{(Number(v) || 0).toFixed(2)}</span> },
        { key: 'precioFinde',  header: '€/h S/D',      type: 'readonly', width: '90px', align: 'right',
          render: (v) => <span className="font-mono tabular-nums">{(Number(v) || 0).toFixed(2)}</span> },
        { key: 'totalHorasExtra', header: 'H.Ext. €',   type: 'readonly', width: '100px', align: 'right',
          render: (v) => <span className="font-mono tabular-nums">{(Number(v) || 0).toFixed(2)}</span> },
        { key: 'totalHorasFinde', header: 'H.S/D €',    type: 'readonly', width: '100px', align: 'right',
          render: (v) => <span className="font-mono tabular-nums">{(Number(v) || 0).toFixed(2)}</span> },
        { key: 'totalEuros',   header: 'Total €',      type: 'readonly', width: '110px', align: 'right',
          render: (v) => <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">{(Number(v) || 0).toFixed(2)}</span> },
        { key: 'irpf',         header: 'IRPF',         type: 'readonly', width: '70px', align: 'right',
          render: (v) => <span className="font-mono tabular-nums">{((Number(v) || 0) * 100).toFixed(2)}%</span> },
        { key: 'tgss',         header: 'TGSS',         type: 'readonly', width: '70px', align: 'right',
          render: (v) => <span className="font-mono tabular-nums">{((Number(v) || 0) * 100).toFixed(2)}%</span> },
        { key: 'porcentajeNeto', header: '% neto',     type: 'readonly', width: '80px', align: 'right',
          render: (v) => <span className="font-mono tabular-nums">{((Number(v) || 0) * 100).toFixed(2)}%</span> },
        { key: 'bruto',        header: 'BRUTO',        type: 'readonly', width: '110px', align: 'right',
          render: (v) => <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">{(Number(v) || 0).toFixed(2)}</span> },
        { key: 'diferencia',   header: 'DIFERENCIA',   type: 'readonly', width: '110px', align: 'right',
          render: (v) => <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400">{(Number(v) || 0).toFixed(2)}</span> },
    ];

    const totals: Partial<Record<string, number | string>> = {
        employeeName: 'TOTAL',
        horasExtra: summary.totals.horasExtra,
        horasFinde: summary.totals.horasFinde,
        totalHorasExtra: summary.rows.reduce((s, r) => s + r.totalHorasExtra, 0),
        totalHorasFinde: summary.rows.reduce((s, r) => s + r.totalHorasFinde, 0),
        totalEuros: summary.totals.totalEuros,
        bruto: summary.totals.bruto,
        diferencia: summary.totals.diferencia,
    };

    return (
        <div className="space-y-4">
            {/* Banner informativo: conceptos que faltan */}
            {missing.length > 0 && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div>
                        <strong>Cálculo parcial.</strong> Faltan conceptos para el resumen completo:
                        <ul className="mt-1 ml-4 list-disc text-xs">
                            {missing.map((m) => (<li key={m}>{m}</li>))}
                        </ul>
                        <div className="mt-1 text-xs opacity-80">
                            Los valores se computan como 0 para los campos no disponibles. Crea los conceptos con códigos
                            como <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">H.EXTRA</code>,{' '}
                            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">H.S/D</code>,{' '}
                            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">PRECIO</code>,{' '}
                            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">IRPF</code>,{' '}
                            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">TGSS</code> (o similar) en la pestaña "Conceptos".
                        </div>
                    </div>
                </div>
            )}

            {/* Resumen por categoría (cards pequeñas) */}
            {summary.byCategory.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {summary.byCategory.map((cat) => (
                        <div
                            key={cat.category}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{cat.category}</div>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {cat.totalEuros.toFixed(2)}€
                                </span>
                                <span className="text-xs text-slate-500">/ BRUTO {cat.bruto.toFixed(2)}€</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                {cat.employees} empleado{cat.employees !== 1 ? 's' : ''}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabla de resumen por empleado */}
            <EditableTable<GestoriaSummaryRow>
                rows={summary.rows}
                columns={columns}
                rowKey={(r) => r.rowId}
                totals={totals}
                groupBy={(r) => r.category || 'Sin categoría'}
                readOnly
                saveDelayMs={500}
                emptyMessage="Sin datos para resumir."
            />

            {/* Footer explicativo */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                    <Calculator size={14} className="text-indigo-500" />
                    Cómo se calcula
                </div>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li><strong>Total €</strong> = (H.Ext. × €/h Ext.) + (H.S/D × €/h S/D)</li>
                    <li><strong>% neto</strong> = 1 - IRPF - TGSS</li>
                    <li><strong>BRUTO</strong> = Total € / % neto (importe bruto que produce ese neto)</li>
                    <li><strong>DIFERENCIA</strong> = BRUTO - Total € (margen para la gestoría)</li>
                </ul>
                <div className="mt-2 text-slate-400">
                    Periodo: <strong>{periodLabel}</strong> · {summary.rows.length} empleados · {missing.length === 0
                        ? <span className="text-emerald-600">cálculo completo</span>
                        : <span className="text-amber-600">cálculo parcial ({missing.length} conceptos faltan)</span>}
                </div>
            </div>
        </div>
    );
}
