import { useEffect, useState } from 'react';
import { Package, Search, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VehicleManager } from '../components/assets/VehicleManager';
import { CardManager } from '../components/assets/CardManager';
import GlobalAssetsAssignedTab from './GlobalAssetsAssignedTab';
import GlobalAssetsStockTab from './GlobalAssetsStockTab';
import { useAuth } from '../contexts/AuthContext';

export const CATEGORY_MAP: Record<string, string> = {
    'DEVICE': 'Dispositivo',
    'VEHICLE': 'Vehículo',
    'EPI': 'EPI',
    'TOOL': 'Herramienta',
    'CLOTHING': 'Ropa',
    'UNIFORM': 'Uniforme',
    'OTHER': 'Otro'
};

export const STATUS_MAP: Record<string, string> = {
    'ACTIVE': 'Activo',
    'MAINTENANCE': 'Mantenimiento',
    'RETIRED': 'Retirado',
    'LOST': 'Perdido',
    'DAMAGED': 'Dañado',
    'AVAILABLE': 'Disponible'
};

export function LoadingView() {
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

export function EmptyState({ message }: { message: string }) {
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
    const { canAccessFeature } = useAuth();
    const canManageAssets = canAccessFeature('assets');
    const canManageFleet = canAccessFeature('fleet');
    const canManageCards = canAccessFeature('cards');
    const firstAllowedTab: 'assigned' | 'stock' | 'vehicles' | 'cards' = canManageAssets ? 'assigned' : canManageFleet ? 'vehicles' : 'cards';
    const [activeTab, setActiveTab] = useState<'assigned' | 'stock' | 'vehicles' | 'cards'>(firstAllowedTab);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const isActiveTabAllowed = activeTab === 'vehicles'
        ? canManageFleet
        : activeTab === 'cards'
            ? canManageCards
            : canManageAssets;

    useEffect(() => {
        if (!isActiveTabAllowed) {
            setActiveTab(firstAllowedTab);
        }
    }, [firstAllowedTab, isActiveTabAllowed]);

    if (activeTab === 'assigned' || activeTab === 'stock') {
        return (
      <div className="space-y-4 sm:space-y-8 p-3 sm:p-6 lg:p-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
          <div className="space-y-1 sm:space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Package className="w-3.5 h-3.5" />
              Gesti\u00f3n de Activos y Almac\u00e9n
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Inventario Global</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-lg">Controla el material entregado a empleados y el stock disponible en almac\u00e9n.</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full md:w-auto overflow-x-auto">
                            {canManageAssets && (
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
                            )}
                            {canManageAssets && (
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
                            {canManageFleet && (
                            <button
                                onClick={() => setActiveTab('vehicles')}
                                className="flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            >
                                Vehículos
                            </button>
                            )}
                            {canManageCards && (
                            <button
                                onClick={() => setActiveTab('cards')}
                                className="flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            >
                                Tarjetas
                            </button>
                            )}
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:flex-none">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o SKU..."
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
                                <option value="UNIFORM">Uniformes</option>
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
                    {activeTab === 'stock' && (
                        <motion.div key="stock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <GlobalAssetsStockTab searchTerm={searchTerm} filterCategory={filterCategory} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
    <div className="space-y-4 sm:space-y-8 p-3 sm:p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div className="space-y-1 sm:space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Package className="w-3.5 h-3.5" />
            Gesti\u00f3n de Activos
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Inventario Global</h1>
                </div>
                {canManageAssets && (
                    <button
                        onClick={() => setActiveTab(firstAllowedTab)}
                        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl font-bold transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver
                    </button>
                )}
            </div>
            <AnimatePresence mode="wait">
                {activeTab === 'vehicles' && (
                    <motion.div key="vehicles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="flex items-center gap-4 mb-4">
                            {canManageAssets && (
                            <button onClick={() => setActiveTab(firstAllowedTab)} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
                                <ArrowLeft size={20} />
                                Volver al inventario
                            </button>
                            )}
                        </div>
                        <VehicleManager />
                    </motion.div>
                )}
                {activeTab === 'cards' && (
                    <motion.div key="cards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="flex items-center gap-4 mb-4">
                            {canManageAssets && (
                            <button onClick={() => setActiveTab(firstAllowedTab)} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
                                <ArrowLeft size={20} />
                                Volver al inventario
                            </button>
                            )}
                        </div>
                        <CardManager />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
