import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { History, Search, Filter, User, Tag, Clock, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AuditLog {
    id: string;
    action: string;
    entity: string;
    entityId: string;
    details: string;
    createdAt: string;
    user?: {
        firstName: string;
        lastName: string;
    };
}

export default function AuditLogPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [entityFilter, setEntityFilter] = useState('ALL');

    useEffect(() => {
        fetchLogs();
    }, [page, entityFilter]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/audit?page=${page}&limit=20`);
            const data = res.data?.data || res.data || [];
            setLogs(Array.isArray(data) ? data : []);
            setTotalPages(res.data?.pagination?.pages || 1);
        } catch (error) {
            console.error('Error fetching logs', error);
        } finally {
            setLoading(false);
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATE': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            case 'UPDATE': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
            case 'DELETE': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
            default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
        }
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.entity?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesEntity = entityFilter === 'ALL' || log.entity === entityFilter;
        return matchesSearch && matchesEntity;
    });

    const entities = ['ALL', ...new Set(logs.map(l => l.entity))];

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Activity className="text-blue-500 w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Seguridad & Trazabilidad</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-4">
                        Auditoría del Sistema
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                        Historial completo de cambios y actividad en la plataforma
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar en registros..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-500/10 transition-all outline-none w-64 shadow-sm"
                        />
                    </div>

                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select
                            value={entityFilter}
                            onChange={(e) => setEntityFilter(e.target.value)}
                            className="pl-12 pr-8 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 appearance-none focus:ring-4 focus:ring-blue-500/10 outline-none shadow-sm min-w-[160px]"
                        >
                            {entities.map(e => (
                                <option key={e} value={e}>{e === 'ALL' ? 'Todas las Entidades' : e}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-950 rounded-[40px] border border-slate-100 dark:border-slate-900 shadow-2xl overflow-hidden min-h-[600px] flex flex-col relative">
                <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#3b82f6 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />

                <div className="relative z-10 flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-[500px] space-y-4 animate-pulse">
                            <History size={48} className="text-blue-500 animate-spin" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando historial...</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[500px] space-y-6 grayscale opacity-50">
                            <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-[32px]">
                                <History size={64} className="text-slate-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-slate-900 dark:text-white font-black uppercase tracking-[0.2em]">Sin Resultados</p>
                                <p className="text-slate-500 text-sm mt-1">No se han encontrado registros con esos filtros</p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50">
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Acción</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Entidad</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Detalles</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Fecha & Hora</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-900">
                                    <AnimatePresence mode="popLayout">
                                        {filteredLogs.map((log) => (
                                            <motion.tr
                                                key={log.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="group hover:bg-blue-500/[0.02] transition-colors"
                                            >
                                                <td className="px-8 py-5">
                                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-wider ${getActionColor(log.action)}`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <Tag size={14} className="text-blue-500/50" />
                                                        <span className="text-xs font-black text-slate-700 dark:text-slate-300 tracking-tighter uppercase">{log.entity}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                                                            {log.details}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                                                            <User size={10} />
                                                            ID: {log.entityId}
                                                            {log.user && <span>· por {log.user.firstName} {log.user.lastName}</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                                                            {format(new Date(log.createdAt), 'dd MMM yyyy', { locale: es })}
                                                        </span>
                                                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter">
                                                            <Clock size={10} />
                                                            {format(new Date(log.createdAt), 'HH:mm:ss')}
                                                        </div>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center relative z-10">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Página {page} de {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 disabled:opacity-50 hover:border-blue-500 transition-colors shadow-sm"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 disabled:opacity-50 hover:border-blue-500 transition-colors shadow-sm"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
