import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { FileText, Plus, Trash2, Edit2, Save, X } from 'lucide-react';

interface FileMapping {
    id: string;
    qrType: string;
    category: string;
    namePattern: string;
}

export default function FileMappingManager() {
    const [mappings, setMappings] = useState<FileMapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<FileMapping>>({});

    useEffect(() => {
        fetchMappings();
    }, []);

    const fetchMappings = async () => {
        try {
            const { data } = await api.get('/mappings/file-mappings'); // Need to ensure this endpoint exists!
            setMappings(data);
        } catch (error) {
            console.error(error);
            // toast.error('Error al cargar mapeos de archivos');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (mapping: FileMapping) => {
        setEditing(mapping.id);
        setFormData(mapping);
    };

    const handleCancel = () => {
        setEditing(null);
        setFormData({});
    };

    const handleSave = async () => {
        try {
            if (editing === 'new') {
                await api.post('/mappings/file-mappings', formData);
                toast.success('Mapeo creado');
            } else {
                await api.put(`/mappings/file-mappings/${editing}`, formData);
                toast.success('Mapeo actualizado');
            }
            setEditing(null);
            setFormData({});
            fetchMappings();
        } catch (error) {
            toast.error('Error al guardar mapeo');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este mapeo?')) return;
        try {
            await api.delete(`/mappings/file-mappings/${id}`);
            toast.success('Mapeo eliminado');
            fetchMappings();
        } catch (error) {
            toast.error('Error al eliminar mapeo');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileText className="text-purple-500" size={20} />
                    <div>
                        <h2 className="font-bold text-slate-900 dark:text-white text-lg">Mapeo de Archivos (QR)</h2>
                        <p className="text-xs text-slate-500">Configura cómo se clasifican los documentos según su código QR</p>
                    </div>
                </div>
                <button
                    onClick={() => { setEditing('new'); setFormData({}); }}
                    disabled={!!editing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg text-sm font-bold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-all disabled:opacity-50"
                >
                    <Plus size={16} />
                    Nuevo Mapeo
                </button>
            </div>

            <div className="p-0 overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">Tipo QR</th>
                            <th className="px-6 py-3">Categoría</th>
                            <th className="px-6 py-3">Patrón de Nombre</th>
                            <th className="px-6 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {loading ? (
                            <tr><td colSpan={4} className="p-6 text-center text-slate-400">Cargando...</td></tr>
                        ) : mappings.length === 0 && !editing ? (
                            <tr><td colSpan={4} className="p-6 text-center text-slate-400">No hay mapeos configurados</td></tr>
                        ) : (
                            <>
                                {mappings.map(mapping => (
                                    <tr key={mapping.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                        {editing === mapping.id ? (
                                            <>
                                                <td className="px-6 py-3">
                                                    <input
                                                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded px-2 py-1 font-mono text-xs"
                                                        value={formData.qrType || ''}
                                                        onChange={e => setFormData({ ...formData, qrType: e.target.value })}
                                                    />
                                                </td>
                                                <td className="px-6 py-3">
                                                    <input
                                                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded px-2 py-1"
                                                        value={formData.category || ''}
                                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                                    />
                                                </td>
                                                <td className="px-6 py-3">
                                                    <input
                                                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded px-2 py-1"
                                                        value={formData.namePattern || ''}
                                                        onChange={e => setFormData({ ...formData, namePattern: e.target.value })}
                                                        placeholder="Ej: Nómina {{date}}"
                                                    />
                                                </td>
                                                <td className="px-6 py-3 text-right space-x-2">
                                                    <button onClick={handleSave} className="text-green-500 hover:text-green-600"><Save size={18} /></button>
                                                    <button onClick={handleCancel} className="text-slate-400 hover:text-slate-500"><X size={18} /></button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{mapping.qrType}</td>
                                                <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{mapping.category}</td>
                                                <td className="px-6 py-3 text-slate-500">{mapping.namePattern}</td>
                                                <td className="px-6 py-3 text-right space-x-2">
                                                    <button onClick={() => handleEdit(mapping)} className="text-blue-500 hover:text-blue-600"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDelete(mapping.id)} className="text-red-500 hover:text-red-600"><Trash2 size={16} /></button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                                {editing === 'new' && (
                                    <tr className="bg-purple-50/50 dark:bg-purple-900/10">
                                        <td className="px-6 py-3">
                                            <input
                                                className="w-full bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded px-2 py-1 font-mono text-xs"
                                                value={formData.qrType || ''}
                                                onChange={e => setFormData({ ...formData, qrType: e.target.value })}
                                                placeholder="Ej: VACATION"
                                                autoFocus
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <input
                                                className="w-full bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded px-2 py-1"
                                                value={formData.category || ''}
                                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                                placeholder="Ej: Ausencia"
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <input
                                                className="w-full bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded px-2 py-1"
                                                value={formData.namePattern || ''}
                                                onChange={e => setFormData({ ...formData, namePattern: e.target.value })}
                                                placeholder="Ej: Justificante {{date}}"
                                            />
                                        </td>
                                        <td className="px-6 py-3 text-right space-x-2">
                                            <button onClick={handleSave} className="text-green-500 hover:text-green-600"><Save size={18} /></button>
                                            <button onClick={handleCancel} className="text-slate-400 hover:text-slate-500"><X size={18} /></button>
                                        </td>
                                    </tr>
                                )}
                            </>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/30 text-xs text-slate-400 flex justify-between">
                <span>Variables disponibles: {'{{date}}'}, {'{{deviceName}}'}</span>
            </div>
        </div>
    );
}
