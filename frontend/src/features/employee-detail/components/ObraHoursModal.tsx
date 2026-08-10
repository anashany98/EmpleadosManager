import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock, HardHat, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../../api/client';
import { useApiUnwrap } from '../../../hooks/useApiUnwrap';

interface ObraHoursModalProps {
    open: boolean;
    onClose: () => void;
    employeeId: string;
    /** Fecha (YYYY-MM-DD) para la que se imputan horas. */
    date: string;
    /** Horas trabajadas ese día (para avisar si se imputa de más). */
    defaultHours: number;
    /** Se llama después de crear/editar/borrar una imputación. */
    onSaved?: () => void;
}

interface Obra {
    id: string;
    code: string;
    name: string;
    destination?: string | null;
}

interface WorkEntry {
    id: string;
    employeeId: string;
    projectId: string;
    startDate: string;
    endDate: string;
    hours: number;
    notes?: string | null;
    project?: {
        id: string;
        code: string;
        name: string;
        destination?: string | null;
    } | null;
}

const formatDate = (value: string) => {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
};

export default function ObraHoursModal({ open, onClose, employeeId, date, defaultHours, onSaved }: ObraHoursModalProps) {
    const unwrap = useApiUnwrap();

    const [obras, setObras] = useState<Obra[]>([]);
    const [entries, setEntries] = useState<WorkEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Formulario
    const [editingId, setEditingId] = useState<string | null>(null);
    const [projectId, setProjectId] = useState('');
    const [hours, setHours] = useState('');
    const [notes, setNotes] = useState('');

    const refresh = useCallback(async () => {
        if (!open) return;
        setLoading(true);
        setLoadError('');
        try {
            const [obrasResponse, entriesResponse] = await Promise.all([
                api.get('/obras', { params: { status: 'ACTIVE', limit: 200 } }),
                api.get(`/employee-project-work/employee/${employeeId}`, { params: { from: date, to: date } })
            ]);
            setObras(unwrap(obrasResponse) || []);
            setEntries(unwrap(entriesResponse) || []);
        } catch (error: unknown) {
            setLoadError(getErrorMessage(error, 'No se pudieron cargar las obras'));
        } finally {
            setLoading(false);
        }
    }, [open, employeeId, date, unwrap]);

    useEffect(() => {
        if (!open) return;
        setEditingId(null);
        setProjectId('');
        setHours(String(defaultHours > 0 ? defaultHours : ''));
        setNotes('');
        setConfirmDeleteId(null);
        void refresh();
    }, [open, refresh, defaultHours]);

    const allocatedHours = useMemo(
        () => entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0),
        [entries]
    );
    const overAllocated = allocatedHours > defaultHours;

    const handleAdd = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!projectId) {
            toast.error('Selecciona una obra');
            return;
        }
        const hoursNumber = Number(String(hours).replace(',', '.'));
        if (!Number.isFinite(hoursNumber) || hoursNumber <= 0) {
            toast.error('Indica un número de horas mayor que 0');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                employeeId,
                projectId,
                startDate: date,
                endDate: date,
                hours: hoursNumber,
                notes: notes.trim() || null
            };
            if (editingId) {
                await api.patch(`/employee-project-work/${editingId}`, {
                    hours: hoursNumber,
                    notes: notes.trim() || null
                });
                toast.success('Horas actualizadas');
            } else {
                await api.post('/employee-project-work', payload);
                toast.success('Horas imputadas a la obra');
            }
            setEditingId(null);
            setProjectId('');
            setHours(String(defaultHours > 0 ? defaultHours : ''));
            setNotes('');
            onSaved?.();
            await refresh();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Error al guardar horas'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id);
            return;
        }
        try {
            await api.delete(`/employee-project-work/${id}`);
            toast.success('Imputación eliminada');
            setConfirmDeleteId(null);
            onSaved?.();
            await refresh();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Error al eliminar'));
        }
    };

    const startEdit = (entry: WorkEntry) => {
        setEditingId(entry.id);
        setProjectId(entry.projectId);
        setHours(String(Number(entry.hours || 0)));
        setNotes(entry.notes || '');
    };

    if (!open) return null;

    const remaining = Math.max(0, defaultHours - allocatedHours);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(event) => event.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <HardHat className="text-amber-500" size={20} />
                        Imputar horas a obra
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors" aria-label="Cerrar">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Cuerpo */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
                        <span className="font-semibold text-slate-900 dark:text-white">{formatDate(date)}</span>
                        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <Clock size={13} /> Trabajadas: <strong>{defaultHours.toFixed(2)} h</strong>
                        </span>
                        <span className={`inline-flex items-center gap-1 ${overAllocated ? 'text-rose-600' : 'text-slate-600 dark:text-slate-300'}`}>
                            Imputadas: <strong>{allocatedHours.toFixed(2)} h</strong>
                        </span>
                        {overAllocated && (
                            <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
                                <AlertTriangle size={13} /> Supera las horas trabajadas
                            </span>
                        )}
                    </div>

                    {loadError && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                            {loadError}
                        </div>
                    )}

                    {/* Formulario */}
                    <form onSubmit={handleAdd} className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px]">
                            <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                Obra
                                <select
                                    value={projectId}
                                    onChange={(event) => setProjectId(event.target.value)}
                                    className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800"
                                >
                                    <option value="">Seleccionar obra...</option>
                                    {obras.map((obra) => (
                                        <option key={obra.id} value={obra.id}>
                                            [{obra.code}] {obra.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                Horas
                                <input
                                    type="number"
                                    min="0.25"
                                    step="0.25"
                                    value={hours}
                                    onChange={(event) => setHours(event.target.value)}
                                    placeholder="0,00"
                                    className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800"
                                />
                            </label>
                        </div>
                        <input
                            type="text"
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Notas (opcional)"
                            className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800"
                        />
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-500">
                                {remaining > 0 ? `Quedan ${remaining.toFixed(2)} h sin imputar del día` : 'Todo el día imputado'}
                            </span>
                            <button
                                type="submit"
                                disabled={saving || loading}
                                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={15} className="animate-spin" /> : editingId ? <Check size={15} /> : <Plus size={15} />}
                                {editingId ? 'Actualizar' : 'Añadir'}
                            </button>
                        </div>
                    </form>

                    {/* Imputaciones del día */}
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Imputaciones de este día</p>
                        {loading ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                                <Loader2 size={16} className="animate-spin" /> Cargando…
                            </div>
                        ) : entries.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-400 dark:border-slate-700">
                                No hay horas imputadas a obras este día.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {entries.map((entry) => (
                                    <li key={entry.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                {entry.project?.name || 'Obra'}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                <span className="font-mono">{entry.project?.code || '—'}</span>
                                                {entry.notes ? ` · ${entry.notes}` : ''}
                                            </p>
                                        </div>
                                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{Number(entry.hours).toFixed(2)} h</span>
                                        <button
                                            type="button"
                                            onClick={() => startEdit(entry)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded transition-colors"
                                            aria-label="Editar"
                                        >
                                            <Pencil size={15} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(entry.id)}
                                            className={`p-1.5 rounded transition-colors ${confirmDeleteId === entry.id ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'}`}
                                            aria-label={confirmDeleteId === entry.id ? 'Confirmar borrado' : 'Eliminar'}
                                            title={confirmDeleteId === entry.id ? 'Pulsa de nuevo para confirmar' : 'Eliminar'}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button onClick={onClose} className="min-h-9 rounded-lg bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
