import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { motion } from 'framer-motion';
import { DollarSign, Users, Activity, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function AnalyticsWidgets() {
    const { user } = useAuth();
    const [turnover, setTurnover] = useState<any>(null);
    const [absenteeism, setAbsenteeism] = useState<any>(null);
    const [costs, setCosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const [turnoverRes, abscessRes, costsRes] = await Promise.all([
                    api.get('/dashboard/analytics/turnover'),
                    api.get('/dashboard/analytics/absenteeism'),
                    api.get('/dashboard/analytics/costs')
                ]);

                if (turnoverRes.data) setTurnover(turnoverRes.data);
                if (abscessRes.data) setAbsenteeism(abscessRes.data);
                if (costsRes.data) setCosts(costsRes.data);
            } catch (error) {
                console.error('Failed to load analytics', error);
            } finally {
                setLoading(false);
            }
        };

        if (user?.role === 'admin' || user?.permissions?.reports === 'read') {
            fetchAnalytics();
        } else {
            setLoading(false);
        }
    }, [user]);

    if (!turnover && !absenteeism && costs.length === 0) return null;

    if (loading) return <div className="h-40 bg-slate-800/50 rounded-xl animate-pulse" />;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="text-blue-400" size={24} />
                Analíticas Avanzadas
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Turnover Rate */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users size={80} />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-slate-400 text-sm font-medium mb-1">Rotación de Personal (Anual)</h3>
                        <div className="flex items-end gap-3">
                            <span className="text-4xl font-bold text-white">{turnover?.rate}%</span>
                            <span className={`text-sm mb-1 font-medium ${turnover?.rate > 15 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {turnover?.rate > 15 ? 'Alta' : 'Estable'}
                            </span>
                        </div>
                        <p className="text-slate-500 text-xs mt-2">
                            {turnover?.leavers} salidas en los últimos 12 meses.
                            <br />Plantilla media: {turnover?.averageHeadcount}
                        </p>
                    </div>
                    {/* Progress Bar Visual */}
                    <div className="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(turnover?.rate || 0, 100)}%` }}
                            className={`h-full rounded-full ${turnover?.rate > 15 ? 'bg-red-500' : 'bg-emerald-500'}`}
                        />
                    </div>
                </motion.div>

                {/* Absenteeism Rate */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <AlertCircle size={80} />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-slate-400 text-sm font-medium mb-1">Absentismo (Mes Actual)</h3>
                        <div className="flex items-end gap-3">
                            <span className="text-4xl font-bold text-white">{absenteeism?.rate}%</span>
                            <span className={`text-sm mb-1 font-medium ${absenteeism?.rate > 5 ? 'text-orange-400' : 'text-blue-400'}`}>
                                {absenteeism?.totalAbsenceDays} días perdidos
                            </span>
                        </div>
                        <p className="text-slate-500 text-xs mt-2">
                            Calculado sobre {absenteeism?.workableDays} días laborables estimados.
                        </p>
                    </div>
                    <div className="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((absenteeism?.rate || 0) * 5, 100)}%` }} // Scale up for visibility
                            className={`h-full rounded-full ${absenteeism?.rate > 5 ? 'bg-orange-500' : 'bg-blue-500'}`}
                        />
                    </div>
                </motion.div>

                {/* Cost Distribution (Top Dept) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign size={80} />
                    </div>
                    <div className="relative z-10 w-full">
                        <h3 className="text-slate-400 text-sm font-medium mb-3">Coste por Departamento (YTD)</h3>

                        <div className="space-y-3">
                            {costs.slice(0, 3).map((dept: any, i: number) => (
                                <div key={i} className="w-full">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-white font-medium">{dept.name}</span>
                                        <span className="text-slate-400">{Number(dept.value).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(dept.value / (costs[0]?.value || 1)) * 100}%` }}
                                            className="h-full bg-indigo-500 rounded-full"
                                        />
                                    </div>
                                </div>
                            ))}
                            {costs.length === 0 && (
                                <p className="text-slate-500 text-xs italic">No hay datos de costes disponibles.</p>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
