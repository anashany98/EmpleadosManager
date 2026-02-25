import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';

interface DepartmentBreakdownProps {
    data: Array<{ department: string; count: number; percentage: number }>;
}

const COLORS = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ef4444', // red
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
    '#6366f1', // indigo
    '#14b8a6', // teal
];

export default function DepartmentBreakdown({ data }: DepartmentBreakdownProps) {
    if (!data || data.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6"
            >
                <div className="flex items-center gap-2 mb-4">
                    <Building2 size={20} className="text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Distribución por Departamento
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
            <div className="flex items-center gap-2 mb-4">
                <Building2 size={20} className="text-slate-400" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Distribución por Departamento
                </h3>
            </div>

            <div className="flex flex-col lg:flex-row items-center gap-6">
                <div className="w-full lg:w-1/2 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={2}
                                dataKey="count"
                                nameKey="department"
                            >
                                {data.map((_, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={COLORS[index % COLORS.length]}
                                        stroke="transparent"
                                    />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                }}
                                formatter={(value, name) => [
                                    `${value} empleados`,
                                    String(name)
                                ]}
                            />
                            <Legend 
                                layout="vertical"
                                align="right"
                                verticalAlign="middle"
                                iconType="circle"
                                iconSize={8}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="w-full lg:w-1/2 space-y-2">
                    {data.slice(0, 6).map((item, index) => (
                        <div 
                            key={item.department}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span className="text-sm text-slate-600 dark:text-slate-300">
                                    {item.department}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-slate-900 dark:text-white">
                                    {item.count}
                                </span>
                                <span className="text-xs text-slate-400 w-12 text-right">
                                    {item.percentage}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}