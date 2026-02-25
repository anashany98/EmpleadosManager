import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { Clock, TrendingUp, Award } from 'lucide-react';

interface TenureDistributionProps {
    data: Array<{ range: string; count: number; percentage: number }>;
    averageTenure: number;
    medianTenure: number;
}

const COLORS = [
    '#ef4444', // 0-1 año - rojo (más nuevos)
    '#f59e0b', // 1-2 años - ámbar
    '#eab308', // 2-3 años - amarillo
    '#84cc16', // 3-5 años - lima
    '#22c55e', // 5-10 años - verde
    '#10b981', // 10+ años - esmeralda (más antiguos)
];

export default function TenureDistribution({ data, averageTenure, medianTenure }: TenureDistributionProps) {
    if (!data || data.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6"
            >
                <div className="flex items-center gap-2 mb-4">
                    <Clock size={20} className="text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Distribución de Antigüedad
                    </h3>
                </div>
                <div className="h-64 flex items-center justify-center text-slate-400">
                    No hay datos disponibles
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Clock size={20} className="text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Distribución de Antigüedad
                    </h3>
                </div>
            </div>

            {/* Chart */}
            <div className="h-48 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ left: 60, right: 20 }}>
                        <CartesianGrid 
                            horizontal={true} 
                            vertical={false} 
                            stroke="#e2e8f0"
                            strokeDasharray="3 3"
                        />
                        <XAxis 
                            type="number" 
                            tick={{ fontSize: 12, fill: '#64748b' }}
                            axisLine={false}
                        />
                        <YAxis 
                            type="category" 
                            dataKey="range" 
                            tick={{ fontSize: 12, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip 
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(value, name) => [
                                name === 'count' ? `${value} empleados` : `${value}%`,
                                name === 'count' ? 'Cantidad' : 'Porcentaje'
                            ]}
                        />
                        <Bar 
                            dataKey="count" 
                            radius={[0, 4, 4, 0]}
                            label={{ position: 'right', fontSize: 10, fill: '#64748b' }}
                        >
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <TrendingUp size={18} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Promedio</div>
                        <div className="text-lg font-semibold text-slate-900 dark:text-white">
                            {averageTenure.toFixed(1)} años
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                        <Award size={18} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Mediana</div>
                        <div className="text-lg font-semibold text-slate-900 dark:text-white">
                            {medianTenure.toFixed(1)} años
                        </div>
                    </div>
                </div>
            </div>

            {/* Insights */}
            <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                    {averageTenure < 2 ? (
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-amber-500 rounded-full" />
                            Equipo relativamente nuevo. Considera programas de retención.
                        </span>
                    ) : averageTenure > 5 ? (
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                            Equipo consolidado. Buen momento para programas de desarrollo.
                        </span>
                    ) : (
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-blue-500 rounded-full" />
                            Balance saludable entre experiencia y nuevas incorporaciones.
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
}