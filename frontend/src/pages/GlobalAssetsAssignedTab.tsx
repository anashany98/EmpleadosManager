import { useState, useMemo } from 'react';
import { api } from '../api/client';
import { Package, Search, ChevronRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Asset {
    id: string;
    name: string;
    category: string;
    status: string;
    assignedTo?: { name: string };
    serialNumber?: string;
    assignedAt?: string;
}

interface AssignedTabProps {
    searchTerm: string;
    filterCategory: string;
}

export default function GlobalAssetsAssignedTab({ searchTerm, filterCategory }: AssignedTabProps) {
    const queryClient = useQueryClient();
    const fetchAssets = async (): Promise<Asset[]> => {
        const res = await api.get('/assets');
        return res.data;
    };

    const { data: assets = [], isLoading } = useQuery({
        queryKey: ['global-assets'],
        queryFn: fetchAssets,
    });

    const filteredAssets = useMemo(() => {
        return assets.filter((asset: Asset) => {
            const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asset.assignedTo?.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'ALL' || asset.category === filterCategory;
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
            {filteredAssets.map((asset: Asset, idx: number) => (
                <div
                    key={asset.id}
                    className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all"
                >
                    <div className="flex items-start justify-between mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            asset.category === 'VEHICLE' ? 'bg-blue-100 text-blue-600' :
                            asset.category === 'DEVICE' ? 'bg-purple-100 text-purple-600' :
                            asset.category === 'EPI' ? 'bg-amber-100 text-amber-600' :
                            'bg-slate-100 text-slate-600'
                        }`}>
                            <Package size={20} />
                        </div>
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                            asset.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                            asset.status === 'MAINTENANCE' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                        }`}>
                            {asset.status}
                        </span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">{asset.name}</h3>
                    <p className="text-sm text-slate-500 mb-3">Categoría: {asset.category}</p>
                    {asset.assignedTo && (
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-slate-500 mb-1">Asignado a:</p>
                            <p className="font-medium text-slate-900 dark:text-white">{asset.assignedTo.name}</p>
                        </div>
                    )}
                </div>
            ))}
        </motion.div>
    );
}