import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Package, Trash2, Tag, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../../hooks/useConfirm';

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
    const { confirm: confirmDialog } = useConfirm();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAssets();
    }, [employeeId]);

    const fetchAssets = async () => {
        try {
            const resp = await api.get<{ data: Asset[] }>(`/assets?employeeId=${employeeId}`);
            setAssets(resp.data);
        } catch (error) {
            toast.error('Error al cargar activos');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await confirmDialog({
            title: '¿Eliminar este activo?',
            message: 'Esta acción no se puede deshacer.',
            type: 'danger',
            confirmText: 'Eliminar'
        });
        if (!ok) return;
        try {
            await api.delete(`/assets/${id}`);
            toast.success('Activo eliminado');
            fetchAssets();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const handleReturn = async (id: string) => {
        const ok = await confirmDialog({
            title: '¿Devolver este activo al inventario?',
            message: 'El activo volverá a estar disponible para asignar a otros empleados.',
            type: 'info',
            confirmText: 'Devolver'
        });
        if (!ok) return;
        try {
            await api.post(`/assets/${id}/return`);
            toast.success('Activo devuelto al inventario');
            fetchAssets();
        } catch (error) {
            toast.error('Error al devolver el activo');
        }
    };

    const getCategoryIcon = (cat: string) => {
        // CLOTHING se muestra como UNIFORM (categoría fusionada).
        if (cat === 'CLOTHING' || cat === 'UNIFORM') return <Tag className="w-4 h-4" />;
        return <Package className="w-4 h-4" />;
    };

    if (loading) return <div>Cargando activos...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Activos Asignados</h3>
                <span className="text-sm text-slate-500">Gestionar desde Inventario</span>
            </div>

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
                                        {asset.category === 'UNIFORM' || asset.category === 'CLOTHING' ? (
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
                                        <div className="flex items-center justify-end gap-1">
                                            {asset.status === 'ASSIGNED' && (
                                                <button
                                                    onClick={() => handleReturn(asset.id)}
                                                    title="Devolver al inventario"
                                                    className="p-2 text-slate-500 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(asset.id)}
                                                title="Eliminar activo"
                                                className="p-2 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
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
