/**
 * GestoriaConceptsPage — gestión de conceptos dinámicos del periodo.
 *
 * Crear, renombrar, mostrar/ocultar, reordenar, eliminar conceptos.
 *
 * Decisiones:
 *   - Los conceptos se persisten vía API; el estado local se
 *     reordena optimistamente al arrastrar.
 *   - El tipo y el código son INMUTABLES tras la creación (cambiar
 *     el tipo rompería celdas). Se permite renombrar y reordenar.
 *   - Los conceptos `isSystem=true` no se pueden borrar.
 *   - El reordenamiento se hace con flechas (no drag-and-drop) para
 *     mantener el componente accesible y mobile-friendly.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    Eye,
    EyeOff,
    Plus,
    Save,
    Trash2
} from 'lucide-react';
import { toast } from 'sonner';

import { gestoriaApi, type GestoriaConcept, type GestoriaConceptType } from '../api/gestoria';
import { getErrorMessage } from '../api/client';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { useConfirm } from '../context/ConfirmContext';

const TYPES: { value: GestoriaConceptType; label: string; help: string }[] = [
    { value: 'HOURS', label: 'Horas', help: 'Cantidad de horas (ej. H. EXT, H.S/D. EXT)' },
    { value: 'PRICE', label: 'Precio €/h', help: 'Precio por hora' },
    { value: 'AMOUNT', label: 'Importe', help: 'Importe monetario total' },
    { value: 'PERCENT', label: 'Porcentaje', help: 'Porcentaje (0..100)' },
    { value: 'BOOLEAN', label: 'Sí/No', help: 'Valor booleano' },
    { value: 'TEXT', label: 'Texto', help: 'Observación libre' }
];

/**
 * Codigos de plantilla .xls de gestoria soportados para auto-derivar
 * la direccion de celda. El operador los asigna aqui y el export los
 * traduce a columna (D-J en la plantilla estandar de 7 columnas).
 * Si la columna queda vacia, el concepto NO se exporta salvo que se
 * defina manualmente en la pantalla de export.
 */
const GESTORIA_CODES: { value: string; label: string; column: string; help: string }[] = [
    { value: '044', label: '044 Atrasos',      column: 'D', help: 'Columna D en la plantilla .xls' },
    { value: '048', label: '048 Comisión',     column: 'E', help: 'Columna E en la plantilla .xls' },
    { value: '050', label: '050 Producción',   column: 'F', help: 'Columna F en la plantilla .xls' },
    { value: '182', label: '182 Gastos',       column: 'G', help: 'Columna G en la plantilla .xls' },
    { value: '434', label: '434 H.Ext. fest.', column: 'H', help: 'Columna H en la plantilla .xls' },
    { value: '604', label: '604 Dietas',       column: 'I', help: 'Columna I en la plantilla .xls' },
    { value: '791', label: '791 Anticipo sem.',column: 'J', help: 'Columna J en la plantilla .xls' },
];

export default function GestoriaConceptsPage() {
    const { periodId } = useParams<{ periodId: string }>();
    const navigate = useNavigate();
    const confirm = useConfirm();

    const [concepts, setConcepts] = useState<GestoriaConcept[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [newCode, setNewCode] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newType, setNewType] = useState<GestoriaConceptType>('AMOUNT');
    const [newGestoriaCode, setNewGestoriaCode] = useState<string>('');
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingLabel, setEditingLabel] = useState('');

    const load = useCallback(async () => {
        if (!periodId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await gestoriaApi.listConcepts(periodId, true);
            setConcepts((res.data || []).sort((a, b) => a.order - b.order));
        } catch (e) {
            setError(getErrorMessage(e, 'Error'));
        } finally {
            setLoading(false);
        }
    }, [periodId]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        if (!periodId) return;
        if (!newCode.trim() || !newLabel.trim()) {
            toast.error('Código y etiqueta son obligatorios');
            return;
        }
        setCreating(true);
        try {
            await gestoriaApi.createConcept(periodId, {
                code: newCode.trim(),
                label: newLabel.trim(),
                type: newType,
                gestoriaCode: newGestoriaCode || null
            });
            toast.success('Concepto creado');
            setShowCreate(false);
            setNewCode(''); setNewLabel(''); setNewType('AMOUNT'); setNewGestoriaCode('');
            load();
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al crear'));
        } finally {
            setCreating(false);
        }
    };

    const handleUpdateLabel = async (c: GestoriaConcept) => {
        if (!periodId || !editingLabel.trim() || editingLabel === c.label) {
            setEditingId(null);
            return;
        }
        try {
            await gestoriaApi.updateConcept(periodId, c.id, { label: editingLabel.trim() });
            toast.success('Etiqueta actualizada');
            setEditingId(null);
            load();
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al actualizar'));
        }
    };

    const handleUpdateGestoriaCode = async (c: GestoriaConcept, value: string) => {
        if (!periodId) return;
        const next = value === '' ? null : value;
        if (next === c.gestoriaCode) return;
        try {
            await gestoriaApi.updateConcept(periodId, c.id, { gestoriaCode: next });
            // Optimistic local update (no full reload para que el dropdown
            // no se cierre)
            setConcepts((prev) => prev.map((x) => x.id === c.id ? { ...x, gestoriaCode: next } : x));
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al actualizar código de gestoría'));
        }
    };

    const handleToggleVisible = async (c: GestoriaConcept) => {
        if (!periodId) return;
        try {
            await gestoriaApi.updateConcept(periodId, c.id, { isVisible: !c.isVisible });
            load();
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error'));
        }
    };

    const handleReorder = async (c: GestoriaConcept, direction: 'up' | 'down') => {
        if (!periodId) return;
        const idx = concepts.findIndex((x) => x.id === c.id);
        if (idx < 0) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= concepts.length) return;
        const swap = concepts[swapIdx];
        try {
            await Promise.all([
                gestoriaApi.updateConcept(periodId, c.id, { order: swap.order }),
                gestoriaApi.updateConcept(periodId, swap.id, { order: c.order })
            ]);
            load();
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al reordenar'));
        }
    };

    const handleDelete = async (c: GestoriaConcept) => {
        if (!periodId) return;
        const ok = await confirm({
            title: 'Eliminar concepto',
            message: c.isSystem
                ? 'Este es un concepto del sistema y no se puede eliminar.'
                : `¿Eliminar el concepto "${c.label}"? Si tiene celdas con datos, se eliminarán también.`,
            confirmText: c.isSystem ? 'OK' : 'Eliminar',
            type: 'danger'
        });
        if (!ok || c.isSystem) return;
        try {
            await gestoriaApi.deleteConcept(periodId, c.id, true);
            toast.success('Concepto eliminado');
            load();
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al eliminar'));
        }
    };

    if (loading) return <LoadingSpinner label="Cargando conceptos..." />;
    if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;

    return (
        <div className="space-y-4">
            <nav className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                <button onClick={() => navigate('/gestoria')} className="hover:text-indigo-600">Gestoría</button>
                <span>/</span>
                <span>Conceptos</span>
            </nav>

            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Conceptos del periodo</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Los conceptos son las columnas editables del control general. Crea tantos como necesites (dietas, kilometraje, pluses, etc.).
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                    <Plus size={18} /> Nuevo concepto
                </button>
            </header>

            {concepts.length === 0 ? (
                <EmptyState
                    title="Sin conceptos"
                    description="Crea tu primer concepto (por ejemplo, H. EXT) para empezar a registrar valores en el control general."
                />
            ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/50">
                            <tr>
                                <th className="w-16 px-3 py-2">Orden</th>
                                <th className="px-3 py-2">Código</th>
                                <th className="px-3 py-2">Etiqueta</th>
                                <th className="px-3 py-2">Tipo</th>
                                <th className="px-3 py-2">Plantilla .xls</th>
                                <th className="px-3 py-2 text-center">Visible</th>
                                <th className="px-3 py-2 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {concepts.map((c, idx) => (
                                <tr key={c.id}>
                                    <td className="px-3 py-2 text-slate-500">
                                        <div className="flex items-center gap-1">
                                            <button
                                                disabled={idx === 0}
                                                onClick={() => handleReorder(c, 'up')}
                                                className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                                            >
                                                <ArrowUp size={12} />
                                            </button>
                                            <button
                                                disabled={idx === concepts.length - 1}
                                                onClick={() => handleReorder(c, 'down')}
                                                className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                                            >
                                                <ArrowDown size={12} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">{c.code}</td>
                                    <td className="px-3 py-2">
                                        {editingId === c.id ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    value={editingLabel}
                                                    onChange={(e) => setEditingLabel(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateLabel(c)}
                                                    className="rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                                                />
                                                <button
                                                    onClick={() => handleUpdateLabel(c)}
                                                    className="rounded bg-emerald-600 p-1 text-white"
                                                >
                                                    <Save size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setEditingId(c.id); setEditingLabel(c.label); }}
                                                className="text-left text-slate-900 hover:text-indigo-600 dark:text-white"
                                            >
                                                {c.label}
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                        {TYPES.find((t) => t.value === c.type)?.label}
                                    </td>
                                    <td className="px-3 py-2">
                                        <select
                                            value={c.gestoriaCode ?? ''}
                                            onChange={(e) => handleUpdateGestoriaCode(c, e.target.value)}
                                            disabled={c.isSystem}
                                            title={c.isSystem ? 'Concepto del sistema: editable solo en conceptos personalizados' : 'Mapea este concepto a una columna de la plantilla .xls de gestoría'}
                                            className={`rounded-lg border px-2 py-1 text-xs font-mono ${
                                                c.gestoriaCode
                                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                    : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800'
                                            } disabled:opacity-50`}
                                        >
                                            <option value="">— sin mapeo —</option>
                                            {GESTORIA_CODES.map((g) => (
                                                <option key={g.value} value={g.value}>
                                                    {g.label} (col {g.column})
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <button
                                            onClick={() => handleToggleVisible(c)}
                                            className={`rounded-full p-1.5 ${c.isVisible ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                                            title={c.isVisible ? 'Ocultar columna' : 'Mostrar columna'}
                                        >
                                            {c.isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                        </button>
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <button
                                            onClick={() => handleDelete(c)}
                                            disabled={c.isSystem}
                                            className="text-slate-400 hover:text-rose-500 disabled:opacity-30"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nuevo concepto">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Código</label>
                        <input
                            value={newCode}
                            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                            placeholder="H.EXT, DIETAS, BRUTO..."
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                        />
                        <p className="mt-1 text-xs text-slate-500">Identificador único estable (mayúsculas, sin espacios). Se usará en el mapeo a la plantilla .xls.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Etiqueta visible</label>
                        <input
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            placeholder="Horas Extra, Dietas, Bruto..."
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Tipo</label>
                        <select
                            value={newType}
                            onChange={(e) => setNewType(e.target.value as GestoriaConceptType)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                        >
                            {TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label} — {t.help}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                            Plantilla .xls de gestoría
                        </label>
                        <select
                            value={newGestoriaCode}
                            onChange={(e) => setNewGestoriaCode(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                        >
                            <option value="">— sin mapeo (no se exporta) —</option>
                            {GESTORIA_CODES.map((g) => (
                                <option key={g.value} value={g.value}>
                                    {g.label} — columna {g.column}
                                </option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-slate-500">
                            Si lo dejas vacío, el concepto se queda en el control general pero no se incluye en el .xls exportado.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={() => setShowCreate(false)}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={creating}
                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                            {creating ? <LoadingSpinner size="sm" /> : <Plus size={16} />}
                            Crear
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
