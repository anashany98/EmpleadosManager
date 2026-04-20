import { useState } from 'react';
import { Package, Search, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VehicleManager } from '../components/assets/VehicleManager';
import { CardManager } from '../components/assets/CardManager';
import GlobalAssetsAssignedTab from './GlobalAssetsAssignedTab';
import GlobalAssetsStockTab from './GlobalAssetsStockTab';
import { useAuth } from '../contexts/AuthContext';

const CATEGORY_MAP: Record<string, string> = {
    'DEVICE': 'Dispositivo',
    'VEHICLE': 'Vehículo',
    'EPI': 'EPI',
    'TOOL': 'Herramienta',
    'CLOTHING': 'Ropa',
    'OTHER': 'Otro'
};

const STATUS_MAP: Record<string, string> = {
    'ACTIVE': 'Activo',
    'MAINTENANCE': 'Mantenimiento',
    'RETIRED': 'Retirado',
    'LOST': 'Perdido',
    'DAMAGED': 'Dañado',
    'AVAILABLE': 'Disponible'
};

function LoadingView() {
    return (
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
            <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 border-4 border-indigo-100 rounded-2xl"></div>
                <div className="absolute inset-0 border-4 border-t-indigo-600 rounded-2xl animate-spin"></div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Cargando almacén...</h3>
            <p className="text-slate-500 dark:text-slate-400">Sincronizando inventario en tiempo real</p>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{message}</p>
        </div>
    );
}

export default function GlobalAssetsPage() {
    const { user } = useAuth();
    const isGlobalAdmin = user?.role === 'admin' && !user?.companyId;
    const [activeTab, setActiveTab] = useState<'assigned' | 'stock' | 'vehicles' | 'cards'>('assigned');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');

    if (activeTab === 'assigned' || activeTab === 'stock') {
        return (
            <div className="space-y-8 p-6 lg:p-10 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                            <Package className="w-3.5 h-3.5" />
                            Gestión de Activos y Almacén
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Inventario Global</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium max-w-lg">Controla el material entregado a empleados y el stock disponible en almacén.</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full md:w-auto overflow-x-auto">
                            <button
                                onClick={() => setActiveTab('assigned')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                    activeTab === 'assigned' 
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                Material Entregado
                            </button>
                            {isGlobalAdmin && (
                                <button
                                    onClick={() => setActiveTab('stock')}
                                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                        activeTab === 'stock' 
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Stock Almacén
                                </button>
                            )}
                            <button
                                onClick={() => setActiveTab('vehicles')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                    activeTab === 'vehicles' 
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                Vehículos
                            </button>
                            <button
                                onClick={() => setActiveTab('cards')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                    activeTab === 'cards' 
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                Tarjetas
                            </button>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:flex-none">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-4 py-2 w-full md:w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                                />
                            </div>
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                            >
                                <option value="ALL">Todas</option>
                                <option value="EPI">EPI</option>
                                <option value="DEVICE">Dispositivos</option>
                                <option value="TOOL">Herramientas</option>
                                <option value="CLOTHING">Ropa</option>
                                <option value="OTHER">Otros</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'assigned' && (
                        <motion.div key="assigned" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <GlobalAssetsAssignedTab searchTerm={searchTerm} filterCategory={filterCategory} />
                        </motion.div>
                    )}
                    {activeTab === 'stock' && isGlobalAdmin && (
                        <motion.div key="stock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <GlobalAssetsStockTab searchTerm={searchTerm} filterCategory={filterCategory} />
                        </motion.div>
                    )}
                    {activeTab === 'vehicles' && (
                        <motion.div key="vehicles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <VehicleManager />
                        </motion.div>
                    )}
                    {activeTab === 'cards' && (
                        <motion.div key="cards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <CardManager />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6 lg:p-10 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                        <Package className="w-3.5 h-3.5" />
                        Gestión de Activos y Almacén
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Inventario Global</h1>
                </div>
            </div>
            <AnimatePresence mode="wait">
                {activeTab === 'vehicles' && (
                    <motion.div key="vehicles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <VehicleManager />
                    </motion.div>
                )}
                {activeTab === 'cards' && (
                    <motion.div key="cards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <CardManager />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}