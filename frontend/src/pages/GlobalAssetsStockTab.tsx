import { useState, useMemo, useRef } from 'react';
import { api, getErrorMessage } from '../api/client';
import Modal from '../components/ui/Modal';
import { Package, AlertTriangle, Plus, Pencil, Trash2, Download, Upload, History, ArrowDownCircle, ArrowUpCircle, Image as ImageIcon, LayoutGrid, List, BarChart3, TrendingDown, PackageX } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  size?: string;
  entryDate?: string;
  unitPrice?: number;
  type?: string;
  brand?: string;
  sku?: string;
  supplier?: string;
  warehouseLocation?: string;
  description?: string;
  imageUrl?: string;
}

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  userId?: string;
  employeeId?: string;
  notes?: string;
  createdAt: string;
  inventoryItem?: { name: string };
}

interface StockTabProps {
  searchTerm: string;
  filterCategory: string;
}

interface ItemForm {
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  size: string;
  entryDate: string;
  unitPrice: number;
  type: string;
  brand: string;
  sku: string;
  supplier: string;
  warehouseLocation: string;
  description: string;
}

const emptyForm = (): ItemForm => ({
  name: '', category: 'OTHER', quantity: 0, minQuantity: 0, size: '',
  entryDate: new Date().toISOString().split('T')[0], unitPrice: 0,
  type: '', brand: '', sku: '', supplier: '', warehouseLocation: '', description: ''
});

const itemToForm = (item: InventoryItem): ItemForm => ({
  name: item.name, category: item.category, quantity: item.quantity,
  minQuantity: item.minQuantity, size: item.size || '',
  entryDate: item.entryDate ? new Date(item.entryDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  unitPrice: item.unitPrice ? Number(item.unitPrice) : 0,
  type: item.type || '', brand: item.brand || '', sku: item.sku || '',
  supplier: item.supplier || '', warehouseLocation: item.warehouseLocation || '',
  description: item.description || ''
});

const CATEGORY_LABELS: Record<string, string> = {
  EPI: 'EPI', TECH: 'Tecnologia', DEVICE: 'Tecnologia', TOOL: 'Herramienta', CLOTHING: 'Ropa', UNIFORM: 'Uniforme', OTHER: 'Otro'
};

const CATEGORY_COLORS: Record<string, string> = {
  EPI: 'bg-amber-100 text-amber-700', TECH: 'bg-purple-100 text-purple-700', DEVICE: 'bg-purple-100 text-purple-700',
  TOOL: 'bg-blue-100 text-blue-700', CLOTHING: 'bg-pink-100 text-pink-700',
  UNIFORM: 'bg-indigo-100 text-indigo-700', OTHER: 'bg-gray-100 text-gray-700'
};

export default function GlobalAssetsStockTab({ searchTerm, filterCategory }: StockTabProps) {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [refillAmount, setRefillAmount] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [newItem, setNewItem] = useState<ItemForm>(emptyForm());
  const [editForm, setEditForm] = useState<ItemForm>(emptyForm());
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [movementsItem, setMovementsItem] = useState<InventoryItem | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  // D5: Use ref instead of window global for image upload tracking
  const imageUploadItemIdRef = useRef<string | null>(null);

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => (await api.get<{ data: InventoryItem[] }>('/inventory')).data,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['inventory-movements', movementsItem?.id],
    queryFn: async () => (await api.get<{ data: StockMovement[] }>(`/inventory/${movementsItem!.id}/movements`)).data,
    enabled: !!movementsItem
  });

  const addStockMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => api.post(`/inventory/${id}/stock`, { amount }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Stock anadido'); setShowRefillModal(false); },
    onError: () => toast.error('Error al anadir stock')
  });

  const withdrawMutation = useMutation({
    mutationFn: async ({ id, amount, notes }: { id: string; amount: number; notes: string }) => api.post(`/inventory/${id}/withdraw`, { amount, notes }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Stock retirado'); setShowWithdrawModal(false); setWithdrawAmount(0); setWithdrawNotes(''); },
    onError: (e: unknown) => toast.error(getErrorMessage(e, 'Error al retirar stock'))
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: any) => api.post('/inventory', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Producto creado'); setShowNewItemModal(false); setNewItem(emptyForm()); },
    onError: () => toast.error('Error al crear producto')
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => api.put(`/inventory/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Producto actualizado'); setShowEditModal(false); setEditItem(null); },
    onError: () => toast.error('Error al actualizar')
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/inventory/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Producto eliminado'); setShowDeleteConfirm(false); setDeleteItem(null); },
    onError: () => toast.error('Error al eliminar')
  });

  const imageUploadMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('image', file);
      return api.post(`/inventory/${id}/image`, fd);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Imagen actualizada'); },
    onError: () => toast.error('Error al subir imagen')
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/inventory/import', fd);
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      const msg = res?.message || 'Importacion completada';
      toast.success(msg);
      setShowImportModal(false);
      setImportFile(null);
    },
    onError: () => toast.error('Error al importar CSV')
  });

  const handleEdit = (item: InventoryItem) => {
    setEditItem(item);
    setEditForm(itemToForm(item));
    setShowEditModal(true);
  };

  const handleDelete = (item: InventoryItem) => {
    setDeleteItem(item);
    setShowDeleteConfirm(true);
  };

  const filteredInventory = useMemo(() => {
    return inventory
      .filter((item) => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = item.name.toLowerCase().includes(searchLower) ||
          (item.sku && item.sku.toLowerCase().includes(searchLower)) ||
          (item.brand && item.brand.toLowerCase().includes(searchLower));
        // TECH y DEVICE son la misma categoría (históricamente se usaron ambas)
        const normalize = (c: string) => (c === 'DEVICE' ? 'TECH' : c);
        const matchesCategory = filterCategory === 'ALL' || normalize(item.category) === normalize(filterCategory);
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        const aLow = a.quantity <= a.minQuantity;
        const bLow = b.quantity <= b.minQuantity;
        if (aLow && !bLow) return -1;
        if (!aLow && bLow) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [inventory, searchTerm, filterCategory]);

  const stats = useMemo(() => {
    const totalItems = inventory.reduce((sum, i) => sum + i.quantity, 0);
    const totalValue = inventory.reduce((sum, i) => sum + (Number(i.unitPrice || 0) * i.quantity), 0);
    const lowStock = inventory.filter(i => i.quantity <= i.minQuantity).length;
    const categories = new Set(inventory.map(i => i.category)).size;
    return { totalItems, totalValue, lowStock, categories };
  }, [inventory]);

  const handleExportCSV = () => {
    // Cabeceras compatibles con el importador (alias en InventoryController)
    const headers = ['Nombre', 'Categoria', 'Cantidad', 'Stock Minimo', 'Talla', 'SKU', 'Marca', 'Precio Unitario', 'Proveedor', 'Ubicacion'];
    const rows = filteredInventory.map(item => [
      item.name, item.category, item.quantity, item.minQuantity,
      item.size || '', item.sku || '', item.brand || '', item.unitPrice || 0,
      item.supplier || '', item.warehouseLocation || ''
    ]);
    // Escapado RFC 4180: comillas internas se duplican
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Inventario exportado');
  };

  const renderForm = (form: ItemForm, setForm: (f: ItemForm) => void) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre del producto *</label>
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="Ej: Guantes de proteccion" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Categoria</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100">
            <option value="EPI">EPI</option>
            <option value="TECH">Tecnologia</option>
            <option value="TOOL">Herramienta</option>
            <option value="CLOTHING">Ropa</option>
            <option value="UNIFORM">Uniforme</option>
            <option value="OTHER">Otro</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">SKU / Referencia</label>
          <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="Codigo" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Precio (EUR)</label>
          <input type="number" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Cantidad</label>
          <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Stock min.</label>
          <input type="number" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Marca</label>
          <input type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="3M, Bosch..." />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Talla</label>
          <input type="text" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="S, M, L..." />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Ubicacion</label>
          <input type="text" value={form.warehouseLocation} onChange={(e) => setForm({ ...form, warehouseLocation: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="A-01" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Proveedor</label>
          <input type="text" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha entrada</label>
          <input type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Descripcion</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" rows={2} />
      </div>
    </div>
  );

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100"><Package size={18} className="text-indigo-600" /></div>
            <div><p className="text-[11px] font-medium text-gray-400 uppercase">Total articulos</p><p className="text-xl font-bold text-gray-900">{stats.totalItems}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100"><BarChart3 size={18} className="text-emerald-600" /></div>
            <div><p className="text-[11px] font-medium text-gray-400 uppercase">Valor total</p><p className="text-xl font-bold text-gray-900">{stats.totalValue.toFixed(0)} EUR</p></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100"><TrendingDown size={18} className="text-amber-600" /></div>
            <div><p className="text-[11px] font-medium text-gray-400 uppercase">Stock bajo</p><p className={`text-xl font-bold ${stats.lowStock > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{stats.lowStock}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100"><PackageX size={18} className="text-purple-600" /></div>
            <div><p className="text-[11px] font-medium text-gray-400 uppercase">Categorias</p><p className="text-xl font-bold text-gray-900">{stats.categories}</p></div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <h2 className="text-lg font-bold text-gray-900">Stock de almacen</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')} className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm font-medium transition-colors">
            {viewMode === 'grid' ? <List size={15} /> : <LayoutGrid size={15} />}
            {viewMode === 'grid' ? 'Tabla' : 'Cuadricula'}
          </button>
          <button onClick={() => setShowImportModal(true)} className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm font-medium transition-colors">
            <Upload size={15} /> Importar
          </button>
          <button onClick={handleExportCSV} className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm font-medium transition-colors">
            <Download size={15} /> Exportar
          </button>
          <button onClick={() => setShowNewItemModal(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all">
            <Plus size={15} /> Nuevo
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-16"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-indigo-600" /></div>
      ) : filteredInventory.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-gray-200">
          <Package className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No hay productos</p>
          <p className="text-sm text-gray-400 mt-1">Pulsa "Nuevo" para crear el primero</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredInventory.map((item) => {
            const isLow = item.quantity <= item.minQuantity;
            return (
              <div key={item.id} className={`bg-white rounded-2xl border-2 transition-all hover:shadow-lg overflow-hidden ${isLow ? 'border-amber-400 bg-amber-50/50' : 'border-gray-200'}`}>
                {item.imageUrl ? (
                  <div className="h-32 bg-gray-100 overflow-hidden"><img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /></div>
                ) : (
                  <div className="h-32 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center"><Package size={40} className="text-gray-200" /></div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{item.name}</h3>
                      <span className={`inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.OTHER}`}>{CATEGORY_LABELS[item.category] || item.category}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {isLow && <AlertTriangle size={16} className="text-amber-500 animate-pulse" />}
                      <button onClick={() => handleEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 text-[10px] mb-3">
                    {item.brand && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{item.brand}</span>}
                    {item.size && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{item.size}</span>}
                    {item.sku && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">{item.sku}</span>}
                  </div>
                  {item.unitPrice && Number(item.unitPrice) > 0 && <p className="text-xs font-semibold text-indigo-600 mb-2">{Number(item.unitPrice).toFixed(2)} EUR</p>}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-medium">Stock</p>
                      <p className={`text-lg font-bold ${isLow ? 'text-amber-600' : 'text-gray-900'}`}>{item.quantity}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleOpenImageUpload(item, imageUploadItemIdRef)} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors" title="Subir imagen"><ImageIcon size={14} /></button>
                      <button onClick={() => { setSelectedItem(item); setRefillAmount(0); setShowRefillModal(true); }} className="p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors" title="Anadir stock"><ArrowUpCircle size={14} /></button>
                      <button onClick={() => { setSelectedItem(item); setWithdrawAmount(0); setWithdrawNotes(''); setShowWithdrawModal(true); }} className="p-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors" title="Retirar stock"><ArrowDownCircle size={14} /></button>
                      <button onClick={() => { setMovementsItem(item); setShowMovementsModal(true); }} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors" title="Historial"><History size={14} /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Producto</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Categoria</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Stock</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Min.</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">SKU</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Precio</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Acciones</th>
            </tr></thead>
            <tbody>
              {filteredInventory.map((item) => {
                const isLow = item.quantity <= item.minQuantity;
                return (
                  <tr key={item.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isLow ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-4 py-3"><div className="flex items-center gap-3">{item.imageUrl ? <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover" /> : <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><Package size={14} className="text-gray-400" /></div>}<div><p className="font-semibold text-gray-900">{item.name}</p>{item.brand && <p className="text-[11px] text-gray-400">{item.brand}</p>}</div></div></td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.OTHER}`}>{CATEGORY_LABELS[item.category] || item.category}</span></td>
                    <td className="px-4 py-3 text-center"><span className={`font-bold ${isLow ? 'text-amber-600' : 'text-gray-900'}`}>{item.quantity}</span>{isLow && <AlertTriangle size={12} className="inline ml-1 text-amber-500" />}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{item.minQuantity}</td>
                    <td className="px-4 py-3 font-mono text-gray-500 text-xs">{item.sku || '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{item.unitPrice && Number(item.unitPrice) > 0 ? `${Number(item.unitPrice).toFixed(2)} EUR` : '-'}</td>
                    <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setSelectedItem(item); setRefillAmount(0); setShowRefillModal(true); }} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50" title="Anadir"><ArrowUpCircle size={15} /></button>
                      <button onClick={() => { setSelectedItem(item); setWithdrawAmount(0); setWithdrawNotes(''); setShowWithdrawModal(true); }} className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50" title="Retirar"><ArrowDownCircle size={15} /></button>
                      <button onClick={() => { setMovementsItem(item); setShowMovementsModal(true); }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title="Historial"><History size={15} /></button>
                      <button onClick={() => handleEdit(item)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-indigo-600" title="Editar"><Pencil size={15} /></button>
                      <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600" title="Eliminar"><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Refill Modal */}
      {showRefillModal && selectedItem && (
        <Modal isOpen={true} onClose={() => setShowRefillModal(false)} title="Anadir stock">
          <p className="text-gray-500 mb-3">{selectedItem.name}</p>
          <p className="text-sm text-gray-400 mb-2">Stock actual: <span className="font-bold text-gray-700">{selectedItem.quantity}</span></p>
          <input type="number" min="1" value={refillAmount} onChange={(e) => setRefillAmount(parseInt(e.target.value) || 0)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 mb-4" placeholder="Cantidad a anadir" />
          <div className="flex gap-3">
            <button onClick={() => setShowRefillModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
            <button onClick={() => addStockMutation.mutate({ id: selectedItem.id, amount: refillAmount })} disabled={refillAmount <= 0} className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-40">Confirmar</button>
          </div>
        </Modal>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && selectedItem && (
        <Modal isOpen={true} onClose={() => setShowWithdrawModal(false)} title="Retirar stock">
          <p className="text-gray-500 mb-3">{selectedItem.name}</p>
          <p className="text-sm text-gray-400 mb-2">Stock actual: <span className="font-bold text-gray-700">{selectedItem.quantity}</span></p>
          <input type="number" min="1" max={selectedItem.quantity} value={withdrawAmount} onChange={(e) => setWithdrawAmount(parseInt(e.target.value) || 0)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 mb-3" placeholder="Cantidad a retirar" />
          <input type="text" value={withdrawNotes} onChange={(e) => setWithdrawNotes(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 mb-4" placeholder="Motivo (opcional)" />
          <div className="flex gap-3">
            <button onClick={() => setShowWithdrawModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
            <button onClick={() => withdrawMutation.mutate({ id: selectedItem.id, amount: withdrawAmount, notes: withdrawNotes })} disabled={withdrawAmount <= 0 || withdrawAmount > selectedItem.quantity} className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-white font-semibold disabled:opacity-40">Retirar</button>
          </div>
        </Modal>
      )}

      {/* Movements Modal */}
      {showMovementsModal && movementsItem && (
        <Modal isOpen={true} onClose={() => setShowMovementsModal(false)} title={`Historial: ${movementsItem.name}`} size="lg">
          {movements.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Sin movimientos registrados</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-auto">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${m.type === 'ENTRY' ? 'bg-emerald-100 text-emerald-600' : m.type === 'EXIT' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    {m.type === 'ENTRY' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{m.type === 'ENTRY' ? 'Entrada' : m.type === 'EXIT' ? 'Salida' : 'Asignacion'}: {m.quantity} uds.</p>
                    {m.notes && <p className="text-xs text-gray-400">{m.notes}</p>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleDateString('es-ES')}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* New Item Modal */}
      {showNewItemModal && (
        <Modal isOpen={true} onClose={() => setShowNewItemModal(false)} title="Nuevo producto" size="lg">
          {renderForm(newItem, (f) => setNewItem(f))}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowNewItemModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
            <button onClick={() => createItemMutation.mutate(newItem)} disabled={!newItem.name} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-40">Crear</button>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEditModal && editItem && (
        <Modal isOpen={true} onClose={() => setShowEditModal(false)} title="Editar producto" size="lg">
          {renderForm(editForm, (f) => setEditForm(f))}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
            <button onClick={() => updateItemMutation.mutate({ id: editItem.id, data: editForm })} disabled={!editForm.name} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-40">Guardar</button>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && deleteItem && (
        <Modal isOpen={true} onClose={() => setShowDeleteConfirm(false)} title="Eliminar producto">
          <p className="text-gray-500 mb-1">Seguro que quieres eliminar:</p>
          <p className="font-bold text-gray-900 mb-4">{deleteItem.name}</p>
          <p className="text-sm text-red-500 mb-5">Esta accion no se puede deshacer.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
            <button onClick={() => deleteItemMutation.mutate(deleteItem.id)} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold">Eliminar</button>
          </div>
        </Modal>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <Modal isOpen={true} onClose={() => setShowImportModal(false)} title="Importar CSV">
          <p className="text-sm text-gray-500 mb-4">Sube un CSV con columnas: nombre, categoria, cantidad, minimo, talla, sku, marca, precio, proveedor, ubicacion</p>
          <input type="file" accept=".csv,.txt" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100" />
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowImportModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
            <button onClick={() => importFile && importMutation.mutate(importFile)} disabled={!importFile} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-40">Importar</button>
          </div>
        </Modal>
      )}

      {/* Hidden file input for image upload */}
      <input type="file" accept="image/*" className="hidden" id="image-upload" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file && imageUploadItemIdRef.current) {
          imageUploadMutation.mutate({ id: imageUploadItemIdRef.current, file });
          imageUploadItemIdRef.current = null;
        }
        e.target.value = '';
      }} />
    </>
  );
}

// D5: Moved inside the component scope to use ref instead of window global
function handleOpenImageUpload(item: InventoryItem, ref: React.MutableRefObject<string | null>) {
  ref.current = item.id;
  document.getElementById('image-upload')?.click();
}

// Local Modal removed — using shared ui/Modal with focus trap, Escape, and aria-modal
