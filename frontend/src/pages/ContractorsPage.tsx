import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit, Handshake, Loader2, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../api/client';
import { useApiUnwrap } from '../hooks/useApiUnwrap';
import { useClickOutside } from '../hooks/useClickOutside';

interface Contractor {
    id: string;
    name: string;
    nif: string;
    vatRate: string | number | null;
    irpfRate: string | number | null;
    iban: string | null;
    activity: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

const EMPTY_FORM = {
    name: '',
    nif: '',
    vatRate: '',
    irpfRate: '',
    iban: '',
    activity: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
};

const formatRate = (value: string | number | null) => {
    if (value == null || value === '') return '—';
    const n = Number(value);
    return Number.isFinite(n) ? `${n.toLocaleString('es-ES')}%` : '—';
};

export default function ContractorsPage() {
    const unwrap = useApiUnwrap();
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Contractor | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);

    const fetchContractors = useCallback(async () => {
        try {
            const res = await api.get('/obra-contractors', { params: { limit: 200 } });
            const data = unwrap<Contractor[] | { data?: Contractor[] }>(res);
            setContractors(Array.isArray(data) ? data : (data?.data ?? []));
        } catch (err) {
            toast.error(getErrorMessage(err, 'Error al cargar autónomos'));
        } finally {
            setLoading(false);
        }
    }, [unwrap]);

    useEffect(() => { void fetchContractors(); }, [fetchContractors]);

    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return contractors;
        return contractors.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.nif.toLowerCase().includes(q) ||
                (c.activity || '').toLowerCase().includes(q)
        );
    }, [contractors, searchQuery]);

    const modalRef = useClickOutside<HTMLDivElement>(() => setIsModalOpen(false));

    const openCreate = () => {
        setEditing(null);
        setForm({ ...EMPTY_FORM });
        setIsModalOpen(true);
    };

    const openEdit = (c: Contractor) => {
        setEditing(c);
        setForm({
            name: c.name,
            nif: c.nif,
            vatRate: c.vatRate != null ? String(c.vatRate) : '',
            irpfRate: c.irpfRate != null ? String(c.irpfRate) : '',
            iban: c.iban ?? '',
            activity: c.activity ?? '',
            email: c.email ?? '',
            phone: c.phone ?? '',
            address: c.address ?? '',
            notes: c.notes ?? ''
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const payload = {
            name: form.name.trim(),
            nif: form.nif.trim().toUpperCase(),
            vatRate: form.vatRate !== '' ? Number(form.vatRate) : null,
            irpfRate: form.irpfRate !== '' ? Number(form.irpfRate) : null,
            iban: form.iban.trim() || null,
            activity: form.activity.trim() || null,
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            address: form.address.trim() || null,
            notes: form.notes.trim() || null
        };
        try {
            if (editing) {
                await api.patch(`/obra-contractors/${editing.id}`, payload);
                toast.success('Autónomo actualizado');
            } else {
                await api.post('/obra-contractors', payload);
                toast.success('Autónomo dado de alta');
            }
            setIsModalOpen(false);
            await fetchContractors();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Error al guardar'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleActive = async (c: Contractor) => {
        try {
            await api.patch(`/obra-contractors/${c.id}`, { active: !c.active });
            toast.success(c.active ? 'Autónomo desactivado' : 'Autónomo activado');
            await fetchContractors();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Error al cambiar estado'));
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
                        <Handshake className="text-blue-600" /> Autónomos
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Autónomos y profesionales externos que trabajan en obras. Se imputan como gasto tipo «Autónomo» en cada obra.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                    <Plus size={18} />
                    Nuevo autónomo
                </button>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/60">
                <Search className="text-slate-400" size={18} />
                <input
                    type="text"
                    placeholder="Buscar por nombre, NIF o actividad..."
                    className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {filtered.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <Handshake className="mx-auto mb-3 text-slate-300" size={40} />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {searchQuery ? 'No se encontraron autónomos con esa búsqueda.' : 'Todavía no hay autónomos dados de alta.'}
                    </p>
                    {!searchQuery && (
                        <button type="button" onClick={openCreate} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
                            <Plus size={16} /> Dar de alta el primero
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Autónomo</th>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">NIF/CIF</th>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">IVA / IRPF</th>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Actividad</th>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Contacto</th>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Estado</th>
                                    <th className="p-4 text-right text-xs font-bold uppercase text-slate-500">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filtered.map((c) => (
                                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="p-4">
                                            <div className="font-medium text-slate-900 dark:text-white">{c.name}</div>
                                            {c.iban && <div className="text-xs text-slate-400 font-mono">{c.iban}</div>}
                                        </td>
                                        <td className="p-4 font-mono text-xs text-slate-600 dark:text-slate-300">{c.nif}</td>
                                        <td className="p-4 text-xs text-slate-600 dark:text-slate-300">
                                            <div>IVA {formatRate(c.vatRate)}</div>
                                            <div>IRPF {formatRate(c.irpfRate)}</div>
                                        </td>
                                        <td className="p-4 text-slate-600 dark:text-slate-300">{c.activity || '—'}</td>
                                        <td className="p-4 text-xs text-slate-500 dark:text-slate-400">
                                            {c.phone || '—'}
                                            {c.email ? <div className="truncate max-w-[180px]">{c.email}</div> : null}
                                        </td>
                                        <td className="p-4">
                                            <button
                                                type="button"
                                                onClick={() => void handleToggleActive(c)}
                                                aria-label={c.active ? 'Desactivar autónomo' : 'Activar autónomo'}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${c.active ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                            >
                                                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${c.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                            </button>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button type="button" onClick={() => openEdit(c)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label={`Editar ${c.name}`}>
                                                <Edit size={16} className="text-slate-500" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="space-y-3 md:hidden">
                        {filtered.map((c) => (
                            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-medium text-slate-900 dark:text-white">{c.name}</div>
                                        <div className="text-xs text-slate-400">
                                            <span className="font-mono">{c.nif}</span>
                                            {c.activity ? ` · ${c.activity}` : ''}
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <button type="button" onClick={() => openEdit(c)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label={`Editar ${c.name}`}>
                                            <Edit size={16} className="text-slate-500" />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">IVA {formatRate(c.vatRate)}</span>
                                    <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">IRPF {formatRate(c.irpfRate)}</span>
                                    {c.phone && <span>{c.phone}</span>}
                                    <button
                                        type="button"
                                        onClick={() => void handleToggleActive(c)}
                                        className={`ml-auto rounded-full px-2.5 py-1 font-medium ${c.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}
                                    >
                                        {c.active ? 'Activo' : 'Inactivo'}
                                    </button>
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
                            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
                        >
                            <div className="mb-5 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {editing ? 'Editar autónomo' : 'Dar de alta autónomo'}
                                </h2>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cerrar">
                                    <X size={20} className="text-slate-500" />
                                </button>
                            </div>

                            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="sm:col-span-2">
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre / Razón social *</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Ej: Talleres Pérez S.L. o María García"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">NIF / CIF *</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Ej: 12345678Z o B12345678"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono uppercase text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            value={form.nif}
                                            onChange={(e) => setForm({ ...form, nif: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Actividad / Oficio</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Albañilería, Electricidad..."
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            value={form.activity}
                                            onChange={(e) => setForm({ ...form, activity: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">IVA (%)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            placeholder="Ej: 21"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            value={form.vatRate}
                                            onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Retención IRPF (%)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            placeholder="Ej: 15"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            value={form.irpfRate}
                                            onChange={(e) => setForm({ ...form, irpfRate: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">IBAN</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: ES00 0000 0000 0000 0000 0000"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            value={form.iban}
                                            onChange={(e) => setForm({ ...form, iban: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Teléfono</label>
                                        <input
                                            type="text"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            value={form.phone}
                                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                                        <input
                                            type="email"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            value={form.email}
                                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Dirección</label>
                                        <input
                                            type="text"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            value={form.address}
                                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Notas</label>
                                        <textarea
                                            rows={2}
                                            placeholder="Observaciones (opcional)"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            value={form.notes}
                                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                        />
                                    </div>
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
                                        {editing ? 'Guardar cambios' : 'Dar de alta'}
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
