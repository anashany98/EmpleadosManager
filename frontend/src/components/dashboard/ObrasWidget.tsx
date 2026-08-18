import { useEffect, useState } from 'react';
import { Briefcase, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { api, getErrorMessage } from '../../api/client';
import { useApiUnwrap } from '../../hooks/useApiUnwrap';
import { Link } from 'react-router';
import { formatCurrency } from '../../features/reports/reportHelpers';

interface ObrasSummary {
    total: number;
    active: number;
    inactive: number;
    totalBudget: number;
    totalSpent: number;
    overBudget: number;
    recent: Array<{ id: string; code: string; name: string; clientName: string | null; budget: number; spent: number; pct: number }>;
}

interface ObrasReportRow {
    id: string;
    code: string;
    name: string;
    status: string;
    clientName?: string | null;
    budget?: number;
    consumed?: number;
}

interface ObrasReportData {
    obras?: ObrasReportRow[];
    budgets?: { budget?: number; consumed?: number };
}

export function ObrasWidget() {
    const unwrap = useApiUnwrap();
    const [data, setData] = useState<ObrasSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                // El endpoint /reports/obras devuelve obras + budgets + consumed.
                // Para el dashboard solo queremos el resumen, no las 1000+ obras.
                const res = await api.get('/reports/obras', { params: { limit: 5 } });
                const raw = unwrap<ObrasReportData>(res);
                const obras = Array.isArray(raw?.obras) ? raw.obras : [];
                const summary: ObrasSummary = {
                    total: raw?.obras?.length ?? 0,
                    active: obras.filter((o) => o.status === 'ACTIVE').length,
                    inactive: obras.filter((o) => o.status === 'INACTIVE').length,
                    totalBudget: Number(raw?.budgets?.budget || 0),
                    totalSpent: Number(raw?.budgets?.consumed || 0),
                    overBudget: obras.filter((o) => Number(o.budget || 0) > 0 && Number(o.consumed || 0) > Number(o.budget || 0)).length,
                    recent: obras.slice(0, 5).map((o) => ({
                        id: o.id,
                        code: o.code,
                        name: o.name,
                        clientName: o.clientName || null,
                        budget: Number(o.budget || 0),
                        spent: Number(o.consumed || 0),
                        pct: Number(o.budget || 0) > 0 ? Number(o.consumed || 0) / Number(o.budget || 0) : 0
                    }))
                };
                setData(summary);
            } catch (err) {
                console.error(getErrorMessage(err, 'Error al cargar resumen de obras'));
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [unwrap]);

    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-4" />
                <div className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded" />
            </div>
        );
    }

    if (!data) return null;

    const overBudgetPct = data.totalBudget > 0 ? (data.totalSpent / data.totalBudget) * 100 : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Briefcase className="text-blue-600" size={20} />
                    <h3 className="font-bold text-slate-900 dark:text-white">Obras</h3>
                </div>
                <Link to="/obras" className="text-xs text-blue-600 hover:underline">Ver todas →</Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Activas</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{data.active}</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Cerradas</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{data.inactive}</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Presupuesto</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(data.totalBudget)}</p>
                </div>
                <div className={`rounded-lg p-3 ${data.overBudget > 0 ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                    <p className={`text-[10px] font-bold uppercase ${data.overBudget > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Consumido</p>
                    <p className={`text-xl font-black ${data.overBudget > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {formatCurrency(data.totalSpent)} ({overBudgetPct.toFixed(0)}%)
                    </p>
                </div>
            </div>

            {data.overBudget > 0 && (
                <div className="mb-3 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                    <AlertTriangle size={14} />
                    {data.overBudget} obra(s) exceden su presupuesto
                </div>
            )}

            <div className="space-y-1.5">
                {data.recent.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">Sin obras registradas</p>
                ) : (
                    data.recent.map((o) => (
                        <Link
                            key={o.id}
                            to={`/obras/${o.id}`}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] text-blue-600 dark:text-blue-300">{o.code}</span>
                                    <span className="text-xs font-medium text-slate-900 dark:text-white truncate">{o.name}</span>
                                </div>
                                {o.clientName && (
                                    <p className="text-[10px] text-slate-500 truncate">{o.clientName}</p>
                                )}
                            </div>
                            {o.budget > 0 ? (
                                <div className="text-right shrink-0">
                                    <p className={`text-[10px] font-bold ${o.pct >= 1 ? 'text-rose-600' : o.pct >= 0.8 ? 'text-amber-600' : 'text-slate-500'}`}>
                                        {(o.pct * 100).toFixed(0)}%
                                    </p>
                                    <p className="text-[9px] text-slate-400">{formatCurrency(o.spent)} / {formatCurrency(o.budget)}</p>
                                </div>
                            ) : (
                                <span className="text-[10px] text-slate-400">Sin presupuesto</span>
                            )}
                        </Link>
                    ))
                )}
            </div>
        </motion.div>
    );
}
