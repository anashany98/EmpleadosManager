import { useState, useEffect } from 'react';
import { Users, TrendingUp, DollarSign, Calendar, AlertTriangle, Briefcase, UserCheck, Clock } from 'lucide-react';
import { api } from '../api/client';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function EmployeeDashboard() {
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMetrics();
    }, []);

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const res = await api.get('/dashboard/v2/employees');
            setMetrics(res.data || res);
        } catch (error) {
            console.error('Error fetching employee metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!metrics) {
        return (
            <div className="text-center text-slate-500 dark:text-slate-400 mt-20">
                No se pudieron cargar las métricas
            </div>
        );
    }

    const { headcount, contracts, financial, attendance, growthTrend } = metrics || {};

    // Prepare department data for chart - with null check
    const departmentData = headcount?.byDepartment
        ? Object.entries(headcount.byDepartment).map(([name, value]) => ({
            name,
            value: value as number
        }))
        : [];

    // Prepare contract type data for chart - with null check
    const contractData = headcount?.byContractType
        ? Object.entries(headcount.byContractType).map(([name, value]) => ({
            name,
            value: value as number
        }))
        : [];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Dashboard de Empleados
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Métricas clave y análisis de recursos humanos
                </p>
            </div>

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

                {/* Payroll Cost */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Coste Salarial</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                                €{((financial?.totalBaseSalary || 0) / 1000).toFixed(0)}K
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                Media: €{Math.round(financial?.avgSalary || 0)}
                            </p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                            <DollarSign className="text-green-600 dark:text-green-400" size={24} />
                        </div>
                    </div>
                </motion.div>

                {/* Absence Rate */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tasa de Ausencia</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                                {attendance?.absenceRate || 0}%
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                {attendance?.onLeaveToday || 0} de baja hoy
                            </p>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                            <Calendar className="text-red-600 dark:text-red-400" size={24} />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Headcount Growth */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm"
                >
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-600" />
                        Evolución de Plantilla
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={growthTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="month" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1e293b',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                            />
                            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </motion.div>

                {/* Department Distribution */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm"
                >
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
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1e293b',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </motion.div>
            </div>

            {/* Contract Types Bar Chart */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm"
            >
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <UserCheck size={20} className="text-blue-600" />
                    Tipos de Contrato
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={contractData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1e293b',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#fff'
                            }}
                        />
                        <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </motion.div>

            {/* Contract Alerts */}
            {contracts && (contracts.expiring30 > 0 || contracts.expiring60 > 0 || contracts.trialPeriodEnding > 0) && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6"
                >
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
                </motion.div>
            )}
        </div>
    );
}
