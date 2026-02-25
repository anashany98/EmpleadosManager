import { motion } from 'framer-motion';
import { 
    Users, 
    UserPlus, 
    UserMinus, 
    TrendingUp, 
    Clock, 
    Briefcase,
    RefreshCw,
    Calendar,
    Filter
} from 'lucide-react';
import { useState } from 'react';
import {
    KPICard,
    TrendChart,
    DepartmentBreakdown,
    HeatmapCalendar,
    HiringFunnelWidget,
    TenureDistribution
} from '../components/dashboard/analytics';
import { 
    useAnalyticsSummary, 
    useKPIs, 
    useTrends,
    useDepartmentBreakdown,
    useActivityHeatmap,
    useHiringFunnel,
    useTenureDistribution
} from '../hooks/useAnalytics';

type TimePeriod = 'month' | 'quarter' | 'year';

export default function AnalyticsDashboard() {
    const [period, setPeriod] = useState<TimePeriod>('year');
    
    // Queries
    const { data: summary, isLoading: summaryLoading, refetch } = useAnalyticsSummary();
    const { data: kpis } = useKPIs();
    const { data: trends } = useTrends(period);
    const { data: departments } = useDepartmentBreakdown();
    const { data: heatmap } = useActivityHeatmap();
    const { data: hiringFunnel } = useHiringFunnel();
    const { data: tenure } = useTenureDistribution();

    const isLoading = summaryLoading;

    // KPI cards data
    const kpiCards = kpis ? [
        {
            title: 'Total Empleados',
            value: kpis.totalEmployees,
            change: 2.5,
            changeType: 'positive' as const,
            icon: Users,
            color: 'blue' as const,
        },
        {
            title: 'Nuevas Contrataciones',
            value: kpis.newHires,
            change: 15,
            changeType: 'positive' as const,
            icon: UserPlus,
            color: 'emerald' as const,
        },
        {
            title: 'Bajas',
            value: kpis.departures,
            change: -8,
            changeType: 'negative' as const,
            icon: UserMinus,
            color: 'red' as const,
        },
        {
            title: 'Tasa de Rotación',
            value: `${kpis.turnoverRate}%`,
            change: -2.1,
            changeType: 'positive' as const,
            icon: TrendingUp,
            color: 'purple' as const,
        },
        {
            title: 'Antigüedad Promedio',
            value: `${kpis.avgTenure.toFixed(1)} años`,
            change: 0.3,
            changeType: 'positive' as const,
            icon: Clock,
            color: 'amber' as const,
        },
        {
            title: 'Vacantes Abiertas',
            value: kpis.openPositions,
            change: 0,
            changeType: 'neutral' as const,
            icon: Briefcase,
            color: 'cyan' as const,
        },
    ] : [];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                            Dashboard Analítico
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Métricas y tendencias de recursos humanos
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Period selector */}
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-800">
                            {(['month', 'quarter', 'year'] as TimePeriod[]).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        period === p
                                            ? 'bg-blue-500 text-white shadow-sm'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {p === 'month' ? 'Mes' : p === 'quarter' ? 'Trimestre' : 'Año'}
                                </button>
                            ))}
                        </div>

                        {/* Refresh button */}
                        <button
                            onClick={() => refetch()}
                            className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Actualizar datos"
                        >
                            <RefreshCw size={20} />
                        </button>
                    </div>
                </div>
            </motion.div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
                    >
                        {kpiCards.map((kpi, index) => (
                            <motion.div
                                key={kpi.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + index * 0.05 }}
                            >
                                <KPICard {...kpi} />
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Charts Row 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <TrendChart
                                data={trends || []}
                                title="Tendencia de Plantilla"
                                dataKey="count"
                                color="#10b981"
                            />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                        >
                            <TrendChart
                                data={trends || []}
                                title="Nuevas Contrataciones"
                                dataKey="newHires"
                                color="#3b82f6"
                            />
                        </motion.div>
                    </div>

                    {/* Charts Row 2 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="lg:col-span-2"
                        >
                            <DepartmentBreakdown data={departments || []} />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                        >
                            <HiringFunnelWidget 
                                data={{
                                    applicants: hiringFunnel?.applications || 0,
                                    interviews: hiringFunnel?.interviews || 0,
                                    offers: hiringFunnel?.offers || 0,
                                    hired: hiringFunnel?.hired || 0,
                                    conversionRate: hiringFunnel?.hired ? (hiringFunnel.hired / (hiringFunnel.applications || 1)) * 100 : 0,
                                    avgTimeToHire: 30
                                }} 
                            />
                        </motion.div>
                    </div>

                    {/* Charts Row 3 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            <TenureDistribution 
                                data={(tenure || []).map(t => {
                                    const total = (tenure || []).reduce((sum, item) => sum + item.count, 0);
                                    return {
                                        ...t,
                                        percentage: total > 0 ? Math.round((t.count / total) * 100) : 0
                                    };
                                })}
                                averageTenure={kpis?.avgTenure || 0}
                                medianTenure={kpis?.avgTenure || 0}
                            />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.45 }}
                        >
                            <HeatmapCalendar 
                                data={(heatmap || []).map(h => {
                                    const maxCount = Math.max(...(heatmap || []).map(x => x.count), 1);
                                    const level = h.count > 0 ? Math.min(5, Math.ceil((h.count / maxCount) * 5)) : 0;
                                    const date = new Date(new Date().getFullYear(), h.month, h.dayOfWeek + 1).toISOString().split('T')[0];
                                    return { date, count: h.count, level };
                                })}
                                title="Mapa de Ausencias"
                            />
                        </motion.div>
                    </div>

                    {/* Insights Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white"
                    >
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <TrendingUp size={20} />
                            Insights Automáticos
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/10 rounded-xl p-4">
                                <div className="text-sm opacity-80 mb-1">Retención</div>
                                <div className="text-xl font-bold">
                                    {kpis && kpis.turnoverRate < 10 
                                        ? '✓ Tasa saludable' 
                                        : '⚠ Requiere atención'}
                                </div>
                                <div className="text-xs opacity-70 mt-1">
                                    Tasa de rotación: {kpis?.turnoverRate || 0}%
                                </div>
                            </div>
                            <div className="bg-white/10 rounded-xl p-4">
                                <div className="text-sm opacity-80 mb-1">Crecimiento</div>
                                <div className="text-xl font-bold">
                                    {kpis && kpis.newHires > kpis.departures 
                                        ? '↑ Creciendo' 
                                        : '↓ Contrayéndose'}
                                </div>
                                <div className="text-xs opacity-70 mt-1">
                                    Neto: {(kpis?.newHires || 0) - (kpis?.departures || 0)} empleados
                                </div>
                            </div>
                            <div className="bg-white/10 rounded-xl p-4">
                                <div className="text-sm opacity-80 mb-1">Experiencia</div>
                                <div className="text-xl font-bold">
                                    {kpis && kpis.avgTenure > 3 
                                        ? '★ Equipo consolidado' 
                                        : '⚡ Equipo en desarrollo'}
                                </div>
                                <div className="text-xs opacity-70 mt-1">
                                    Antigüedad promedio: {kpis?.avgTenure?.toFixed(1) || 0} años
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}