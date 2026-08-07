import { useMemo } from 'react';
import { api } from '../api/client';
import { Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

interface Asset {
    id: string;
    name: string;
    category: string;
    status: string;
    employee?: { id: string; firstName: string; lastName: string };
    serialNumber?: string;
    assignedDate?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
    EPI: 'EPI', TECH: 'Dispositivo', DEVICE: 'Dispositivo', TOOL: 'Herramienta',
    UNIFORM: 'Uniforme', CLOTHING: 'Uniforme', OTHER: 'Otro'
};

const STATUS_LABELS: Record<string, string> = {
    ASSIGNED: 'Asignado', RETURNED: 'Devuelto', ACTIVE: 'Activo',
    MAINTENANCE: 'Mantenimiento', RETIRED: 'Retirado', LOST: 'Perdido',
    DAMAGED: 'Dañado', AVAILABLE: 'Disponible'
};

interface AssignedTabProps {
    searchTerm: string;
    filterCategory: string;
}

const getEmployeeName = (asset: Asset): string | null => {
    if (!asset.employee) return null;
    return `${asset.employee.firstName} ${asset.employee.lastName}`.trim() || null;
};

export default function GlobalAssetsAssignedTab({ searchTerm, filterCategory }: AssignedTabProps) {
    const fetchAssets = async (): Promise<Asset[]> => {
        const res = await api.get<{ data: Asset[] }>('/assets');
        return res.data;
    };

    const { data: assets = [], isLoading } = useQuery({
        queryKey: ['global-assets'],
        queryFn: fetchAssets,
    });

    const filteredAssets = useMemo(() => {
        return assets.filter((asset: Asset) => {
            const employeeName = getEmployeeName(asset);
            const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
                (asset.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
            // DEVICE se normaliza a TECH y CLOTHING a UNIFORM (alias históricos).
            const normalize = (c: string) => {
                if (c === 'DEVICE') return 'TECH';
                if (c === 'CLOTHING') return 'UNIFORM';
                return c;
            };
            const matchesCategory = filterCategory === 'ALL' || normalize(asset.category) === normalize(filterCategory);
            return matchesSearch && matchesCategory;
        });
    }, [assets, searchTerm, filterCategory]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (filteredAssets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <Package className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">No hay activos asignados encontrados</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
            {filteredAssets.map((asset: Asset) => (
                <div
                    key={asset.id}
                    className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all"
                >
                    <div className="flex items-start justify-between mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            asset.category === 'VEHICLE' ? 'bg-blue-100 text-blue-600' :
                            asset.category === 'DEVICE' || asset.category === 'TECH' ? 'bg-purple-100 text-purple-600' :
                            asset.category === 'EPI' ? 'bg-amber-100 text-amber-600' :
                            'bg-slate-100 text-slate-600'
                        }`}>
                            <Package size={20} />
                        </div>
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                            asset.status === 'ASSIGNED' || asset.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                            asset.status === 'MAINTENANCE' ? 'bg-amber-100 text-amber-700' :
                            asset.status === 'RETURNED' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                        }`}>
                            {STATUS_LABELS[asset.status] || asset.status}
                        </span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">{asset.name}</h3>
                    <p className="text-sm text-slate-500 mb-3">
                        Categoría: {CATEGORY_LABELS[asset.category] || asset.category}
                        {asset.serialNumber ? ` · SN: ${asset.serialNumber}` : ''}
                    </p>
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500 mb-1">Asignado a:</p>
                        <p className="font-medium text-slate-900 dark:text-white">{getEmployeeName(asset) || 'Sin asignar'}</p>
                        {asset.assignedDate && (
                            <p className="text-xs text-slate-400 mt-1">Desde {new Date(asset.assignedDate).toLocaleDateString('es-ES')}</p>
                        )}
                    </div>
                </div>
            ))}
        </motion.div>
    );
}