import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Package, Plus, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface Asset {
    id: string;
    category: string;
    name: string;
    serialNumber?: string;
    size?: string;
    assignedDate?: string;
    returnDate?: string;
    status: string;
    notes?: string;
}

export default function EmployeeAssets({ employeeId }: { employeeId: string }) {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [formData, setFormData] = useState({
        category: 'LAPTOP',
        name: '',
        serialNumber: '',
        size: '',
        assignedDate: new Date().toISOString().split('T')[0],
        notes: ''
    });

    useEffect(() => {
        fetchAssets();
    }, [employeeId]);

    const fetchAssets = async () => {
        try {
            const resp = await api.get(`/assets?employeeId=${employeeId}`);
            setAssets(resp.data);
        } catch (error) {
            toast.error('Error al cargar activos');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/assets', { ...formData, employeeId });
            toast.success('Activo asignado');
            setShowAdd(false);
            setFormData({
                category: 'LAPTOP',
                name: '',
                serialNumber: '',
                size: '',
                assignedDate: new Date().toISOString().split('T')[0],
                notes: ''
            });
            fetchAssets();
        } catch (error) {
            toast.error('Error al asignar activo');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este activo?')) return;
        try {
            await api.delete(`/assets/${id}`);
            toast.success('Activo eliminado');
            fetchAssets();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const getCategoryIcon = (cat: string) => {
        switch (cat) {
            case 'CLOTHING': return <Tag className="w-4 h-4" />;
            default: return <Package className="w-4 h-4" />;
        }
    };

    if (loading) return <div>Cargando activos...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Gestión de Activos e Inventario</h3>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Asignar Activo
                </button>
            </div>

            {showAdd && (
                <form onSubmit={handleCreate} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Categoría</label>
                        <select
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                            className="w-full bg-slate-900 border-slate-700 rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="LAPTOP">Portátil / PC</option>
                            <option value="MOBILE">Teléfono Móvil</option>
                            <option value="TOOLS">Herramientas</option>
                            <option value="CLOTHING">Ropa / Uniforme</option>
                            <option value="OTHER">Otro</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Nombre / Modelo</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-slate-900 border-slate-700 rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                            placeholder="Ej: Dell Latitude 5420"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Nº Serie / Identificador</label>
                        <input
                            type="text"
                            value={formData.serialNumber}
                            onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                            className="w-full bg-slate-900 border-slate-700 rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    {formData.category === 'CLOTHING' && (
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Talla</label>
                            <input
                                type="text"
                                value={formData.size}
                                onChange={e => setFormData({ ...formData, size: e.target.value })}
                                className="w-full bg-slate-900 border-slate-700 rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                                placeholder="Ej: M, 42, XL"
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Fecha Asignación</label>
                        <input
                            type="date"
                            value={formData.assignedDate}
                            onChange={e => setFormData({ ...formData, assignedDate: e.target.value })}
                            className="w-full bg-slate-900 border-slate-700 rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs text-slate-400 mb-1">Notas</label>
                        <input
                            type="text"
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full bg-slate-900 border-slate-700 rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                            placeholder="Detalles adicionales..."
                        />
                    </div>
                    <div className="md:col-span-3 flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowAdd(false)}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            Confirmar Asignación
                        </button>
                    </div>
                </form>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-sm">
                            <th className="pb-3 pt-0 font-medium">Elemento</th>
                            <th className="pb-3 pt-0 font-medium">Categoría</th>
                            <th className="pb-3 pt-0 font-medium">Detalles</th>
                            <th className="pb-3 pt-0 font-medium">Fecha</th>
                            <th className="pb-3 pt-0 font-medium">Estado</th>
                            <th className="pb-3 pt-0 font-medium text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {assets.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                                    No hay activos asignados a este empleado
                                </td>
                            </tr>
                        ) : (
                            assets.map(asset => (
                                <tr key={asset.id} className="group hover:bg-slate-800/30 transition-colors">
                                    <td className="py-4">
                                        <div className="font-medium text-white">{asset.name}</div>
                                        <div className="text-xs text-slate-500">{asset.notes}</div>
                                    </td>
                                    <td className="py-4">
                                        <div className="flex items-center gap-2 text-sm text-slate-300">
                                            <span className="p-1.5 bg-slate-800 rounded-lg text-blue-400">
                                                {getCategoryIcon(asset.category)}
                                            </span>
                                            {asset.category}
                                        </div>
                                    </td>
                                    <td className="py-4 text-sm">
                                        {asset.category === 'CLOTHING' ? (
                                            <span className="bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded text-xs font-bold border border-purple-800/50">
                                                Talla: {asset.size || 'N/A'}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">{asset.serialNumber || '-'}</span>
                                        )}
                                    </td>
                                    <td className="py-4 text-sm text-slate-400">
                                        {asset.assignedDate ? new Date(asset.assignedDate).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="py-4">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${asset.status === 'ASSIGNED' ? 'bg-green-900/30 text-green-400 border border-green-800/50' :
                                            'bg-slate-800 text-slate-400'
                                            }`}>
                                            {asset.status}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(asset.id)}
                                            className="p-2 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
