import { useState, useMemo } from 'react';
import { api } from '../api/client';
import { Package, Search, AlertTriangle, Plus, Pencil, Trash2, Download } from 'lucide-react';
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
  entryDate?: string;
  unitPrice?: number;
  type?: string;
  brand?: string;
  sku?: string;
  supplier?: string;
  warehouseLocation?: string;
  description?: string;
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
  name: '',
  category: 'OTHER',
  quantity: 0,
  minQuantity: 0,
  size: '',
  entryDate: new Date().toISOString().split('T')[0],
  unitPrice: 0,
  type: '',
  brand: '',
  sku: '',
  supplier: '',
  warehouseLocation: '',
  description: ''
});

const itemToForm = (item: InventoryItem): ItemForm => ({
  name: item.name,
  category: item.category,
  quantity: item.quantity,
  minQuantity: item.minQuantity,
  size: item.size || '',
  entryDate: item.entryDate ? new Date(item.entryDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  unitPrice: item.unitPrice ? Number(item.unitPrice) : 0,
  type: item.type || '',
  brand: item.brand || '',
  sku: item.sku || '',
  supplier: item.supplier || '',
  warehouseLocation: item.warehouseLocation || '',
  description: item.description || ''
});

export default function GlobalAssetsStockTab({ searchTerm, filterCategory }: StockTabProps) {
  const queryClient = useQueryClient();
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [refillItem, setRefillItem] = useState<InventoryItem | null>(null);
  const [refillAmount, setRefillAmount] = useState<number>(0);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [newItem, setNewItem] = useState<ItemForm>(emptyForm());
  const [editForm, setEditForm] = useState<ItemForm>(emptyForm());

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

  const createItemMutation = useMutation({
    mutationFn: async (data: any) => api.post('/inventory', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Producto creado');
      setShowNewItemModal(false);
      setNewItem(emptyForm());
    },
    onError: () => toast.error('Error al crear producto')
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => api.put(`/inventory/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Producto actualizado');
      setShowEditModal(false);
      setEditItem(null);
    },
    onError: () => toast.error('Error al actualizar producto')
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/inventory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Producto eliminado');
      setShowDeleteConfirm(false);
      setDeleteItem(null);
    },
    onError: () => toast.error('Error al eliminar producto')
  });

  const filteredInventory = useMemo(() => {
    return inventory
      .filter((item: InventoryItem) => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = item.name.toLowerCase().includes(searchLower) || 
                          (item.sku && item.sku.toLowerCase().includes(searchLower)) ||
                          (item.brand && item.brand.toLowerCase().includes(searchLower));
        const matchesCategory = filterCategory === 'ALL' || item.category === filterCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a: InventoryItem, b: InventoryItem) => {
        // Stock bajo primero
        const aLow = a.quantity <= a.minQuantity;
        const bLow = b.quantity <= b.minQuantity;
        if (aLow && !bLow) return -1;
        if (!aLow && bLow) return 1;
        return 0;
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

  const handleEdit = (item: InventoryItem) => {
    setEditItem(item);
    setEditForm(itemToForm(item));
    setShowEditModal(true);
  };

  const handleConfirmEdit = () => {
    if (editItem) {
      updateItemMutation.mutate({ id: editItem.id, data: editForm });
    }
  };

  const handleDelete = (item: InventoryItem) => {
    setDeleteItem(item);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deleteItem) {
      deleteItemMutation.mutate(deleteItem.id);
    }
  };

  const renderForm = (form: ItemForm, setForm: (f: ItemForm) => void) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del producto *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          placeholder="Ej: Guantes de protección"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="EPI">EPI</option>
            <option value="TECH">Tecnología</option>
            <option value="TOOL">Herramienta</option>
            <option value="CLOTHING">Ropa</option>
            <option value="OTHER">Otro</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SKU / Referencia</label>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            placeholder="Código de referencia"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Precio unitario (€)</label>
          <input
            type="number"
            step="0.01"
            value={form.unitPrice}
            onChange={(e) => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cantidad</label>
          <input
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            placeholder="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stock mínimo (alerta)</label>
          <input
            type="number"
            value={form.minQuantity}
            onChange={(e) => setForm({ ...form, minQuantity: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            placeholder="5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha de entrada</label>
          <input
            type="date"
            value={form.entryDate}
            onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca</label>
          <input
            type="text"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            placeholder="Ej: 3M, Bosch..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
          <input
            type="text"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            placeholder="Ej: Eléctrico, Manual..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Talla</label>
          <input
            type="text"
            value={form.size}
            onChange={(e) => setForm({ ...form, size: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            placeholder="S, M, L, XL..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ubicación almacén</label>
          <input
            type="text"
            value={form.warehouseLocation}
            onChange={(e) => setForm({ ...form, warehouseLocation: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            placeholder="A-01, Estante 3..."
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Proveedor</label>
        <input
          type="text"
          value={form.supplier}
          onChange={(e) => setForm({ ...form, supplier: e.target.value })}
          className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          placeholder="Nombre del proveedor"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          placeholder="Detalles adicionales..."
          rows={3}
        />
      </div>
    </div>
  );
 
  const handleExportCSV = () => {
    const headers = ['Nombre', 'Categoría', 'Cantidad', 'Stock Mínimo', 'Tamaño', 'SKU', 'Marca', 'Precio Unitario'];
    const rows = filteredInventory.map(item => [
      item.name,
      item.category,
      item.quantity,
      item.minQuantity,
      item.size || '',
      item.sku || '',
      item.brand || '',
      item.unitPrice || 0
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Inventario exportado a CSV');
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Stock Almacén</h2>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl font-bold text-sm touch-active"
          >
            <Download size={18} />
            <span className="sm:inline">Exportar</span>
          </button>
          <button
            onClick={() => setShowNewItemModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl font-bold text-sm touch-active"
          >
            <Plus size={18} />
            <span className="sm:inline">Nuevo Producto</span>
          </button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredInventory.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
          <Package className="w-12 h-12 text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">No hay productos en almacén</p>
          <p className="text-sm text-slate-400 mt-2">Pulsa "Nuevo Producto" para crear el primero.</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {filteredInventory.map((item: InventoryItem) => {
            const isLow = item.quantity <= item.minQuantity;
            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-slate-800/50 rounded-2xl p-6 border-2 transition-all hover:shadow-lg ${
                  isLow ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/20' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    item.category === 'EPI' ? 'bg-amber-100 text-amber-600' :
                    item.category === 'TECH' ? 'bg-purple-100 text-purple-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    <Package size={20} />
                  </div>
                  <div className="flex items-center gap-1">
                    {isLow && <AlertTriangle size={20} className="text-amber-600 animate-pulse" />}
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Editar"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-600 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-1">{item.name}</h3>
                <p className="text-sm text-slate-500 mb-2">Categoría: {item.category}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {item.brand && <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">{item.brand}</span>}
                  {item.size && <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">Talla: {item.size}</span>}
                  {item.sku && <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">SKU: {item.sku}</span>}
                </div>
                {item.unitPrice && Number(item.unitPrice) > 0 && (
                  <p className="text-sm font-medium text-indigo-600 mt-2">{Number(item.unitPrice).toFixed(2)} €</p>
                )}
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
      )}

      {showRefillModal && (
        <>
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-6">
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
        </>
      )}

      {showNewItemModal && (
        <>
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Nuevo Producto</h3>
              {renderForm(newItem, (f) => setNewItem(f))}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNewItemModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => createItemMutation.mutate(newItem)}
                  disabled={!newItem.name || createItemMutation.isPending}
                  className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 text-white font-medium disabled:opacity-50"
                >
                  {createItemMutation.isPending ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showEditModal && editItem && (
        <>
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Editar Producto</h3>
              {renderForm(editForm, (f) => setEditForm(f))}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowEditModal(false); setEditItem(null); }}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmEdit}
                  disabled={!editForm.name || updateItemMutation.isPending}
                  className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 text-white font-medium disabled:opacity-50"
                >
                  {updateItemMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showDeleteConfirm && deleteItem && (
        <>
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Eliminar Producto</h3>
              <p className="text-slate-500 mb-1">¿Estás seguro de que quieres eliminar?</p>
              <p className="font-bold text-slate-900 dark:text-white mb-4">{deleteItem.name}</p>
              <p className="text-sm text-red-500 mb-6">Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteItem(null); }}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteItemMutation.isPending}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white font-medium disabled:opacity-50"
                >
                  {deleteItemMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
