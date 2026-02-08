import { useState, useEffect } from 'react';
import { Plus, FileSpreadsheet, ChevronDown, LayoutDashboard, Users, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import OverviewTab from '../components/dashboard/OverviewTab';
import HRTab from '../components/dashboard/HRTab';
import FinancialTab from '../components/dashboard/FinancialTab';
import { AnimatePresence, motion } from 'framer-motion';

export default function Dashboard() {
    const { user } = useAuth();
    const [metrics, setMetrics] = useState<any>(null);
    const [companies, setCompanies] = useState<any[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HR' | 'FINANCIAL'>('OVERVIEW');
    const [loading, setLoading] = useState(true);

    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        if (isAdmin) fetchCompanies();
    }, [isAdmin]);

    useEffect(() => {
        if (isAdmin) fetchMetrics();
    }, [selectedCompany, isAdmin]);

    const fetchCompanies = async () => {
        try {
            const res = await api.get('/companies');
            setCompanies(res.data || res || []);
        } catch (err) { console.error(err); }
    };

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const query = selectedCompany ? `?companyId=${selectedCompany}` : '';
            // v2/employees serves as the base for many specific metrics
            const res = await api.get(`/dashboard/v2/employees${query}`);
            setMetrics(res.data || res);
        } catch (error) {
            console.error('Failed to load dashboard metrics', error);
        } finally {
            setLoading(false);
        }
    };

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${activeTab === id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg scale-105'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
        >
            <Icon size={14} />
            {label}
        </button>
    );

    return (
        <div className="h-[calc(100vh-60px)] p-2 -m-6 flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden font-sans">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between px-4 pt-2 shrink-0 gap-4 md:gap-0 z-10">
                <div className="flex items-center gap-6">
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>

                    {/* Tab Navigation */}
                    <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
                        <TabButton id="OVERVIEW" label="Resumen" icon={LayoutDashboard} />
                        {isAdmin && <TabButton id="HR" label="RRHH" icon={Users} />}
                        {isAdmin && <TabButton id="FINANCIAL" label="Financiero" icon={DollarSign} />}
                    </div>

                    {isAdmin && <div className="hidden md:block h-6 w-px bg-slate-200 dark:bg-slate-800"></div>}

                    {/* Company Selector */}
                    {isAdmin && (
                        <div className="relative group">
                            <div className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-colors shadow-sm">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[150px]">
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
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <>
                            <Link to="/employees" className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 rounded-full text-xs font-bold transition-all shadow-lg shadow-slate-900/10 active:scale-95 whitespace-nowrap">
                                <Plus size={14} /> Nuevo Empleado
                            </Link>
                            <Link to="/import" className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-bold transition-all active:scale-95 whitespace-nowrap">
                                <FileSpreadsheet size={14} /> Importar Nómina
                            </Link>
                        </>
                    )}
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
                <AnimatePresence mode="wait">
                    {activeTab === 'OVERVIEW' && (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            className="h-full"
                        >
                            <OverviewTab selectedCompany={selectedCompany} metrics={metrics} loading={loading} />
                        </motion.div>
                    )}
                    {activeTab === 'HR' && (
                        <motion.div
                            key="hr"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            className="h-full"
                        >
                            <HRTab metrics={metrics} />
                        </motion.div>
                    )}
                    {activeTab === 'FINANCIAL' && (
                        <motion.div
                            key="financial"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            className="h-full"
                        >
                            <FinancialTab selectedCompany={selectedCompany} metrics={metrics} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
