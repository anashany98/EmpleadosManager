import { useState, useMemo } from 'react';
import { api } from '../api/client';
import { Package, Search, Filter, Clock, Tag, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

interface Asset {
    id: string;
    name: string;
    type: string;
    serialNumber?: string;
    assignedDate: string;
    status: string;
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        department: string;
    };
}

const fetchAssets = async (): Promise<Asset[]> => {
    const res = await api.get('/assets');
    const data = res.data?.data || res.data || [];
    return Array.isArray(data) ? data : [];
};

export default function GlobalAssetsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');

    const { data: assets = [], isLoading, error } = useQuery({
        queryKey: ['global-assets'],
        queryFn: fetchAssets,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = asset.name?.toLowerCase().includes(term) ||
                asset.employee?.firstName?.toLowerCase().includes(term) ||
                asset.serialNumber?.toLowerCase().includes(term);
            const matchesType = typeFilter === 'ALL' || asset.type === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [assets, searchTerm, typeFilter]);

    const types = useMemo(() => ['ALL', ...new Set(assets.map(a => a.type))], [assets]);

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center p-20 space-y-6">
            <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
                <Package size={80} className="text-indigo-600 relative animate-bounce" />
            </div>
            <p className="text-slate-900 dark:text-white font-black uppercase tracking-widest text-lg">Inventariando Recursos</p>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center p-20 space-y-6 text-red-500">
            <p className="font-bold">Error cargando activos</p>
        </div>
    );

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Package className="text-indigo-500 w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Control de Inventario</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-4">
                        Activos de Empresa
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                        Gestión centralizada de equipamiento, herramientas y recursos asignados
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar activo o usuario..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none w-64 shadow-sm"
                        />
                    </div>

                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="pl-12 pr-8 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 appearance-none focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-sm min-w-[160px]"
                        >
                            {types.map(t => (
                                <option key={t} value={t}>{t === 'ALL' ? 'Todos los Tipos' : t}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                    {filteredAssets.map((asset, idx) => (
                        <motion.div
                            key={asset.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: idx * 0.05 }}
                            className="bg-white dark:bg-slate-900 rounded-[32px] p-6 border border-slate-100 dark:border-slate-800 shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />

                            <div className="flex justify-between items-start mb-6">
                                <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-900/20">
                                    <Tag size={24} />
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Activo #SRL</span>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">{asset.serialNumber || 'SN-0000'}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{asset.name}</h3>
                                    <span className="text-[10px] font-black uppercase text-indigo-500 tracking-tighter">{asset.type}</span>
                                </div>

                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
                                            {asset.employee.firstName[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <Link to={`/employees/${asset.employee.id}`} className="text-sm font-bold text-slate-900 dark:text-white block hover:underline hover:text-indigo-500 transition-colors truncate">
                                                {asset.employee.firstName} {asset.employee.lastName}
                                            </Link>
                                            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{asset.employee.department}</span>
                                        </div>
                                        <ChevronRight size={14} className="text-slate-400" />
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                            <Clock size={12} className="text-indigo-400" />
                                            Dsd. {new Date(asset.assignedDate).toLocaleDateString()}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase py-1 px-2 bg-emerald-500/10 text-emerald-500 rounded-lg tracking-widest">
                                            <CheckCircle2 size={12} /> Entregado
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {filteredAssets.length === 0 && (
                <div className="flex flex-col items-center justify-center py-40 grayscale opacity-50">
                    <Package size={64} className="text-slate-400 mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest">No se encontraron activos registrados</p>
                </div>
            )}
        </div>
    );
}
