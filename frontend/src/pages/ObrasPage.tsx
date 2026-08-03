import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Briefcase, X, Save, Eye, Search, Filter, Pencil, Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../api/client';
import { useConfirm } from '../context/ConfirmContext';
import { useApiUnwrap } from '../hooks/useApiUnwrap';

const TIPO_LABELS: Record<string, string> = {
    PER_DIEM: 'Dietas',
    LODGING: 'Hospedaje',
    FLIGHT: 'Vuelo',
    TRANSPORT: 'Transporte',
    OTHER: 'Otros'
};

export default function ObrasPage() {
    const navigate = useNavigate();
    const confirmAction = useConfirm();
    const unwrap = useApiUnwrap();
    const [obras, setObras] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [committedSearch, setCommittedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const empty = {
        code: '',
        name: '',
        destination: '',
        clientName: '',
        description: '',
        startDate: '',
        endDate: '',
        budget: '',
        managerId: ''
    };
    const [form, setForm] = useState<any>(empty);

    const fetchObras = async () => {
        try {
            setLoading(true);
            const params: any = { page, limit: 50 };
            if (statusFilter) params.status = statusFilter;
            if (committedSearch) params.q = committedSearch;
            const res = await api.get('/obras', { params });
            const data = unwrap(res);
            const list = Array.isArray(data) ? data : (data?.data ?? []);
            const meta = data?.meta ?? null;
            setObras(list);
            if (meta) {
                setTotalPages(meta.totalPages || 1);
                setTotal(meta.total || list.length);
            } else {
                setTotalPages(1);
                setTotal(list.length);
            }
        } catch (err) {
            console.error(err);
            toast.error('Error al cargar obras');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/employees', { params: { limit: 200 } });
            setEmployees(unwrap(res) || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => { fetchObras(); }, [statusFilter, page, committedSearch]);
    useEffect(() => { fetchEmployees(); }, []);

    const resetForm = () => {
        setForm(empty);
        setEditingId(null);
        setIsAdding(false);
    };

    const handleEdit = (o: any) => {
        setForm({
            code: o.code,
            name: o.name,
            destination: o.destination || '',
            clientName: o.clientName || '',
            description: o.description || '',
            startDate: o.startDate ? String(o.startDate).substring(0, 10) : '',
            endDate: o.endDate ? String(o.endDate).substring(0, 10) : '',
            budget: o.budget ?? '',
            managerId: o.managerId || ''
        });
        setEditingId(o.id);
        setIsAdding(true);
    };

    const handleSave = async () => {
        if (!form.code || !form.name) return toast.error('Código y nombre son obligatorios');
        if (form.startDate && form.endDate && form.startDate > form.endDate) {
            return toast.error('Fecha fin debe ser posterior o igual a fecha inicio');
        }
        try {
            const payload: any = { ...form };
            if (payload.budget === '' || payload.budget == null) delete payload.budget;
            else payload.budget = Number(payload.budget);
            if (!payload.managerId) delete payload.managerId;
            if (!payload.startDate) delete payload.startDate;
            if (!payload.endDate) delete payload.endDate;
            ['destination', 'clientName', 'description'].forEach((k) => { if (!payload[k]) delete payload[k]; });
            if (editingId) {
                await api.patch(`/obras/${editingId}`, payload);
                toast.success('Obra actualizada');
            } else {
                await api.post('/obras', payload);
                toast.success('Obra creada');
            }
            resetForm();
            fetchObras();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Error al guardar'));
        }
    };

    const toggleStatus = async (o: any) => {
        const isClosing = o.status === 'ACTIVE';
        const ok = await confirmAction({
            title: isClosing ? 'Cerrar obra' : 'Reabrir obra',
            message: isClosing
                ? 'Al cerrar la obra no se podrán añadir nuevos gastos. Las correcciones se permitirán.'
                : '¿Reactivar la obra? Se permitirán nuevas imputaciones.',
            confirmText: isClosing ? 'Cerrar' : 'Reabrir',
            type: isClosing ? 'danger' : 'info'
        });
        if (!ok) return;
        try {
            const url = isClosing ? `/obras/${o.id}/close` : `/obras/${o.id}/reopen`;
            await api.post(url);
            toast.success(isClosing ? 'Obra cerrada' : 'Obra reactivada');
            fetchObras();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Error al cambiar el estado'));
        }
    };

    return (
        <div className="space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Briefcase className="text-blue-600" /> Obras
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">Gestiona obras, sus horas y gastos (dietas, hospedaje, vuelos, transporte).</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg flex items-center gap-2 transition-all"
                >
                    <Plus size={20} /> Nueva obra
                </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por código, nombre o cliente..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { setCommittedSearch(search); setPage(1); } }}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                    <option value="">Todos los estados</option>
                    <option value="ACTIVE">Activas</option>
                    <option value="INACTIVE">Cerradas</option>
                </select>
                <button
                    type="button"
                    onClick={() => { setCommittedSearch(search); setPage(1); }}
                    className="px-3 py-2.5 bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center gap-2"
                    aria-label="Aplicar filtros"
                >
                    <Filter size={18} /> Aplicar
                </button>
            </div>

            <AnimatePresence>
                {isAdding && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white dark:bg-slate-900 p-6 rounded-2xl border-2 border-dashed border-blue-500 shadow-xl"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                {editingId ? <Pencil size={20} /> : <Plus size={20} />}
                                {editingId ? 'Editar obra' : 'Nueva obra'}
                            </h3>
                            <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-700" aria-label="Cerrar formulario"><X size={22} /></button>
                        </div>
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSave(); }}
                            // El <form> envuelve los inputs para que Enter y los
                            // labels htmlFor funcionen correctamente (a11y +
                            // submit por teclado). Sin esto los <label> no se
                            // asocian a sus inputs y la búsqueda por nombre
                            // desde teclado estaba rota.
                        >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label htmlFor="obra-code" className="text-xs font-medium text-slate-500">Código *</label>
                                    <input id="obra-code" name="code" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editingId} />
                                </div>
                                <div className="md:col-span-2">
                                    <label htmlFor="obra-name" className="text-xs font-medium text-slate-500">Nombre *</label>
                                    <input id="obra-name" name="name" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                </div>
                                <div className="md:col-span-3">
                                    <label htmlFor="obra-client" className="text-xs font-medium text-slate-500">Cliente</label>
                                    <input id="obra-client" name="clientName" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
                                </div>
                                <div>
                                    <label htmlFor="obra-destination" className="text-xs font-medium text-slate-500">Destino</label>
                                    <input id="obra-destination" name="destination" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
                                </div>
                                <div>
                                    <label htmlFor="obra-start" className="text-xs font-medium text-slate-500">Fecha inicio</label>
                                    <input id="obra-start" name="startDate" type="date" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                                </div>
                                <div>
                                    <label htmlFor="obra-end" className="text-xs font-medium text-slate-500">Fecha fin</label>
                                    <input id="obra-end" name="endDate" type="date" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                                </div>
                                <div>
                                    <label htmlFor="obra-budget" className="text-xs font-medium text-slate-500">Presupuesto (€)</label>
                                    <input id="obra-budget" name="budget" type="number" step="0.01" min="0" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
                                </div>
                                <div>
                                    <label htmlFor="obra-manager" className="text-xs font-medium text-slate-500">Responsable</label>
                                    <select id="obra-manager" name="managerId" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
                                        <option value="">— Ninguno —</option>
                                        {employees.map((e: any) => (
                                            <option key={e.id} value={e.id}>{e.name || `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.dni}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-3">
                                    <label htmlFor="obra-description" className="text-xs font-medium text-slate-500">Descripción</label>
                                    <textarea id="obra-description" name="description" rows={2} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"><Save size={16} /> Guardar</button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
            ) : obras.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                    <Briefcase className="mx-auto text-slate-300 mb-3" size={48} />
                    <p className="text-slate-500">No hay obras que coincidan con los filtros.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {obras.map((o: any) => {
                            const totals: Record<string, number> = o.totals || {};
                            const totalAll = Object.values(totals).reduce((a, b) => Number(a) + Number(b), 0);
                            const closed = o.status === 'INACTIVE';
                            return (
                                // `flex flex-col` + `mt-auto` en el footer empuja los
                                // botones de acción al borde inferior, manteniendo
                                // la fila de cards alineada aunque haya obras sin
                                // gastos (sin bloque de totales).
                                <div key={o.id} className={`flex flex-col bg-white dark:bg-slate-900 rounded-2xl border ${closed ? 'border-slate-200 opacity-75' : 'border-slate-200 dark:border-slate-800'} shadow-sm hover:shadow-md transition-all p-5`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">{o.code}</span>
                                                {closed && <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600">Cerrada</span>}
                                            </div>
                                            <h3 className="font-bold text-slate-900 dark:text-white">{o.name}</h3>
                                            {o.clientName && <p className="text-sm text-slate-500">Cliente: {o.clientName}</p>}
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-500 mb-3 space-y-0.5">
                                        {o.destination && <p>📍 {o.destination}</p>}
                                        {o.startDate && <p>🗓 {String(o.startDate).substring(0, 10)} {o.endDate ? `→ ${String(o.endDate).substring(0, 10)}` : ''}</p>}
                                        {o.budget && <p>💰 Presupuesto: {Number(o.budget).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                                        {Object.entries(totals).map(([t, v]) => (
                                            <div key={t} className="flex justify-between bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">
                                                <span className="text-slate-500">{TIPO_LABELS[t] || t}</span>
                                                <span className="font-semibold">{Number(v).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                            </div>
                                        ))}
                                        {totalAll > 0 && (
                                            <div className="flex justify-between bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded col-span-2">
                                                <span className="text-blue-700 dark:text-blue-300 font-medium">Total</span>
                                                <span className="font-bold text-blue-700 dark:text-blue-300">{totalAll.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-auto flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => navigate(`/obras/${o.id}`)}
                                                className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded text-sm flex items-center gap-1"
                                                title="Ver detalle"
                                            >
                                                <Eye size={14} /> Ver
                                            </button>
                                            <button
                                                onClick={() => handleEdit(o)}
                                                className="text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded text-sm flex items-center gap-1"
                                                title="Editar"
                                            >
                                                <Pencil size={14} /> Editar
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => toggleStatus(o)}
                                            className={`text-sm px-2 py-1 rounded flex items-center gap-1 ${closed ? 'text-emerald-600 hover:bg-emerald-50' : 'text-rose-600 hover:bg-rose-50'}`}
                                        >
                                            {closed ? <><Unlock size={14} /> Reabrir</> : <><Lock size={14} /> Cerrar</>}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-50 text-sm">Anterior</button>
                            <span className="text-sm text-slate-600 dark:text-slate-300">Página {page} de {totalPages} ({total} obras)</span>
                            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-50 text-sm">Siguiente</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
