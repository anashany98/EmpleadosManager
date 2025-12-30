import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { DollarSign, TrendingUp, CreditCard } from 'lucide-react';
import { api } from '../../api/client';
import { motion } from 'framer-motion';

interface FinancialTabProps {
    selectedCompany: string;
    metrics: any;
}

export default function FinancialTab({ selectedCompany }: FinancialTabProps) {
    const [costs, setCosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCosts = async () => {
            setLoading(true);
            try {
                // Fetch cost analytics (now available from previous task)
                const res = await api.get('/dashboard/analytics/costs');
                setCosts(res.data || []);
            } catch (error) {
                console.error('Failed to load financial analytics', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCosts();
    }, [selectedCompany]);

    const totalCost = costs.reduce((acc, curr) => acc + Number(curr.value), 0);
    const topDept = costs.length > 0 ? costs.reduce((prev, current) => (prev.value > current.value) ? prev : current) : null;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Coste Total (YTD)</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                                {totalCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">Año {new Date().getFullYear()}</p>
                        </div>
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                            <DollarSign className="text-indigo-600 dark:text-indigo-400" size={24} />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Mayor Coste</p>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-2 truncate max-w-[150px]" title={topDept?.name}>
                                {topDept?.name || '-'}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {Number(topDept?.value || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                            <TrendingUp className="text-violet-600 dark:text-violet-400" size={24} />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nómina Media</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                                {/* Placeholder logic since we don't have total employees count here easily without passing props, 
                                   but for now let's leave it simple or calculate if possible. 
                                   Actually, let's just show 'Proyección' */}
                                --
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">Mensual</p>
                        </div>
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                            <CreditCard className="text-emerald-600 dark:text-emerald-400" size={24} />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Cost Distribution Chart */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <DollarSign size={20} className="text-indigo-600" />
                    Distribución de Costes por Departamento
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={costs} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                        <Tooltip
                            formatter={(value: any) => Number(value).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                        />
                        <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
