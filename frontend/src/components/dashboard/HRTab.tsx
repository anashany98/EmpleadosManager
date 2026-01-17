import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { Users, AlertTriangle, TrendingUp, Briefcase, UserCheck, Clock } from 'lucide-react';

import { useState, useEffect } from 'react';
import { api } from '../../api/client';

interface HRTabProps {
    metrics: any;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function HRTab({ metrics }: HRTabProps) {
    const [turnover, setTurnover] = useState<any>(null);
    const [absenteeism, setAbsenteeism] = useState<any>(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const [turnoverRes, abscessRes] = await Promise.all([
                    api.get('/dashboard/analytics/turnover'),
                    api.get('/dashboard/analytics/absenteeism')
                ]);
                setTurnover(turnoverRes.data);
                setAbsenteeism(abscessRes.data);
            } catch (error) {
                console.error('Failed to load HR analytics', error);
            }
        };
        fetchAnalytics();
    }, []);

    if (!metrics) return null;

    const { headcount, contracts, growthTrend } = metrics;

    const departmentData = headcount?.byDepartment
        ? Object.entries(headcount.byDepartment).map(([name, value]) => ({ name, value: value as number }))
        : [];

    const contractData = headcount?.byContractType
        ? Object.entries(headcount.byContractType).map(([name, value]) => ({ name, value: value as number }))
        : [];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Employees */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Empleados</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                                {headcount?.total || 0}
                            </h3>
                            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                {headcount?.active || 0} activos
                            </p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                            <Users className="text-blue-600 dark:text-blue-400" size={24} />
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
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Rotación</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                                {turnover?.rate || 0}%
                            </h3>
                            <p className={`text-sm mt-1 ${turnover?.rate > 15 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {turnover?.rate > 15 ? 'Alta' : 'Estable'}
                            </p>
                        </div>
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                            <TrendingUp className="text-indigo-600 dark:text-indigo-400" size={24} />
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
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Absentismo</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                                {absenteeism?.rate || 0}%
                            </h3>
                            <p className={`text-sm mt-1 ${absenteeism?.rate > 5 ? 'text-orange-500' : 'text-blue-500'}`}>
                                {absenteeism?.totalAbsenceDays || 0} días
                            </p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                            <Clock className="text-blue-600 dark:text-blue-400" size={24} />
                        </div>
                    </div>
                </motion.div>

                {/* Contracts Expiring */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Contratos por Vencer</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                                {contracts?.expiring30 || 0}
                            </h3>
                            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                                Próximos 30 días
                            </p>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                            <AlertTriangle className="text-amber-600 dark:text-amber-400" size={24} />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Headcount Growth */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-600" />
                        Evolución de Plantilla
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={growthTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="month" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Department Distribution */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Briefcase size={20} className="text-blue-600" />
                        Distribución por Departamento
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={departmentData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {departmentData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Contract Types Bar Chart */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <UserCheck size={20} className="text-blue-600" />
                    Tipos de Contrato
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={contractData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                        <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Details Alerts */}
            {contracts && (contracts.expiring30 > 0 || contracts.expiring60 > 0 || contracts.trialPeriodEnding > 0) && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-4 flex items-center gap-2">
                        <Clock size={20} />
                        Alertas de Contratos
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {contracts.expiring30 > 0 && (
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400">30 días</p>
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{contracts.expiring30}</p>
                                <p className="text-xs text-slate-500 mt-1">contratos venciendo</p>
                            </div>
                        )}
                        {contracts.expiring60 > 0 && (
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400">60 días</p>
                                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{contracts.expiring60}</p>
                                <p className="text-xs text-slate-500 mt-1">contratos venciendo</p>
                            </div>
                        )}
                        {contracts.trialPeriodEnding > 0 && (
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400">Período de prueba</p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{contracts.trialPeriodEnding}</p>
                                <p className="text-xs text-slate-500 mt-1">finalizando pronto</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
