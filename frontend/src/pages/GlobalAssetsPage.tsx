import { useState, useMemo } from 'react';
import { api } from '../api/client';
import { Link } from 'react-router-dom';
import { Package, Search, Filter, Clock, Tag, ChevronRight, Plus, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Asset {
    id: string;
    name: string;
    category: string;
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

interface InventoryItem {
    id: string;
    name: string;
    category: string;
    quantity: number;
    minQuantity: number;
    description?: string;
    updatedAt: string;
}

const CATEGORY_MAP: Record<string, string> = {
    'ALL': 'Todas',
    'EPI': 'EPI',
    'TECH': 'Tecnología',
    'TOOLS': 'Herramientas',
    'CLOTHING': 'Ropa / Uniforme',
    'UNIFORM': 'Uniforme',
    'UNIFORME': 'Uniforme',
    'OTHER': 'Otros',
    'OFFICE': 'Oficina'
};

const STATUS_MAP: Record<string, string> = {
    'ASSIGNED': 'Asignado',
    'RETURNED': 'Devuelto',
    'LOST': 'Perdido',
    'DAMAGED': 'Dañado',
    'AVAILABLE': 'Disponible'
};

const fetchAssets = async (): Promise<Asset[]> => {
    const res = await api.get('/assets');
    const data = res.data?.data || res.data || [];
    return Array.isArray(data) ? data : [];
};

const fetchInventory = async (): Promise<InventoryItem[]> => {
    const res = await api.get('/inventory');
    const data = res.data?.data || res.data || [];
    return Array.isArray(data) ? data : [];
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
    const [activeTab, setActiveTab] = useState<'assigned' | 'stock'>('assigned');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');

    // Inventory Form State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', category: 'EPI', quantity: 0, minQuantity: 5, size: '' });

    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [assignData, setAssignData] = useState({ employeeId: '', quantity: 1, serialNumber: '', notes: '' });

    const [showMovementsModal, setShowMovementsModal] = useState(false);
    const [movements, setMovements] = useState<any[]>([]);
    const [loadingMovements, setLoadingMovements] = useState(false);

    // Stock Refill Modal State
    const [showRefillModal, setShowRefillModal] = useState(false);
    const [refillItem, setRefillItem] = useState<InventoryItem | null>(null);
    const [refillAmount, setRefillAmount] = useState<number>(0);

    const queryClient = useQueryClient();

    // Queries
    const { data: assets = [], isLoading: loadingAssets } = useQuery({
        queryKey: ['global-assets'],
        queryFn: fetchAssets,
    });

    const { data: inventory = [], isLoading: loadingInventory } = useQuery({
        queryKey: ['inventory'],
        queryFn: fetchInventory,
    });

    // Mutations
    const createItemMutation = useMutation({
        mutationFn: async (data: any) => api.post('/inventory', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            setShowAddModal(false);
            setNewItem({ name: '', category: 'EPI', quantity: 0, minQuantity: 5, size: '' });
            toast.success('Producto añadido al almacén');
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Error al crear el producto')
    });

    const addStockMutation = useMutation({
        mutationFn: async ({ id, amount }: { id: string, amount: number }) => api.post(`/inventory/${id}/stock`, { amount }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            toast.success('Stock actualizado');
        },
        onError: () => toast.error('Error al actualizar stock')
    });

    const generateReceiptMutation = useMutation({
        mutationFn: async (data: { itemId: string; employeeId: string; deviceName: string; serialNumber: string }) => {
            const res = await api.post(`/inventory/${data.itemId}/generate-receipt`, {
                employeeId: data.employeeId,
                deviceName: data.deviceName,
                serialNumber: data.serialNumber
            }, { responseType: 'blob' });
            return res;
        },
        onSuccess: (blob, variables) => {
            const url = window.URL.createObjectURL(new Blob([blob as any]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Entrega_${variables.deviceName.replace(/\s+/g, '_')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            toast.success('Acta de entrega generada correctamente');
        },
        onError: () => toast.error('Error al generar el acta de entrega')
    });

    const distributeMutation = useMutation({
        mutationFn: async (data: any) => api.post(`/inventory/${selectedItem?.id}/distribute`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['global-assets'] });

            // If it's a tech device, generate receipt automatically
            if (selectedItem?.category === 'TECH' || selectedItem?.category === 'EPI') {
                generateReceiptMutation.mutate({
                    itemId: selectedItem!.id,
                    employeeId: assignData.employeeId,
                    deviceName: selectedItem!.name,
                    serialNumber: assignData.serialNumber
                });
            }

            setShowAssignModal(false);
            setSelectedItem(null);
            setAssignData({ employeeId: '', quantity: 1, serialNumber: '', notes: '' });
            toast.success('Artículo asignado correctamente');
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Error al asignar artículo')
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const res = await api.get('/employees');
            return res.data?.data || res.data || [];
        }
    });

    const fetchMovements = async (itemId: string) => {
        setLoadingMovements(true);
        try {
            const res = await api.get(`/inventory/${itemId}/movements`);
            setMovements(res.data?.data || res.data || []);
            setShowMovementsModal(true);
        } catch (error) {
            toast.error('Error al obtener el historial');
        } finally {
            setLoadingMovements(false);
        }
    };

    // Filtering Logic
    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = asset.name?.toLowerCase().includes(term) ||
                asset.employee?.firstName?.toLowerCase().includes(term) ||
                asset.serialNumber?.toLowerCase().includes(term);
            const matchesType = filterCategory === 'ALL' || asset.category === filterCategory;
            return matchesSearch && matchesType;
        });
    }, [assets, searchTerm, filterCategory]);

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = item.name.toLowerCase().includes(term);
            const matchesType = filterCategory === 'ALL' || item.category === filterCategory;
            return matchesSearch && matchesType;
        });
    }, [inventory, searchTerm, filterCategory]);

    const categories = ['ALL', 'EPI', 'TECH', 'TOOLS', 'CLOTHING', 'OTHER'];

    if (loadingAssets || loadingInventory) return <LoadingView />;

    return (
        <div className="space-y-8 p-6 lg:p-10 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                        <Package className="w-3.5 h-3.5" />
                        Gestión de Activos y Almacén
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Inventario Global</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium max-w-lg">Controla el material entregado a empleados y el stock disponible en almacén.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Añadir Producto
                    </button>
                </div>
            </div>

            {/* Tabs & Filters */}
            <div className="bg-white dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full md:w-auto">
                    <button
                        onClick={() => setActiveTab('assigned')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'assigned' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Material Entregado
                    </button>
                    <button
                        onClick={() => setActiveTab('stock')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'stock' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Stock Almacén
                    </button>
                </div>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, empleado o serie..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 dark:text-white placeholder:text-slate-400"
                    />
                </div>

                <div className="relative w-full md:w-48">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 dark:text-white appearance-none cursor-pointer"
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{CATEGORY_MAP[cat] || cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Grid Display */}
            <AnimatePresence mode="wait">
                {activeTab === 'assigned' ? (
                    <motion.div
                        key="assigned"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {filteredAssets.length === 0 ? (
                            <EmptyState message="No hay activos asignados encontrados" />
                        ) : (
                            filteredAssets.map((asset, idx) => (
                                <AssetCard key={asset.id} asset={asset} index={idx} />
                            ))
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="stock"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    >
                        {filteredInventory.length === 0 ? (
                            <EmptyState message="No hay productos en almacén" />
                        ) : (
                            filteredInventory.map((item, idx) => (
                                <InventoryCard
                                    key={item.id}
                                    item={item}
                                    index={idx}
                                    onAddStock={() => {
                                        // This prop is now ignored as we open the modal internally or replace it
                                        setRefillItem(item);
                                        setRefillAmount(0);
                                        setShowRefillModal(true);
                                    }}
                                    onAssign={() => {
                                        setSelectedItem(item);
                                        setAssignData({ employeeId: '', quantity: 1, serialNumber: '', notes: '' });
                                        setShowAssignModal(true);
                                    }}
                                    onViewHistory={() => {
                                        setSelectedItem(item);
                                        fetchMovements(item.id);
                                    }}
                                />
                            ))
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Movements History Modal */}
            {showMovementsModal && selectedItem && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl p-8 shadow-2xl space-y-6 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Historial de Stock</h2>
                                <p className="text-sm text-slate-500 font-medium">{selectedItem.name}</p>
                            </div>
                            <button onClick={() => setShowMovementsModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <ChevronRight className="rotate-90 w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {loadingMovements ? (
                                <div className="flex flex-col gap-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl" />
                                    ))}
                                </div>
                            ) : movements.length === 0 ? (
                                <div className="text-center py-10 opacity-50">No hay movimientos registrados</div>
                            ) : (
                                movements.map((move: any) => (
                                    <div key={move.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group hover:bg-white dark:hover:bg-slate-800 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${move.type === 'ENTRY' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                                                {move.type === 'ENTRY' ? '+' : '-'}
                                                {move.quantity}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-white">{move.type === 'ENTRY' ? 'Carga de Stock' : 'Asignación'}</p>
                                                <p className="text-xs text-slate-500 font-medium">{new Date(move.createdAt).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{move.notes || 'Sin observaciones'}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Modal */}
            {showAssignModal && selectedItem && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-8 shadow-2xl space-y-6"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Package className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Repartir Material</h2>
                                <p className="text-sm text-slate-500 font-medium">{selectedItem.name} ({selectedItem.quantity} disp.)</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Empleado Destino</label>
                                <select
                                    value={assignData.employeeId}
                                    onChange={(e) => setAssignData({ ...assignData, employeeId: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                >
                                    <option value="">Seleccionar empleado...</option>
                                    {employees.map((emp: any) => (
                                        <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Cantidad</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={selectedItem.quantity}
                                        value={assignData.quantity}
                                        onChange={(e) => setAssignData({ ...assignData, quantity: parseInt(e.target.value) })}
                                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 dark:text-white font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nº Serie / IMEI</label>
                                    <input
                                        type="text"
                                        placeholder="Opcional"
                                        value={assignData.serialNumber}
                                        onChange={(e) => setAssignData({ ...assignData, serialNumber: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Notas</label>
                                <textarea
                                    placeholder="Motivo de la asignación..."
                                    value={assignData.notes}
                                    onChange={(e) => setAssignData({ ...assignData, notes: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 dark:text-white h-24"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-750 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (!assignData.employeeId) return toast.error('Selecciona un empleado');
                                    distributeMutation.mutate({
                                        itemId: selectedItem.id,
                                        ...assignData
                                    });
                                }}
                                disabled={distributeMutation.isPending}
                                className="flex-[2] px-6 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
                            >
                                {distributeMutation.isPending ? 'Procesando...' : 'Completar Entrega'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Stock Refill Modal */}
            <AnimatePresence>
                {showRefillModal && refillItem && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-8 shadow-2xl space-y-6"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <Plus className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Reponer Stock</h2>
                                    <p className="text-sm text-slate-500 font-medium">{refillItem.name}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Cantidad a añadir</label>
                                    <input
                                        type="number"
                                        min="1"
                                        autoFocus
                                        placeholder="Ingrese la cantidad..."
                                        value={refillAmount || ''}
                                        onChange={(e) => setRefillAmount(parseInt(e.target.value) || 0)}
                                        className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xl font-black focus:ring-2 focus:ring-emerald-500 dark:text-white text-center"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowRefillModal(false)}
                                    className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-750 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        if (refillAmount <= 0) return toast.error('Ingresa una cantidad válida');
                                        addStockMutation.mutate({ id: refillItem.id, amount: refillAmount });
                                        setShowRefillModal(false);
                                    }}
                                    disabled={addStockMutation.isPending}
                                    className="flex-[2] px-6 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                >
                                    Aceptar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Add Item Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-8 shadow-2xl space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <Plus className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Nuevo Producto</h2>
                                <p className="text-sm text-slate-500 font-medium">Registrar nuevo material en almacén</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Categoría</label>
                                    <select
                                        value={newItem.category}
                                        onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    >
                                        {categories.filter(c => c !== 'ALL').map(c => <option key={c} value={c}>{CATEGORY_MAP[c] || c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Talla (ropa)</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: M, 42..."
                                        value={newItem.size}
                                        onChange={(e) => setNewItem({ ...newItem, size: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nombre del Producto</label>
                                <input
                                    type="text"
                                    value={newItem.name}
                                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Stock Inicial</label>
                                    <input
                                        type="number"
                                        value={newItem.quantity}
                                        onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })}
                                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Alerta Stock Bajo</label>
                                    <input
                                        type="number"
                                        value={newItem.minQuantity}
                                        onChange={(e) => setNewItem({ ...newItem, minQuantity: parseInt(e.target.value) })}
                                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-750 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => createItemMutation.mutate(newItem)}
                                className="flex-1 px-6 py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-700 transition-all"
                            >
                                Guardar Producto
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function AssetCard({ asset, index }: { asset: Asset; index: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all"
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${asset.category === 'EPI' ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' :
                    asset.category === 'TECH' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' :
                        'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                    }`}>
                    <Package className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
                        {CATEGORY_MAP[asset.category] || asset.category}
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase">
                        {STATUS_MAP[asset.status] || asset.status}
                    </span>
                </div>
            </div>

            <div className="space-y-3 mb-6">
                <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight group-hover:text-indigo-600 transition-colors capitalize">
                        {asset.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold mt-1">S/N: {asset.serialNumber || '---'}</p>
                </div>

                <div className="h-px bg-slate-100 dark:bg-slate-800" />

                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-indigo-600 dark:text-indigo-400 text-sm">
                        {(asset.employee.firstName?.[0] || '?')}{(asset.employee.lastName?.[0] || '?')}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-1">
                            {asset.employee.firstName || 'Sin'} {asset.employee.lastName || 'Nombre'}
                        </p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                            {asset.employee.department || 'Sin Departamento'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-bold">{new Date(asset.assignedDate).toLocaleDateString()}</span>
                </div>
                <Link
                    to={`/employees/${asset.employee.id}`}
                    className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors"
                >
                    <ChevronRight className="w-5 h-5" />
                </Link>
            </div>
        </motion.div>
    );
}

function InventoryCard({ item, index, onAddStock, onAssign, onViewHistory }: {
    item: InventoryItem;
    index: number;
    onAddStock: () => void;
    onAssign: () => void;
    onViewHistory: () => void;
}) {
    const isLowStock = item.quantity <= item.minQuantity;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className={`group bg-white dark:bg-slate-900 p-6 rounded-3xl border ${isLowStock ? 'border-orange-200 dark:border-orange-900/50' : 'border-slate-200 dark:border-slate-800'} shadow-sm hover:shadow-xl transition-all flex flex-col`}
        >
            <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-2xl ${item.category === 'EPI' ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10' :
                    item.category === 'TECH' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10' :
                        'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'
                    }`}>
                    <Tag className="w-5 h-5" />
                </div>

                <div className="flex gap-2">
                    <button onClick={onViewHistory} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 transition-all">
                        <Clock className="w-4 h-4" />
                    </button>
                    <button onClick={onAddStock} className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl text-slate-400 hover:text-emerald-600 transition-all">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="space-y-1 mb-auto">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {CATEGORY_MAP[item.category] || item.category}
                </p>
                <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight capitalize">{item.name}</h3>
                {item.description && <p className="text-xs text-slate-500 line-clamp-2 mt-2">{item.description}</p>}
            </div>

            <div className="mt-6 flex flex-col gap-4">
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Stock Disponible</p>
                        <div className="flex items-center gap-2">
                            <span className={`text-3xl font-black ${isLowStock ? 'text-orange-600' : 'text-slate-900 dark:text-white'}`}>
                                {item.quantity}
                            </span>
                            {isLowStock && (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase">
                                    <AlertTriangle className="w-3 h-3" />
                                    Bajo
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <button
                    onClick={onAssign}
                    disabled={item.quantity === 0}
                    className="w-full py-3 bg-slate-900 dark:bg-slate-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 group/btn active:scale-95 disabled:opacity-30"
                >
                    Repartir a Trabajador
                    <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </button>
            </div>
        </motion.div>
    );
}
