import { useState, useEffect } from 'react';
import { Users, Clock, AlertTriangle, Sparkles, Cake } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { WhosOutWidget } from './WhosOutWidget';
import TimeTrackerWidget from '../TimeTrackerWidget';
import OnboardingWidget from '../dashboard/OnboardingWidget';
import { useAuth } from '../../contexts/AuthContext';

interface OverviewTabProps {
    selectedCompany: string;
    metrics: any; // v2/employees metrics passed from parent
    loading?: boolean;
}

export default function OverviewTab({ selectedCompany, metrics }: OverviewTabProps) {
    const { user } = useAuth();
    const isEmployee = user?.role === 'employee';
    const [insights, setInsights] = useState<any[]>([]);
    const [currentInsightIndex, setCurrentInsightIndex] = useState(0);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [celebrations, setCelebrations] = useState<any[]>([]);
    const [activityTab, setActivityTab] = useState<'BATCHES' | 'AUDIT'>('BATCHES');

    // Derived state from metrics
    const absencesData = metrics?.attendance?.onLeaveToday && typeof metrics.attendance.onLeaveToday === 'object'
        ? metrics.attendance.onLeaveToday
        : { count: metrics?.attendance?.onLeaveToday || 0, details: [] };

    const stats = [
        {
            title: 'Empleados',
            value: metrics?.headcount?.active || '0',
            icon: <Users size={20} className="text-white" />,
            color: 'bg-blue-500',
        },
        {
            title: 'Ausentes',
            value: absencesData.count || '0',
            icon: <Clock size={20} className="text-white" />,
            color: 'bg-emerald-500',
        },
        {
            title: 'Alertas',
            value: (metrics?.contracts?.dniExpiring || 0) + (metrics?.contracts?.licenseExpiring || 0) + (metrics?.contracts?.medicalReviewExpiring || 0),
            icon: <AlertTriangle size={20} className="text-white" />,
            color: 'bg-amber-500',
        },
    ];

    const recentBatches = [
        { id: 1, name: 'N_Noviembre_2024.xlsx', date: '22/12/2024', status: 'COMPLETADO', rows: 24, user: 'Admin' },
        { id: 2, name: 'N_Octubre_2024.xlsx', date: '25/11/2024', status: 'COMPLETADO', rows: 22, user: 'Admin' },
    ];

    useEffect(() => {
        const fetchOperationalData = async () => {
            const query = selectedCompany ? `?companyId=${selectedCompany}` : '';
            try {
                const [insRes, celRes, audRes] = await Promise.all([
                    api.get(`/dashboard/insights${query}`).catch(() => ({ data: [] })),
                    api.get('/dashboard/celebrations').catch(() => ({ data: [] })),
                    api.get('/dashboard/audit').catch(() => ({ data: [] }))
                ]);
                setInsights(insRes.data || []);
                setCelebrations(celRes.data || []);
                setAuditLogs(audRes.data || []);
            } catch (e) {
                console.error(e);
            }
        };
        fetchOperationalData();
    }, [selectedCompany]);

    // Insight rotation
    useEffect(() => {
        if (insights.length <= 1) return;
        const interval = setInterval(() => setCurrentInsightIndex(p => (p + 1) % insights.length), 6000);
        return () => clearInterval(interval);
    }, [insights.length]);

    const currentInsight = insights[currentInsightIndex];

    return (
        <div className="flex flex-col md:grid md:grid-cols-12 md:grid-rows-12 gap-4 pb-4 flex-1 min-h-0 animate-in fade-in duration-500">
            {/* Stats Row */}
            {!isEmployee && stats.map((stat, idx) => (
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="col-span-12 md:col-span-3 row-span-2 bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
                >
                    <div className="flex-1">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{stat.title}</p>
                        <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{stat.value}</span>
                    </div>
                    <div className={`w-10 h-10 rounded-full ${stat.color} flex items-center justify-center shadow-lg shadow-blue-500/20`}>
                        {stat.icon}
                    </div>
                </motion.div>
            ))}

            {/* AI Insight Card */}
            {!isEmployee && (
                <div className="col-span-12 md:col-span-3 row-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[1.5rem] p-4 text-white relative overflow-hidden group shadow-lg shadow-indigo-500/20 min-h-[120px]">
                    <Sparkles className="absolute top-2 right-2 text-white/10 group-hover:scale-125 transition-transform duration-500" size={50} />
                    <div className="relative z-10 flex flex-col h-full justify-center">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5 text-indigo-200">
                                <Sparkles size={12} className="text-amber-300" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Insight</span>
                            </div>
                            {insights.length > 1 && (
                                <div className="flex gap-1">
                                    {insights.map((_, i) => (
                                        <div key={i} className={`w-1 h-1 rounded-full transition-all ${i === currentInsightIndex ? 'bg-white w-2' : 'bg-white/30'}`} />
                                    ))}
                                </div>
                            )}
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentInsightIndex}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="min-h-[3rem]"
                            >
                                <h5 className="text-[10px] font-bold text-indigo-200 mb-0.5 uppercase tracking-wide">
                                    {currentInsight?.title || 'Analizando...'}
                                </h5>
                                <p className="text-xs font-medium leading-relaxed opacity-90 line-clamp-2">
                                    {currentInsight?.message || 'Escaneando datos de la empresa...'}
                                </p>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {/* Activity Table - Takes Main Left Area */}
            <div className={`${isEmployee ? 'col-span-12 md:col-span-8' : 'col-span-12 md:col-span-8'} row-span-10 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col shadow-sm min-h-[400px]`}>
                {!isEmployee ? (
                    <>
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                            <div className="flex gap-4 text-sm font-medium text-slate-500">
                                <button
                                    onClick={() => setActivityTab('BATCHES')}
                                    className={`pb-2 -mb-2.5 border-b-2 transition-colors ${activityTab === 'BATCHES' ? 'border-blue-500 text-blue-600' : 'border-transparent hover:text-slate-700'}`}
                                >
                                    Nóminas Recientes
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
                                            <th className="px-4 py-3 font-medium">Archivo</th>
                                            <th className="px-4 py-3 font-medium text-right">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {recentBatches.map((batch) => (
                                            <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-900 dark:text-slate-200">{batch.name}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">{batch.date} • {batch.rows} empleados</div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
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
                                        <div key={idx} className="flex gap-3 text-xs group">
                                            <div className="flex flex-col items-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 group-hover:scale-125 transition-transform"></div>
                                                {idx !== auditLogs.length - 1 && <div className="w-px h-full bg-slate-200 dark:bg-slate-800 my-1 group-hover:bg-blue-200 dark:group-hover:bg-blue-900 transition-colors"></div>}
                                            </div>
                                            <div className="pb-2">
                                                <p className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{log.action}</p>
                                                <span className="text-slate-400 text-[10px]">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="p-8 flex flex-col items-center justify-center h-full text-center">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-full mb-6">
                            <Sparkles size={48} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">¡Hola, {user?.email.split('@')[0]}!</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                            Bienvenido a tu panel personal. Aquí puedes gestionar tus fichajes, ver tus vacaciones y acceder a tus documentos.
                        </p>
                        <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-lg">
                            <Link to="/profile" className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-blue-500 transition-all text-center">
                                <Users className="mx-auto mb-2 text-blue-500" size={24} />
                                <span className="text-xs font-bold block text-slate-700 dark:text-slate-200">Mi Perfil</span>
                            </Link>
                            <Link to="/vacations" className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-blue-500 transition-all text-center">
                                <Clock className="mx-auto mb-2 text-emerald-500" size={24} />
                                <span className="text-xs font-bold block text-slate-700 dark:text-slate-200">Vacaciones</span>
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column Stack */}
            <div className="col-span-12 md:col-span-4 row-span-10 flex flex-col gap-4 h-full">
                {/* Time Tracker Widget */}
                {isEmployee && (
                    <div className="shrink-0 space-y-4">
                        <TimeTrackerWidget />
                        {user?.employeeId && <OnboardingWidget employeeId={user.employeeId} />}
                    </div>
                )}

                {/* Who's Out Widget */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-1 shadow-sm flex flex-col overflow-hidden flex-1 min-h-[150px]">
                    <WhosOutWidget data={absencesData} />
                </div>

                {/* Celebrations */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-5 shadow-sm overflow-hidden flex flex-col relative flex-1 min-h-[150px]">
                    <div className="flex items-center gap-2 mb-3 text-pink-500 shrink-0">
                        <Cake size={18} className="animate-bounce" />
                        <span className="text-xs font-bold uppercase tracking-widest">Celebraciones</span>
                    </div>
                    <div className="space-y-3 overflow-y-auto flex-1 no-scrollbar">
                        {celebrations.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-xs text-slate-400 italic">
                                No hay celebraciones próximas
                            </div>
                        ) : (
                            celebrations.slice(0, 5).map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-3 group hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-xl transition-colors cursor-default">
                                    <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${item.type === 'BIRTHDAY' ? 'from-pink-400 to-rose-400' : 'from-blue-400 to-indigo-400'} text-white flex items-center justify-center text-xs font-bold shadow-md shrink-0`}>
                                        {item.type === 'BIRTHDAY' ? <Cake size={14} /> : <Sparkles size={14} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.firstName} {item.lastName}</p>
                                        <p className={`text-[10px] font-medium ${item.type === 'BIRTHDAY' ? 'text-pink-500' : 'text-blue-500'}`}>
                                            {item.description} • {new Date(item.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-pink-500/10 rounded-full blur-2xl pointer-events-none"></div>
                </div>
            </div>
        </div>
    );
}
