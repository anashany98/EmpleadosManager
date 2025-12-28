import { useEffect, useState } from 'react';
import { Users, FileSpreadsheet, ArrowRight, Clock, BarChart3, Sparkles, AlertTriangle, List, Cake, Gift, Plus, Search, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { WhosOutWidget } from '../components/dashboard/WhosOutWidget';

export default function Dashboard() {
    const [insights, setInsights] = useState<any[]>([]);
    const [absencesData, setAbsencesData] = useState<{ count: number; details: any[] }>({ count: 0, details: [] });
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [birthdays, setBirthdays] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [companies, setCompanies] = useState<any[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<string>('');
    const [activityTab, setActivityTab] = useState<'BATCHES' | 'AUDIT'>('BATCHES');

    useEffect(() => { fetchCompanies(); }, []);
    useEffect(() => { fetchDashboardData(); }, [selectedCompany]);

    const fetchCompanies = async () => {
        try {
            const res = await api.get('/companies');
            setCompanies(res.data || res || []);
        } catch (err) { console.error(err); }
    };

    const fetchDashboardData = async () => {
        try {
            const query = selectedCompany ? `?companyId=${selectedCompany}` : '';
            const [insightsRes, metricsRes, birthdaysRes] = await Promise.all([
                api.get(`/dashboard/insights${query}`).catch(() => ({ data: [] })),
                api.get(`/dashboard/v2/employees${query}`).catch(() => ({ data: null })),
                api.get('/dashboard/birthdays').catch(() => ({ data: [] }))
            ]);

            api.get('/dashboard/audit').catch(() => ({ data: [] })).then(res => setAuditLogs(res.data || res || []));

            setInsights(insightsRes.data || insightsRes || []);
            setMetrics(metricsRes.data || metricsRes);
            setBirthdays(birthdaysRes.data || birthdaysRes || []);

            const dashMetrics = metricsRes.data || metricsRes;
            if (dashMetrics?.attendance?.onLeaveToday) {
                if (typeof dashMetrics.attendance.onLeaveToday === 'object') {
                    setAbsencesData(dashMetrics.attendance.onLeaveToday);
                } else {
                    setAbsencesData({ count: dashMetrics.attendance.onLeaveToday || 0, details: [] });
                }
            }
        } catch (error) {
            console.error('Failed to load dashboard data', error);
        }
    };

    const chartData = metrics?.growthTrend?.map((item: any) => ({
        name: item.month,
        value: item.count
    })) || [{ name: 'Sin datos', value: 0 }];

    const recentBatches = [
        { id: 1, name: 'N_Noviembre_2024.xlsx', date: '22/12/2024', status: 'COMPLETADO', rows: 24, user: 'Admin' },
        { id: 2, name: 'N_Octubre_2024.xlsx', date: '25/11/2024', status: 'COMPLETADO', rows: 22, user: 'Admin' },
    ];

    const stats = [
        {
            title: 'Empleados',
            value: metrics?.headcount?.active || '0',
            icon: <Users size={20} className="text-white" />,
            color: 'bg-blue-500',
            trendUp: true
        },
        {
            title: 'Ausentes',
            value: absencesData.count || '0',
            icon: <Clock size={20} className="text-white" />,
            color: 'bg-emerald-500',
            trendUp: true
        },
        {
            title: 'Alertas',
            value: (metrics?.contracts?.dniExpiring || 0) + (metrics?.contracts?.licenseExpiring || 0),
            icon: <AlertTriangle size={20} className="text-white" />,
            color: 'bg-amber-500',
            trendUp: false
        },
    ];

    return (
        <div className="h-[calc(100vh-60px)] p-2 -m-6 flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden font-sans">
            {/* Header Area */}
            <div className="flex items-center justify-between px-4 pt-2 shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
                    <div className="relative group">
                        <div className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-colors shadow-sm">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                {selectedCompany ? companies.find(c => c.id === selectedCompany)?.name : 'Todas las Empresas'}
                            </span>
                            <ChevronDown size={14} className="text-slate-400 group-hover:text-blue-500" />
                            <select
                                value={selectedCompany}
                                onChange={(e) => setSelectedCompany(e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            >
                                <option value="">Todas las Empresas</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/employees" className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 rounded-full text-xs font-bold transition-all shadow-lg shadow-slate-900/10 active:scale-95">
                        <Plus size={14} /> Nuevo Empleado
                    </Link>
                    <Link to="/import" className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-bold transition-all active:scale-95">
                        <FileSpreadsheet size={14} /> Importar Nómina
                    </Link>
                </div>
            </div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-12 grid-rows-12 gap-4 px-4 pb-4 flex-1 min-h-0">

                {/* Stats Row */}
                {stats.map((stat, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="col-span-3 row-span-2 bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{stat.title}</p>
                            <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{stat.value}</span>
                        </div>
                        <div className={`w-10 h-10 rounded-full ${stat.color} flex items-center justify-center shadow-lg shadow-blue-500/20`}>
                            {stat.icon}
                        </div>
                    </motion.div>
                ))}

                {/* AI Insight Card */}
                <div className="col-span-3 row-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[1.5rem] p-4 text-white relative overflow-hidden group shadow-lg shadow-indigo-500/20">
                    <Sparkles className="absolute top-2 right-2 text-white/10 group-hover:scale-125 transition-transform duration-500" size={50} />
                    <div className="relative z-10 flex flex-col h-full justify-center">
                        <div className="flex items-center gap-1.5 mb-1 text-indigo-200">
                            <Sparkles size={12} className="text-amber-300" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Insight</span>
                        </div>
                        <p className="text-xs font-medium leading-relaxed opacity-90 line-clamp-2">
                            {insights[0]?.message || 'Analizando patrones de datos...'}
                        </p>
                    </div>
                </div>

                {/* Main Graphic - Large Block */}
                <div className="col-span-8 row-span-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                <BarChart3 className="text-blue-600 dark:text-blue-400" size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">Costes de Personal</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Evolución semestral</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-full">
                            <span className="px-3 py-1 bg-white dark:bg-slate-700 text-xs font-bold rounded-full shadow-sm text-slate-800 dark:text-slate-200">6M</span>
                            <span className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">1Y</span>
                        </div>
                    </div>
                    <div className="h-[calc(100%-60px)] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorValueBg" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(value) => `${value / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    itemStyle={{ color: '#fff' }}
                                    cursor={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '4 4' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValueBg)" activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right Column - Who's Out Widget */}
                <div className="col-span-4 row-span-10 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-1 shadow-sm flex flex-col overflow-hidden">
                    <WhosOutWidget data={absencesData} />
                </div>

                {/* Bottom Left - Table */}
                <div className="col-span-5 row-span-4 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col shadow-sm">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                        <div className="flex gap-4 text-sm font-medium text-slate-500">
                            <button
                                onClick={() => setActivityTab('BATCHES')}
                                className={`pb-2 -mb-2.5 border-b-2 transition-colors ${activityTab === 'BATCHES' ? 'border-blue-500 text-blue-600' : 'border-transparent hover:text-slate-700'}`}
                            >
                                Nóminas
                            </button>
                            <button
                                onClick={() => setActivityTab('AUDIT')}
                                className={`pb-2 -mb-2.5 border-b-2 transition-colors ${activityTab === 'AUDIT' ? 'border-emerald-500 text-emerald-600' : 'border-transparent hover:text-slate-700'}`}
                            >
                                Actividad
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {activityTab === 'BATCHES' ? (
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50/50 dark:bg-slate-800/20 text-slate-500 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">Archivo</th>
                                        <th className="px-4 py-2 font-medium text-right">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {recentBatches.map((batch) => (
                                        <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-900 dark:text-slate-200">{batch.name}</div>
                                                <div className="text-[10px] text-slate-400">{batch.date}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                    {batch.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-4 space-y-4">
                                {auditLogs.map((log, idx) => (
                                    <div key={idx} className="flex gap-3 text-xs">
                                        <div className="flex flex-col items-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5"></div>
                                            {idx !== auditLogs.length - 1 && <div className="w-px h-full bg-slate-200 dark:bg-slate-800 my-1"></div>}
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-slate-200">{log.action}</p>
                                            <span className="text-slate-400 text-[10px]">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Middle - Birthdays */}
                <div className="col-span-3 row-span-4 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-5 shadow-sm overflow-hidden flex flex-col relative">
                    <div className="flex items-center gap-2 mb-3 text-pink-500">
                        <Cake size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest">Cumpleaños</span>
                    </div>
                    <div className="space-y-3 overflow-y-auto flex-1 no-scrollbar">
                        {birthdays.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-xs text-slate-400 italic">
                                No hay cumpleaños
                            </div>
                        ) : (
                            birthdays.slice(0, 3).map((emp: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-400 to-rose-400 text-white flex items-center justify-center text-xs font-bold shadow-md shadow-pink-500/20">
                                        {emp.firstName?.[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{emp.firstName} {emp.lastName}</p>
                                        <p className="text-[10px] text-pink-500 font-medium">
                                            {new Date(emp.birthDate).getDate()} de {new Date(emp.birthDate).toLocaleDateString('es-ES', { month: 'long' })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {/* Decorative blur */}
                    <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-pink-500/10 rounded-full blur-2xl pointer-events-none"></div>
                </div>

            </div>
        </div>
    );
}
