import React, { useEffect, useState } from 'react';
import { Users, FileSpreadsheet, TrendingUp, ArrowRight, Activity, Clock, BarChart3, Sparkles, AlertTriangle, List } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { api } from '../api/client';

export default function Dashboard() {
    const [insights, setInsights] = useState<any[]>([]);
    const [absences, setAbsences] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [companies, setCompanies] = useState<any[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<string>('');
    const [activityTab, setActivityTab] = useState<'BATCHES' | 'AUDIT'>('BATCHES');

    useEffect(() => {
        fetchCompanies();
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [selectedCompany]);

    const fetchCompanies = async () => {
        try {
            const data = await api.get('/companies');
            setCompanies(data || []);
        } catch (err) { console.error(err); }
    };

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const query = selectedCompany ? `?companyId=${selectedCompany}` : '';
            const [insightsData, absencesData, logsData, metricsData] = await Promise.all([
                api.get(`/dashboard/insights${query}`).catch(() => []),
                api.get('/dashboard/absences').catch(() => []),
                api.get('/dashboard/audit').catch(() => []),
                api.get(`/dashboard/v2/employees${query}`).catch(() => null)
            ]);
            setInsights(insightsData || []);
            setAbsences(absencesData || []);
            setAuditLogs(logsData || []);
            setMetrics(metricsData);
        } catch (error) {
            console.error('Failed to load dashboard data', error);
        } finally {
            setLoading(false);
        }
    };

    const chartData = metrics?.growthTrend?.map((item: any) => ({
        name: item.month,
        value: item.count
    })) || [
            { name: 'Sin datos', value: 0 }
        ];

    // Mock recent batches (since we don't have a specific endpoint for this in this file yet, keeping the visual mock mixed with real audit)
    const recentBatches = [
        { id: 1, name: 'N_Noviembre_2024.xlsx', date: '22/12/2024', status: 'COMPLETADO', rows: 24, user: 'Admin' },
        { id: 2, name: 'N_Octubre_2024.xlsx', date: '25/11/2024', status: 'COMPLETADO', rows: 22, user: 'Admin' },
    ];

    const stats = [
        {
            title: 'Empleados Activos',
            value: metrics?.headcount?.active || '0',
            icon: <Users size={24} className="text-blue-500" />,
            trend: `Total: ${metrics?.headcount?.total || 0}`,
            trendUp: true
        },
        {
            title: 'Ausencias Hoy',
            value: metrics?.attendance?.onLeaveToday || '0',
            icon: <Clock size={24} className="text-emerald-500" />,
            trend: 'En curso',
            trendUp: true
        },
        {
            title: 'Alertas Pendientes',
            value: (metrics?.contracts?.dniExpiring || 0) + (metrics?.contracts?.licenseExpiring || 0),
            icon: <AlertTriangle size={24} className="text-amber-500" />,
            trend: 'Revisión req.',
            trendUp: false
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Visión general de tu actividad reciente.</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium shadow-sm"
                    >
                        <option value="">Todas las Empresas</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">v1.2.0</span>
                </div>
            </div>

            {/* AI Smart Alerts (Interactive Version) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {insights.map((insight, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`p-4 rounded-2xl border flex gap-4 ${insight.severity === 'warning'
                            ? 'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/20'
                            : insight.severity === 'info'
                                ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/20'
                                : 'bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800'
                            }`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${insight.severity === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                            {insight.severity === 'warning' ? <AlertTriangle size={20} /> : <Sparkles size={20} />}
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">{insight.title}</h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{insight.message}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Absence Overview by Department */}
            {absences.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm animate-in fade-in duration-500">
                    <div className="flex items-center gap-2 mb-6">
                        <Clock size={20} className="text-blue-500" />
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Ausencias por Departamento (Semana Actual)</h3>
                    </div>
                    <div className="flex flex-wrap gap-6">
                        {absences.map((dept, idx) => (
                            <div key={idx} className="flex flex-col">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{dept.name}</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="h-2 w-24 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{ width: `${Math.min(100, (dept.count / 10) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{dept.count}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 1. Stats Grid (Restored) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-lg transition-all hover:-translate-y-1">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl shadow-inner">
                                {stat.icon}
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${stat.trendUp ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                {stat.trend}
                            </span>
                        </div>
                        <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{stat.title}</h3>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* 2. Chart Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
                <div className="flex items-center gap-2 mb-6">
                    <BarChart3 size={20} className="text-blue-500" />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Evolución de Costes de Personal</h3>
                </div>
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 12 }}
                                className="dark:text-slate-400"
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 12 }}
                                tickFormatter={(value) => `${value / 1000}k`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgb(15 23 42)', border: 'none', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                cursor={{ stroke: '#3b82f6', strokeWidth: 2 }}
                                formatter={(value: any) => [`${Number(value || 0).toLocaleString()}€`, 'Coste Total']}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorValue)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3. Bottom Grid: Main Table + Sidebar */}
            < div className="grid grid-cols-1 lg:grid-cols-3 gap-8" >

                {/* Main Section with Tabs */}
                < div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col min-h-[400px]" >
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActivityTab('BATCHES')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2
                    ${activityTab === 'BATCHES'
                                        ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-300'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <FileSpreadsheet size={16} /> Últimas Nóminas
                            </button>
                            <button
                                onClick={() => setActivityTab('AUDIT')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2
                    ${activityTab === 'AUDIT'
                                        ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-300'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <List size={16} /> Auditoría (Live)
                            </button>
                        </div>

                        <Link to="/history" className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1">
                            Ver histórico <ArrowRight size={14} />
                        </Link>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        {/* CONTENT: TAB BATCHES */}
                        {activityTab === 'BATCHES' && (
                            <table className="w-full text-left text-sm animate-in fade-in duration-300">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Archivo</th>
                                        <th className="px-6 py-4 font-medium">Usuario</th>
                                        <th className="px-6 py-4 font-medium">Fecha</th>
                                        <th className="px-6 py-4 font-medium">Filas</th>
                                        <th className="px-6 py-4 font-medium text-right">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {recentBatches.map((batch) => (
                                        <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200 flex items-center gap-2">
                                                <FileSpreadsheet size={16} className="text-slate-400" />
                                                {batch.name}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{batch.user}</td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{batch.date}</td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{batch.rows}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border
                            ${batch.status === 'COMPLETADO'
                                                        ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-400'
                                                        : 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900/30 dark:text-amber-400'}`}>
                                                    {batch.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* CONTENT: TAB AUDIT */}
                        {activityTab === 'AUDIT' && (
                            <div className="p-6 space-y-6 animate-in fade-in duration-300">
                                {auditLogs.length === 0 ? (
                                    <div className="text-center text-slate-400 py-10">Sin actividad registrada aún.</div>
                                ) : (
                                    auditLogs.map((log, idx) => (
                                        <div key={idx} className="flex gap-4 group">
                                            <div className="flex flex-col items-center">
                                                <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-emerald-500 transition-colors"></div>
                                                {idx !== auditLogs.length - 1 && <div className="w-0.5 h-full bg-slate-100 dark:bg-slate-800 my-1"></div>}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{log.action}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{log.details}</p>
                                                <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div >

                {/* Sidebar: Quick Actions + AI Widget */}
                < div className="space-y-6" >
                    {/* Sidebar: AI Insights Widget (New Integration) */}
                    {
                        insights.length > 0 && (
                            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-lg p-5 text-white relative overflow-hidden">
                                <Sparkles className="absolute top-2 right-2 text-white/20" size={60} />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles size={16} className="text-amber-300" />
                                        <h4 className="font-bold text-sm uppercase tracking-wider text-indigo-100">AI Insight</h4>
                                    </div>
                                    <p className="text-sm font-medium leading-relaxed">
                                        {insights[0]?.message || 'Analizando datos...'}
                                    </p>
                                </div>
                            </div>
                        )
                    }

                    {/* Sidebar: Old Quick Actions */}
                    <div className="bg-gradient-to-br from-blue-600 to-blue-800 dark:from-blue-900 dark:to-indigo-900 rounded-2xl shadow-xl text-white p-8 flex flex-col justify-between relative overflow-hidden group h-auto">
                        <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 transform group-hover:scale-125 transition-transform duration-700">
                            <Activity size={120} />
                        </div>

                        <div>
                            <h3 className="text-2xl font-bold mb-2 relative z-10">Acciones Rápidas</h3>
                            <p className="text-blue-100 mb-8 text-sm relative z-10 opacity-90">Gestiona tus nóminas y empleados desde aquí.</p>

                            <div className="space-y-4 relative z-10">
                                <Link to="/import" className="block w-full bg-white/10 hover:bg-white/20 hover:backdrop-blur-md border border-white/20 p-4 rounded-xl flex items-center gap-4 transition-all hover:translate-x-1">
                                    <div className="bg-white/20 p-2 rounded-lg"><FileSpreadsheet size={20} /></div>
                                    <div className="text-left">
                                        <div className="font-bold">Importar Nóminas</div>
                                        <div className="text-xs text-blue-100 opacity-80">Subir nuevo Excel</div>
                                    </div>
                                </Link>

                                <Link to="/employees" className="block w-full bg-white/10 hover:bg-white/20 hover:backdrop-blur-md border border-white/20 p-4 rounded-xl flex items-center gap-4 transition-all hover:translate-x-1">
                                    <div className="bg-white/20 p-2 rounded-lg"><Users size={20} /></div>
                                    <div className="text-left">
                                        <div className="font-bold">Nuevo Empleado</div>
                                        <div className="text-xs text-blue-100 opacity-80">Alta en el sistema</div>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div >
            </div >
        </div >
    );
}
