
import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Database, Archive, Save, Download, Clock, Loader2, HardDrive } from 'lucide-react';

export default function BackupManager() {
    const [backups, setBackups] = useState<{ snapshots: any[], full: any[] }>({ snapshots: [], full: [] });
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState<'SNAPSHOT' | 'FULL' | null>(null);

    const fetchBackups = async () => {
        setLoading(true);
        try {
            const res = await api.get('/config/backups');
            setBackups(res.data || { snapshots: [], full: [] });
        } catch (error) {
            toast.error('Error al cargar copias de seguridad');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBackups();
    }, []);

    const handleCreate = async (type: 'SNAPSHOT' | 'FULL') => {
        setCreating(type);
        try {
            await api.post('/config/backup', { type });
            toast.success('Copia de seguridad creada correctamente');
            fetchBackups();
        } catch (error) {
            toast.error('Error al crear la copia de seguridad');
        } finally {
            setCreating(null);
        }
    };

    const handleDownload = async (filename: string, type: 'SNAPSHOT' | 'FULL') => {
        try {
            const response = await api.get(`/config/backup/download?filename=${filename}&type=${type}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast.error('Error al descargar el archivo');
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Database className="text-emerald-500" size={20} />
                    <h2 className="font-bold text-slate-900 dark:text-white text-lg">Copias de Seguridad y Restauración</h2>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleCreate('SNAPSHOT')}
                        disabled={!!creating}
                        className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors flex items-center gap-2"
                    >
                        {creating === 'SNAPSHOT' ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        Snapshot BD (Rápido)
                    </button>
                    <button
                        onClick={() => handleCreate('FULL')}
                        disabled={!!creating}
                        className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center gap-2"
                    >
                        {creating === 'FULL' ? <Loader2 className="animate-spin" size={16} /> : <Archive size={16} />}
                        Backup Completo
                    </button>
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Snapshots Column */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-500 uppercase flex items-center gap-2">
                        <Clock size={16} />
                        Snapshots Recientes (Base de Datos)
                    </h3>

                    <div className="space-y-2">
                        {loading ? (
                            <div className="p-4 text-center text-slate-400 text-sm">Cargando...</div>
                        ) : backups.snapshots.length === 0 ? (
                            <div className="p-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl text-center text-slate-400 text-sm">
                                No hay snapshots recientes
                            </div>
                        ) : (
                            backups.snapshots.map((backup) => (
                                <div key={backup.name} className="group p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-900/50 bg-white dark:bg-slate-900 transition-all flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400">
                                            <Database size={16} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{new Date(backup.createdAt).toLocaleString()}</p>
                                            <p className="text-[10px] text-slate-400">{formatSize(backup.size)} • {backup.name}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDownload(backup.name, 'SNAPSHOT')}
                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                        title="Descargar"
                                    >
                                        <Download size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Full Backups Column */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-500 uppercase flex items-center gap-2">
                        <HardDrive size={16} />
                        Backups Completos (BD + Archivos)
                    </h3>

                    <div className="space-y-2">
                        {loading ? (
                            <div className="p-4 text-center text-slate-400 text-sm">Cargando...</div>
                        ) : backups.full.length === 0 ? (
                            <div className="p-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl text-center text-slate-400 text-sm">
                                No hay backups completos recientes
                            </div>
                        ) : (
                            backups.full.map((backup) => (
                                <div key={backup.name} className="group p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900/50 bg-white dark:bg-slate-900 transition-all flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                                            <Archive size={16} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{new Date(backup.createdAt).toLocaleString()}</p>
                                            <p className="text-[10px] text-slate-400">{formatSize(backup.size)} • {backup.name}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDownload(backup.name, 'FULL')}
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                        title="Descargar"
                                    >
                                        <Download size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
