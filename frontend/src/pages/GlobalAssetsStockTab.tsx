import { useState, useMemo } from 'react';
import { api } from '../api/client';
import { Package, Search, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface InventoryItem {
    id: string;
    name: string;
    category: string;
    quantity: number;
    minQuantity: number;
    size?: string;
}

interface StockTabProps {
    searchTerm: string;
    filterCategory: string;
}

export default function GlobalAssetsStockTab({ searchTerm, filterCategory }: StockTabProps) {
    const queryClient = useQueryClient();
    const [showRefillModal, setShowRefillModal] = useState(false);
    const [refillItem, setRefillItem] = useState<InventoryItem | null>(null);
    const [refillAmount, setRefillAmount] = useState<number>(0);

    const fetchInventory = async (): Promise<InventoryItem[]> => {
        const res = await api.get('/inventory');
        return res.data;
    };

    const { data: inventory = [], isLoading } = useQuery({
        queryKey: ['inventory'],
        queryFn: fetchInventory,
    });

    const addStockMutation = useMutation({
        mutationFn: async ({ id, amount }: { id: string, amount: number }) => 
            api.post(`/inventory/${id}/stock`, { amount }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            toast.success('Stock actualizado');
            setShowRefillModal(false);
        },
        onError: () => toast.error('Error al actualizar stock')
    });

    const filteredInventory = useMemo(() => {
        return inventory.filter((item: InventoryItem) => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'ALL' || item.category === filterCategory;
            return matchesSearch && matchesCategory;
        });
    }, [inventory, searchTerm, filterCategory]);

    const handleRefill = (item: InventoryItem) => {
        setRefillItem(item);
        setRefillAmount(0);
        setShowRefillModal(true);
    };

    const handleConfirmRefill = () => {
        if (refillItem && refillAmount > 0) {
            addStockMutation.mutate({ id: refillItem.id, amount: refillAmount });
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (filteredInventory.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <Package className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">No hay productos en almacén</p>
            </div>
        );
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
                {filteredInventory.map((item: InventoryItem, idx: number) => {
                    const isLow = item.quantity <= item.minQuantity;
                    return (
                        <div
                            key={item.id}
                            className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                    item.category === 'EPI' ? 'bg-amber-100 text-amber-600' :
                                    item.category === 'TECH' ? 'bg-purple-100 text-purple-600' :
                                    'bg-slate-100 text-slate-600'
                                }`}>
                                    <Package size={20} />
                                </div>
                                {isLow && (
                                    <div className="flex items-center gap-1 text-amber-600">
                                        <AlertTriangle size={16} />
                                    </div>
                                )}
                            </div>
                            <h3 className="font-bold text-slate-900 dark:text-white mb-1">{item.name}</h3>
                            <p className="text-sm text-slate-500 mb-3">Categoría: {item.category}</p>
                            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                                <div>
                                    <p className="text-xs text-slate-500">Stock actual</p>
                                    <p className={`font-bold ${isLow ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                                        {item.quantity}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleRefill(item)}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
                                >
                                    + Añadir
                                </button>
                            </div>
                        </div>
                    );
                })}
            </motion.div>

            {showRefillModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Añadir stock</h3>
                        <p className="text-slate-500 mb-4">{refillItem?.name}</p>
                        <input
                            type="number"
                            min="1"
                            value={refillAmount}
                            onChange={(e) => setRefillAmount(parseInt(e.target.value) || 0)}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 mb-4"
                            placeholder="Cantidad"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowRefillModal(false)}
                                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmRefill}
                                disabled={refillAmount <= 0 || addStockMutation.isPending}
                                className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50"
                            >
                                {addStockMutation.isPending ? 'Añadiendo...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}