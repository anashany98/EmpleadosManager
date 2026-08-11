/**
 * GestoriaControlPage — vista "Control general" tipo hoja de cálculo.
 *
 * Por periodo, lista todas las filas (una por empleado) con sus
 * celdas en columnas (una por concepto). Edición in-place con
 * debounce + autosave, búsqueda, selección múltiple, marcar como
 * revisado, totales por columna, navegación al detalle.
 *
 * Decisiones:
 *   - El grid usa el componente genérico <EditableTable>: columnas
 *     dinámicas (una por concepto visible), primera columna sticky
 *     (nombre del empleado siempre visible), totales al pie, group
 *     por categoría, hover de fila, select-all al focus, debounce
 *     de 600ms en el guardado.
 *   - Las celdas se persisten vía `PUT /rows/:rowId/cells` (no
 *     una por una) para reducir round-trips.
 *   - La columna "Revisado" se renderiza con un botón custom via
 *     `render`; al hacer click, llama directo al handler (no pasa
 *     por el flujo value→onChange porque es un toggle, no un valor).
 *   - El drag-and-drop de reordenación de columnas se hace por
 *     separado en `GestoriaConceptsPage`.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
    Check,
    Download,
    Lock,
    Search,
    Settings,
    Users
} from 'lucide-react';
// (Trash2 ya no se importa — el botón papelera lo pinta <EditableTable>)
import { toast } from 'sonner';

import {
    gestoriaApi,
    type GestoriaEmployeeRow,
    type GestoriaConcept,
    type GestoriaPeriod
} from '../api/gestoria';
import { getErrorMessage } from '../api/client';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { EditableTable, type Column } from '../components/ui/EditableTable';
import GestoriaSummaryView from '../components/gestoria/GestoriaSummaryView';
import { useConfirm } from '../context/ConfirmContext';

// ─── Tipos auxiliares para el grid ─────────────────────────────────────

/**
 * Forma "plana" de una fila para pasársela al <EditableTable>.
 * Las columnas dinámicas (una por concepto) usan el `conceptId` como key.
 * `__empleado` / `__departamento` / `__categoria` / `__revisado` son
 * columnas "reservadas" (con prefijo __ para no chocar con un id real).
 */
interface FlatRow {
    id: string;
    __empleado: string;
    __departamento: string;
    __categoria: string;
    __revisado: boolean;
    [conceptId: string]: string | number | boolean | null;
}
/** Convierte una fila del backend a la forma plana. */
function flattenRow(row: GestoriaEmployeeRow, conceptIds: string[]): FlatRow {
    const cellMap = new Map((row.cells || []).map((c) => [c.conceptId, c]));
    const out: FlatRow = {
        id: row.id,
        __empleado: row.employeeName ?? '—',
        __departamento: row.department ?? '—',
        __categoria: row.category ?? '—',
        __revisado: !!row.isReviewed,
    };
    for (const cid of conceptIds) {
        const cell = cellMap.get(cid);
        if (!cell) {
            out[cid] = null;
            continue;
        }
        if (cell.textValue !== null && cell.textValue !== undefined) {
            out[cid] = cell.textValue;
        } else if (cell.numericValue !== null && cell.numericValue !== undefined) {
            out[cid] = cell.numericValue;
        } else {
            out[cid] = null;
        }
    }
    return out;
}

interface CellValue {
    numeric: number | null;
    text: string | null;
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function GestoriaControlPage() {
    const { periodId } = useParams<{ periodId: string }>();
    const navigate = useNavigate();
    const confirm = useConfirm();

    const [period, setPeriod] = useState<GestoriaPeriod | null>(null);
    const [concepts, setConcepts] = useState<GestoriaConcept[]>([]);
    const [rows, setRows] = useState<GestoriaEmployeeRow[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savingRow, setSavingRow] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [showAddEmployee, setShowAddEmployee] = useState(false);
    const [employees, setEmployees] = useState<Array<{ id: string; name: string; department: string | null; category: string | null }>>([]);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'detalle' | 'resumen'>('detalle');

    const visibleConcepts = useMemo(
        () => concepts.filter((c) => c.isVisible).sort((a, b) => a.order - b.order),
        [concepts]
    );

    // Mapas para lookups O(1)
    const conceptById = useMemo(() => new Map(concepts.map((c) => [c.id, c])), [concepts]);
    const visibleConceptIds = useMemo(() => new Set(visibleConcepts.map((c) => c.id)), [visibleConcepts]);

    // Filtro de búsqueda
    const filteredRows = useMemo(() => {
        if (!search.trim()) return rows;
        const s = search.toLowerCase();
        return rows.filter((r) =>
            r.employeeName.toLowerCase().includes(s) ||
            (r.department ?? '').toLowerCase().includes(s) ||
            (r.category ?? '').toLowerCase().includes(s)
        );
    }, [rows, search]);

    // Totales por columna (agrupados por código de concepto, que es como
    // se identifican en el .xls de la gestoría).
    const totalsByCode = useMemo(() => {
        const t: Record<string, number> = {};
        for (const row of rows) {
            if (!row.cells) continue;
            for (const cell of row.cells) {
                if (cell.numericValue == null) continue;
                if (!visibleConceptIds.has(cell.conceptId)) continue;
                const c = conceptById.get(cell.conceptId);
                if (!c) continue;
                if (c.type === 'HOURS' || c.type === 'AMOUNT') {
                    t[c.code] = (t[c.code] ?? 0) + Number(cell.numericValue);
                }
            }
        }
        return t;
    }, [rows, visibleConceptIds, conceptById, visibleConcepts]);

    const load = useCallback(async () => {
        if (!periodId) return;
        setLoading(true);
        setError(null);
        try {
            const [p, c, r] = await Promise.all([
                gestoriaApi.getPeriod(periodId),
                gestoriaApi.listConcepts(periodId, true),
                gestoriaApi.listRows(periodId)
            ]);
            setPeriod(p.data);
            setConcepts(c.data);
            setRows(r.data);
        } catch (e) {
            setError(getErrorMessage(e, 'Error al cargar el periodo'));
        } finally {
            setLoading(false);
        }
    }, [periodId]);

    useEffect(() => { load(); }, [load]);

    // Autosave: cuando una celda cambia, marca la fila como "dirty"
    // y lanza un debounced save. Mantenemos `dirtyRows` como set.
    const dirtyRows = useRef<Set<string>>(new Set());
    const saveTimers = useRef<Record<string, NodeJS.Timeout>>({});

    const flushRow = useCallback(async (rowId: string) => {
        if (!periodId) return;
        const row = rows.find((r) => r.id === rowId);
        if (!row) return;
        setSavingRow(rowId);
        try {
            const cells = (row.cells || []).map((c) => {
                const concept = conceptById.get(c.conceptId);
                return {
                    code: concept?.code ?? '',
                    value: c.textValue !== null ? c.textValue : (c.numericValue !== null ? Number(c.numericValue) : null)
                };
            });
            await gestoriaApi.putCells(periodId, rowId, cells);
            dirtyRows.current.delete(rowId);
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al guardar la fila'));
        } finally {
            setSavingRow(null);
        }
    }, [periodId, rows, conceptById]);

    const queueSave = useCallback((rowId: string) => {
        dirtyRows.current.add(rowId);
        if (saveTimers.current[rowId]) clearTimeout(saveTimers.current[rowId]);
        saveTimers.current[rowId] = setTimeout(() => flushRow(rowId), 600);
    }, [flushRow]);

    /**
     * Maneja el cambio de valor de una celda. Actualiza la copia
     * local y lanza un debounce de guardado.
     */
    const handleCellChange = (rowId: string, conceptId: string, raw: string) => {
        setRows((prev) => prev.map((r) => {
            if (r.id !== rowId) return r;
            const cells = (r.cells || []).filter((c) => c.conceptId !== conceptId);
            const concept = conceptById.get(conceptId);
            if (!concept) return r;
            if (raw === '' || raw === null) {
                cells.push({ id: `${rowId}-${conceptId}`, rowId, conceptId, numericValue: null, textValue: null, sourceType: null, sourceRefId: null, createdAt: '', updatedAt: '' });
            } else if (concept.type === 'TEXT') {
                cells.push({ id: `${rowId}-${conceptId}`, rowId, conceptId, numericValue: null, textValue: raw, sourceType: null, sourceRefId: null, createdAt: '', updatedAt: '' });
            } else if (concept.type === 'BOOLEAN') {
                const v = raw === '1' || raw === 'true';
                cells.push({ id: `${rowId}-${conceptId}`, rowId, conceptId, numericValue: v ? 1 : 0, textValue: null, sourceType: null, sourceRefId: null, createdAt: '', updatedAt: '' });
            } else {
                const n = Number(raw.replace(',', '.'));
                if (Number.isFinite(n)) {
                    cells.push({ id: `${rowId}-${conceptId}`, rowId, conceptId, numericValue: n, textValue: null, sourceType: null, sourceRefId: null, createdAt: '', updatedAt: '' });
                }
            }
            return { ...r, cells };
        }));
        queueSave(rowId);
    };

    const handleReviewedToggle = async (row: GestoriaEmployeeRow) => {
        if (!periodId) return;
        try {
            await gestoriaApi.updateRow(periodId, row.id, { isReviewed: !row.isReviewed });
            setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, isReviewed: !r.isReviewed, reviewedAt: !r.isReviewed ? new Date().toISOString() : null } : r));
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al actualizar'));
        }
    };

    const handleSelectAll = () => {
        if (selected.size === filteredRows.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filteredRows.map((r) => r.id)));
        }
    };

    const handleBulkReviewed = async (isReviewed: boolean) => {
        if (!periodId || selected.size === 0) return;
        try {
            await gestoriaApi.bulk(periodId, {
                operation: 'setReviewed',
                employeeIds: rows.filter((r) => selected.has(r.id)).map((r) => r.employeeId).filter((id): id is string => !!id),
                isReviewed
            });
            // Refetch rows para tener totales y flags
            const r = await gestoriaApi.listRows(periodId);
            setRows(r.data);
            setSelected(new Set());
            toast.success(`${selected.size} filas actualizadas`);
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al aplicar cambio masivo'));
        }
    };

    const handleClosePeriod = async () => {
        if (!periodId) return;
        const ok = await confirm({
            title: 'Cerrar periodo',
            message: 'Una vez cerrado, no se podrán modificar filas, celdas ni conceptos hasta que lo reabras con un motivo. ¿Continuar?',
            confirmText: 'Cerrar',
            type: 'danger'
        });
        if (!ok) return;
        try {
            await gestoriaApi.closePeriod(periodId);
            toast.success('Periodo cerrado');
            load();
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al cerrar el periodo'));
        }
    };

    const loadEmployees = async () => {
        try {
            const api2 = (await import('../api/client')).api;
            const res = await api2.get<{ data: any[] }>('/employees', { params: { limit: 500 } });
            const list = (res.data || []).map((e: any) => ({
                id: e.id,
                name: [e.lastName, e.firstName].filter(Boolean).join(', ') || e.name,
                department: e.department,
                category: e.category
            }));
            setEmployees(list);
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al cargar empleados'));
        }
    };

    const handleAddEmployee = async (employeeId: string) => {
        if (!periodId) return;
        try {
            await gestoriaApi.createRow(periodId, employeeId);
            toast.success('Empleado añadido al periodo');
            setShowAddEmployee(false);
            setEmployeeSearch('');
            const r = await gestoriaApi.listRows(periodId);
            setRows(r.data);
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al añadir empleado'));
        }
    };

    const handleDeleteRow = async (row: GestoriaEmployeeRow) => {
        if (!periodId) return;
        const ok = await confirm({
            title: 'Eliminar fila',
            message: `¿Eliminar la fila de ${row.employeeName}? Se perderán todas sus celdas.`,
            confirmText: 'Eliminar',
            type: 'danger'
        });
        if (!ok) return;
        try {
            await gestoriaApi.deleteRow(periodId, row.id);
            setRows((prev) => prev.filter((r) => r.id !== row.id));
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al eliminar la fila'));
        }
    };

    // ─── Handlers para el <EditableTable> ─────────────────────────────
    //
    // El EditableTable trabaja con `FlatRow` (objetos planos con keys
    // dinámicas por conceptId). Estos handlers traducen los cambios
    // del grid al modelo del backend (GestoriaEmployeeRow.cells[]).

    /**
     * Cambio local en una celda del grid. Actualiza la copia local
     * (en `rows`) y encola un guardado debounced de toda la fila.
     */
    const handleFlatChange = (rowId: string | number, key: string, value: unknown) => {
        // Columnas reservadas: solo se persisten si son editables (ninguna por ahora)
        if (key === '__empleado' || key === '__departamento' || key === '__categoria' || key === '__revisado') {
            return;
        }
        const conceptId = key;
        // Si el valor es null (celda vacía), no hacer nada aquí — la API
        // ya trata null como borrado en putCells.
        // Parsear booleanos desde el select
        let raw: string | number | null = value as string | number | null;
        if (typeof raw === 'string' && (raw === 'true' || raw === 'false')) {
            raw = raw === 'true' ? 1 : 0;
        }
        handleCellChange(String(rowId), conceptId, raw === null ? '' : String(raw));
    };

    /**
     * Persiste la fila al backend. Llamado por el EditableTable tras
     * el debounce al perder foco.
     */
    const handleFlatSave = async (rowId: string | number, _flat: FlatRow) => {
        const rk = String(rowId);
        // El estado de celdas YA está actualizado en `rows` vía handleCellChange
        // (que se llama antes del save por el EditableTable).
        await flushRow(rk);
    };

    /**
     * Elimina la fila (handler del botón papelera del EditableTable).
     */
    const handleFlatDelete = async (rowId: string | number) => {
        const row = rows.find((r) => r.id === String(rowId));
        if (row) await handleDeleteRow(row);
    };

    /**
     * Toggle del check "revisado" desde la celda custom.
     */
    const handleReviewedToggleById = (rowId: string) => {
        const row = rows.find((r) => r.id === rowId);
        if (row) handleReviewedToggle(row);
    };

    // ============ Render ============

    if (loading) return <LoadingSpinner label="Cargando control general..." />;
    if (error) return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
    );
    if (!period) return <EmptyState title="Periodo no encontrado" />;

    const isClosed = period.status === 'CLOSED';
    const periodLabel = `${MONTHS[period.month - 1]} ${period.year}`;

    const filteredEmployees = employees.filter((e) => {
        if (!employeeSearch.trim()) return true;
        return e.name.toLowerCase().includes(employeeSearch.toLowerCase());
    });

    const existingIds = new Set(rows.map((r) => r.employeeId).filter(Boolean));
    const availableEmployees = filteredEmployees.filter((e) => !existingIds.has(e.id));

    return (
        <div className="space-y-4">
            <nav className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                <button onClick={() => navigate('/gestoria')} className="hover:text-indigo-600">Gestoría</button>
                <span>/</span>
                <span>Control · {periodLabel}</span>
            </nav>

            {/* Header */}
            <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Control general
                        {isClosed && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                <Lock size={12} /> Cerrado
                            </span>
                        )}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{periodLabel} · {rows.length} empleados · {visibleConcepts.length} conceptos visibles</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar empleado..."
                            className="rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                        />
                    </div>
                    <button
                        onClick={() => navigate(`/gestoria/concepts/${periodId}`)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                    >
                        <Settings size={16} /> Conceptos
                    </button>
                    <button
                        onClick={() => navigate(`/gestoria/export/${periodId}`)}
                        className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                        <Download size={16} /> Exportar
                    </button>
                    {!isClosed && (
                        <button
                            onClick={handleClosePeriod}
                            className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                        >
                            <Lock size={16} /> Cerrar periodo
                        </button>
                    )}
                </div>
            </header>

            {/* Bulk action toolbar */}
            {selected.size > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm dark:bg-indigo-900/30">
                    <span className="font-semibold text-indigo-700">{selected.size} seleccionadas</span>
                    <button
                        onClick={() => handleBulkReviewed(true)}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                        Marcar revisadas
                    </button>
                    <button
                        onClick={() => handleBulkReviewed(false)}
                        className="rounded-lg bg-slate-600 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-500"
                    >
                        Desmarcar
                    </button>
                    <button
                        onClick={() => setSelected(new Set())}
                        className="ml-auto text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                        Limpiar selección
                    </button>
                </div>
            )}

            {/* Tabs: Detalle (editable) | Resumen (BRUTO/IRPF/TGSS) */}
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => setActiveTab('detalle')}
                    className={[
                        'rounded-t-xl border border-b-0 px-4 py-2 text-sm font-semibold transition-colors',
                        activeTab === 'detalle'
                            ? 'border-slate-200 bg-white text-indigo-700 dark:border-slate-800 dark:bg-slate-900 dark:text-indigo-300'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
                    ].join(' ')}
                >
                    📝 Detalle
                </button>
                <button
                    onClick={() => setActiveTab('resumen')}
                    className={[
                        'rounded-t-xl border border-b-0 px-4 py-2 text-sm font-semibold transition-colors',
                        activeTab === 'resumen'
                            ? 'border-slate-200 bg-white text-indigo-700 dark:border-slate-800 dark:bg-slate-900 dark:text-indigo-300'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
                    ].join(' ')}
                >
                    📊 Resumen
                </button>
            </div>

            {/* Pestaña Detalle: add bar + grid */}
            {activeTab === 'detalle' && (
                <>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Users size={16} /> {rows.length} empleados en el periodo
                </div>
                <button
                    onClick={() => { setShowAddEmployee(true); loadEmployees(); }}
                    disabled={isClosed}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                    + Añadir empleado
                </button>
            </div>

            {/* Grid con EditableTable */}
            {rows.length === 0 ? (
                <EmptyState
                    title="Sin empleados"
                    description="Aún no has añadido empleados a este periodo. Usa el botón superior derecho para empezar."
                />
            ) : (() => {
                const conceptIds = visibleConcepts.map((c) => c.id);
                const flatRows = filteredRows.map((r) => flattenRow(r, conceptIds));

                // Columnas: empleado (sticky) + dept + cat + 1 por concepto + revisado (custom)
                const columns: Column<FlatRow>[] = [
                    { key: '__empleado', header: 'Empleado', type: 'readonly', width: 'minmax(220px, 2fr)' },
                    { key: '__departamento', header: 'Departamento', type: 'readonly', width: '130px' },
                    { key: '__categoria', header: 'Categoría', type: 'readonly', width: '130px' },
                    ...visibleConcepts.map<Column<FlatRow>>((c) => {
                        // Mapeo type del concepto → type del EditableTable
                        let colType: Column<FlatRow>['type'] = 'number';
                        if (c.type === 'TEXT') colType = 'text';
                        else if (c.type === 'BOOLEAN') colType = 'select';
                        else if (c.type === 'PERCENT') colType = 'percent';
                        else if (c.type === 'AMOUNT' || c.type === 'HOURS' || c.type === 'PRICE') colType = 'number';
                        return {
                            key: c.id,
                            header: c.label,
                            type: colType,
                            width: '110px',
                            decimals: c.decimals,
                            // BOOLEAN se renderiza como Sí/No via select con options
                            options: c.type === 'BOOLEAN' ? [
                                { value: 'true', label: 'Sí' },
                                { value: 'false', label: 'No' },
                            ] : undefined,
                        };
                    }),
                    {
                        key: '__revisado',
                        header: 'Revisado',
                        type: 'readonly',  // no editable: el click lo manejamos via render
                        width: '100px',
                        align: 'center',
                        render: (_v, row) => {
                            const isOn = !!row.__revisado;
                            const isSaving = savingRow === row.id;
                            if (isSaving) {
                                return (
                                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
                                );
                            }
                            return (
                                <button
                                    onClick={() => handleReviewedToggleById(row.id)}
                                    disabled={isClosed}
                                    className={`inline-flex items-center justify-center rounded-full p-1 transition-colors ${
                                                        isOn
                                                            ? 'bg-emerald-100 text-emerald-600'
                                                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
                                                    }`}
                                    title={isOn ? 'Quitar marca' : 'Marcar como revisado'}
                                >
                                    <Check size={12} />
                                </button>
                            );
                        },
                    },
                ];

                // Totales para HOURS/AMOUNT
                const totals: Partial<Record<string, number | string>> = { __empleado: 'TOTALES' };
                for (const c of visibleConcepts) {
                    if (c.type === 'HOURS' || c.type === 'AMOUNT') {
                        const t = totalsByCode[c.code];
                        totals[c.id] = t !== undefined ? Number(t.toFixed(c.decimals)) : 0;
                    }
                }

                return (
                    <EditableTable<FlatRow>
                        rows={flatRows}
                        columns={columns}
                        rowKey={(r) => r.id}
                        onChange={handleFlatChange}
                        onSave={handleFlatSave}
                        onDeleteRow={isClosed ? undefined : handleFlatDelete}
                        addRowLabel="Añadir empleado"
                        readOnly={isClosed}
                        saveDelayMs={600}
                        totals={totals}
                        groupBy={(r) => r.__categoria}
                        emptyMessage="No hay empleados que coincidan con la búsqueda."
                    />
                );
            })()}
                </>
            )}

            {/* Pestaña Resumen — cálculo BRUTO/IRPF/TGSS */}
            {activeTab === 'resumen' && (
                <GestoriaSummaryView periodId={periodId!} year={period.year} month={period.month} />
            )}

            <Modal isOpen={showAddEmployee} onClose={() => setShowAddEmployee(false)} title="Añadir empleado al periodo" size="lg">
                <div className="space-y-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            placeholder="Buscar empleado por nombre..."
                            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                        />
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {availableEmployees.length === 0 ? (
                            <p className="py-6 text-center text-sm text-slate-500">No hay empleados disponibles.</p>
                        ) : (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {availableEmployees.slice(0, 100).map((e) => (
                                    <li
                                        key={e.id}
                                        className="flex cursor-pointer items-center justify-between px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        onClick={() => handleAddEmployee(e.id)}
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{e.name}</p>
                                            <p className="text-xs text-slate-500">{e.department || '—'} · {e.category || '—'}</p>
                                        </div>
                                        <span className="text-xs text-indigo-600">+ Añadir</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
