import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Edit, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';
import { useConfirm } from '../context/ConfirmContext';
import { useClickOutside } from '../hooks/useClickOutside';

interface AbsenceType {
    id: string;
    code: string;
    name: string;
    color: string;
    icon: string;
    description: string | null;
    annualLimitDays: number | null;
    countsForBalance: boolean;
    requiresAttachment: boolean;
    requiresApproval: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

const EMPTY_FORM = {
    code: '',
    name: '',
    color: '#6366f1',
    icon: 'calendar',
    description: '',
    annualLimitDays: '',
    countsForBalance: false,
    requiresAttachment: false,
    requiresApproval: true,
};

export default function AbsenceTypesPage() {
    const confirmAction = useConfirm();
    const [types, setTypes] = useState<AbsenceType[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<AbsenceType | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);

    const fetchTypes = useCallback(async () => {
        try {
            const res = await api.get('/absence-types');
            const list = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
            setTypes(list);
        } catch {
            toast.error('Error al cargar los tipos de ausencia');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchTypes(); }, [fetchTypes]);

    const filteredTypes = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return types;
        return types.filter(
            (t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
        );
    }, [types, searchQuery]);

    const modalRef = useClickOutside<HTMLDivElement>(() => setIsModalOpen(false));

    const openCreate = () => {
        setEditingType(null);
        setForm({ ...EMPTY_FORM });
        setIsModalOpen(true);
    };

    const openEdit = (t: AbsenceType) => {
        setEditingType(t);
        setForm({
            code: t.code,
            name: t.name,
            color: t.color,
            icon: t.icon,
            description: t.description ?? '',
            annualLimitDays: t.annualLimitDays != null ? String(t.annualLimitDays) : '',
            countsForBalance: t.countsForBalance,
            requiresAttachment: t.requiresAttachment,
            requiresApproval: t.requiresApproval,
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const payload = {
            name: form.name.trim(),
            color: form.color,
            icon: form.icon,
            description: form.description.trim() || null,
            annualLimitDays: form.annualLimitDays !== '' ? Number(form.annualLimitDays) : null,
            countsForBalance: form.countsForBalance,
            requiresAttachment: form.requiresAttachment,
            requiresApproval: form.requiresApproval,
        };

        try {
            if (editingType) {
                await api.put(`/absence-types/${editingType.id}`, payload);
                toast.success('Tipo de ausencia actualizado');
            } else {
                await api.post('/absence-types', { ...payload, code: form.code.trim().toUpperCase() });
                toast.success('Tipo de ausencia creado');
            }
            setIsModalOpen(false);
            await fetchTypes();
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Error al guardar';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (t: AbsenceType) => {
        const confirmed = await confirmAction({
            title: 'Eliminar tipo de ausencia',
            message: `¿Eliminar "${t.name}"? Esta acción no se puede deshacer.`,
        });
        if (!confirmed) return;

        try {
            await api.delete(`/absence-types/${t.id}`);
            toast.success('Tipo eliminado');
            await fetchTypes();
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Error al eliminar';
            toast.error(msg);
        }
    };

    const handleToggleActive = async (t: AbsenceType) => {
        try {
            await api.put(`/absence-types/${t.id}`, { isActive: !t.isActive });
            toast.success(t.isActive ? 'Tipo desactivado' : 'Tipo activado');
            await fetchTypes();
        } catch {
            toast.error('Error al cambiar estado');
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tipos de Ausencia</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Configura los tipos de ausencia, sus límites anuales y reglas.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                    <Plus size={18} />
                    Nuevo tipo
                </button>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/60">
                <Search className="text-slate-400" size={18} />
                <input
                    type="text"
                    placeholder="Buscar por nombre o código..."
                    className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {filteredTypes.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <Calendar className="mx-auto mb-3 text-slate-300" size={40} />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {searchQuery ? 'No se encontraron tipos con esa búsqueda.' : 'Todavía no hay tipos de ausencia configurados.'}
                    </p>
                </div>
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Tipo</th>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Límite anual</th>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Reglas</th>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Estado</th>
                                    <th className="p-4 text-right text-xs font-bold uppercase text-slate-500">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredTypes.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: t.color }} />
                                                <div>
                                                    <div className="font-medium text-slate-900 dark:text-white">{t.name}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">{t.code}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
                                            {t.annualLimitDays != null ? `${t.annualLimitDays} días` : 'Sin límite'}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1">
                                                {t.countsForBalance && (
                                                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                        Saldo
                                                    </span>
                                                )}
                                                {t.requiresAttachment && (
                                                    <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                        Justificante
                                                    </span>
                                                )}
                                                {t.requiresApproval && (
                                                    <span className="rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                                        Aprobación
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <button
                                                type="button"
                                                onClick={() => void handleToggleActive(t)}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                                    t.isActive ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'
                                                }`}
                                            >
                                                <span
                                                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                                                        t.isActive ? 'translate-x-4' : 'translate-x-0.5'
                                                    }`}
                                                />
                                            </button>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button type="button" onClick={() => openEdit(t)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700">
                                                    <Edit size={16} className="text-slate-500" />
                                                </button>
                                                <button type="button" onClick={() => void handleDelete(t)} className="rounded-lg p-2 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                    <Trash2 size={16} className="text-red-500" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="space-y-3 md:hidden">
                        {filteredTypes.map((t) => (
                            <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-4 w-4 rounded-full" style={{ backgroundColor: t.color }} />
                                        <div>
                                            <div className="font-medium text-slate-900 dark:text-white">{t.name}</div>
                                            <div className="text-xs text-slate-500">{t.code}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button type="button" onClick={() => openEdit(t)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700">
                                            <Edit size={16} className="text-slate-500" />
                                        </button>
                                        <button type="button" onClick={() => void handleDelete(t)} className="rounded-lg p-2 hover:bg-red-50 dark:hover:bg-red-900/20">
                                            <Trash2 size={16} className="text-red-500" />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1">
                                    <span className="text-xs text-slate-500">
                                        {t.annualLimitDays != null ? `${t.annualLimitDays} días/año` : 'Sin límite'}
                                    </span>
                                    {t.countsForBalance && <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Saldo</span>}
                                    {t.requiresAttachment && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Justificante</span>}
                                    {t.requiresApproval && <span className="rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Aprobación</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    >
                        <motion.div
                            ref={modalRef}
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
                        >
                            <div className="mb-5 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {editingType ? 'Editar tipo de ausencia' : 'Nuevo tipo de ausencia'}
                                </h2>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <X size={20} className="text-slate-500" />
                                </button>
                            </div>

                            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                                {!editingType && (
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Código</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Ej: VACACIONES, BAJA_MEDICA"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            value={form.code}
                                            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                                        />
                                        <p className="mt-1 text-xs text-slate-400">Solo mayúsculas y guiones bajos. No se puede cambiar después.</p>
                                    </div>
                                )}

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Ej: Vacaciones, Baja médica"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Color</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={form.color}
                                                onChange={(e) => setForm({ ...form, color: e.target.value })}
                                                className="h-10 w-10 cursor-pointer rounded-lg border-0"
                                            />
                                            <input
                                                type="text"
                                                value={form.color}
                                                onChange={(e) => setForm({ ...form, color: e.target.value })}
                                                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Límite anual (días)</label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={365}
                                            placeholder="Sin límite"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            value={form.annualLimitDays}
                                            onChange={(e) => setForm({ ...form, annualLimitDays: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Descripción (opcional)</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Descripción visible para los empleados..."
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    />
                                </div>

                                <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={form.countsForBalance}
                                            onChange={(e) => setForm({ ...form, countsForBalance: e.target.checked })}
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        Cuenta para saldo anual
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={form.requiresAttachment}
                                            onChange={(e) => setForm({ ...form, requiresAttachment: e.target.checked })}
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        Requiere justificante
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={form.requiresApproval}
                                            onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })}
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        Requiere aprobación
                                    </label>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {submitting && <Loader2 size={16} className="animate-spin" />}
                                        {editingType ? 'Guardar cambios' : 'Crear tipo'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
