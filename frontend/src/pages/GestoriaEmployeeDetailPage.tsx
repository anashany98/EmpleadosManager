/**
 * GestoriaEmployeeDetailPage — detalle individual de un empleado en
 * un periodo. Sustituye a la "plantilla individual" (PLANTILLA
 * MARCAJE EMPLEADO_24h.xlsx) con un formulario mensual.
 *
 * Por ahora, las horas se introducen manualmente. La estructura
 * queda preparada para que en el futuro se conecte con el sistema
 * de fichajes.
 *
 * Decisiones:
 *   - Lista los conceptos visibles en un formulario vertical
 *     simple (label grande + input). Más fácil de leer y de
 *     imprimir que el grid del control general.
 *   - Debounce 600ms para autosave.
 *   - Permite marcar la fila como revisada.
 *   - Si el periodo está cerrado, todos los inputs están disabled.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Check, Save } from 'lucide-react';
import { toast } from 'sonner';

import {
    gestoriaApi,
    type GestoriaConcept,
    type GestoriaEmployeeRow,
    type GestoriaPeriod
} from '../api/gestoria';
import { getErrorMessage } from '../api/client';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function GestoriaEmployeeDetailPage() {
    const { periodId, employeeId } = useParams<{ periodId: string; employeeId: string }>();
    const navigate = useNavigate();

    const [period, setPeriod] = useState<GestoriaPeriod | null>(null);
    const [concepts, setConcepts] = useState<GestoriaConcept[]>([]);
    const [row, setRow] = useState<GestoriaEmployeeRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [observations, setObservations] = useState('');
    const [isReviewed, setIsReviewed] = useState(false);
    const saveTimer = useRef<NodeJS.Timeout | null>(null);

    const load = useCallback(async () => {
        if (!periodId || !employeeId) return;
        setLoading(true);
        setError(null);
        try {
            const [p, c, r] = await Promise.all([
                gestoriaApi.getPeriod(periodId),
                gestoriaApi.listConcepts(periodId, true),
                gestoriaApi.listRows(periodId, { search: undefined })
            ]);
            setPeriod(p.data);
            setConcepts((c.data || []).filter((x) => x.isVisible).sort((a, b) => a.order - b.order));
            const found = (r.data || []).find((row) => row.employeeId === employeeId);
            if (found) {
                setRow(found);
                setObservations(found.observations || '');
                setIsReviewed(found.isReviewed);
            }
        } catch (e) {
            setError(getErrorMessage(e, 'Error'));
        } finally {
            setLoading(false);
        }
    }, [periodId, employeeId]);

    useEffect(() => { load(); }, [load]);

    const queueSave = useCallback((updater: (prev: GestoriaEmployeeRow) => GestoriaEmployeeRow) => {
        if (!row || !periodId) return;
        const next = updater(row);
        setRow(next);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            setSaving(true);
            try {
                // Persistir celdas
                const cells = (next.cells || []).map((c) => {
                    const concept = concepts.find((x) => x.id === c.conceptId);
                    return {
                        code: concept?.code ?? '',
                        value: c.textValue !== null ? c.textValue : (c.numericValue !== null ? Number(c.numericValue) : null)
                    };
                });
                await gestoriaApi.putCells(periodId, next.id, cells);
            } catch (e) {
                toast.error(getErrorMessage(e, 'Error al guardar'));
            } finally {
                setSaving(false);
            }
        }, 600);
    }, [row, periodId, concepts]);

    const handleCellChange = (conceptId: string, raw: string) => {
        if (!row) return;
        const concept = concepts.find((c) => c.id === conceptId);
        if (!concept) return;
        queueSave((prev) => {
            const cells = (prev.cells || []).filter((c) => c.conceptId !== conceptId);
            if (raw === '' || raw === null) {
                cells.push({ id: `${prev.id}-${conceptId}`, rowId: prev.id, conceptId, numericValue: null, textValue: null, sourceType: null, sourceRefId: null, createdAt: '', updatedAt: '' });
            } else if (concept.type === 'TEXT') {
                cells.push({ id: `${prev.id}-${conceptId}`, rowId: prev.id, conceptId, numericValue: null, textValue: raw, sourceType: null, sourceRefId: null, createdAt: '', updatedAt: '' });
            } else if (concept.type === 'BOOLEAN') {
                const v = raw === '1' || raw === 'true';
                cells.push({ id: `${prev.id}-${conceptId}`, rowId: prev.id, conceptId, numericValue: v ? 1 : 0, textValue: null, sourceType: null, sourceRefId: null, createdAt: '', updatedAt: '' });
            } else {
                const n = Number(raw.replace(',', '.'));
                if (Number.isFinite(n)) {
                    cells.push({ id: `${prev.id}-${conceptId}`, rowId: prev.id, conceptId, numericValue: n, textValue: null, sourceType: null, sourceRefId: null, createdAt: '', updatedAt: '' });
                }
            }
            return { ...prev, cells };
        });
    };

    const saveMeta = async () => {
        if (!row || !periodId) return;
        try {
            await gestoriaApi.updateRow(periodId, row.id, { observations, isReviewed });
            toast.success('Metadatos guardados');
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al guardar'));
        }
    };

    if (loading) return <LoadingSpinner label="Cargando detalle..." />;
    if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
    if (!period) return <EmptyState title="Periodo no encontrado" />;
    if (!row) {
        return (
            <div className="space-y-4">
                <nav className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                    <button onClick={() => navigate('/gestoria')} className="hover:text-indigo-600">Gestoría</button>
                    <span>/</span>
                    <button onClick={() => navigate(`/gestoria/control/${periodId}`)} className="hover:text-indigo-600">Control</button>
                    <span>/</span>
                    <span>Empleado</span>
                </nav>
                <EmptyState
                    title="El empleado no está en este periodo"
                    description="Vuelve al control general y añádelo para empezar a capturar sus datos."
                />
            </div>
        );
    }

    const isClosed = period.status === 'CLOSED';
    const cellMap = new Map((row.cells || []).map((c) => [c.conceptId, c]));

    return (
        <div className="space-y-4">
            <nav className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                <button onClick={() => navigate('/gestoria')} className="hover:text-indigo-600">Gestoría</button>
                <span>/</span>
                <button onClick={() => navigate(`/gestoria/control/${periodId}`)} className="hover:text-indigo-600">Control</button>
                <span>/</span>
                <span>{row.employeeName}</span>
            </nav>

            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{row.employeeName}</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {row.department || '—'} · {row.category || '—'} · {MONTHS[period.month - 1]} {period.year}
                        {saving && <span className="ml-2 text-indigo-500">Guardando…</span>}
                    </p>
                </div>
                <button
                    onClick={() => navigate(`/gestoria/control/${periodId}`)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                >
                    <ArrowLeft size={14} /> Volver al control
                </button>
            </header>

            {isClosed && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Este periodo está cerrado. Para modificar valores, primero reabre el periodo desde la lista de periodos.
                </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Datos del mes</h2>
                <p className="text-xs text-slate-500">Los cambios se guardan automáticamente al dejar de escribir (600ms).</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {concepts.map((c) => {
                        const cell = cellMap.get(c.id);
                        const v = cell?.numericValue !== null && cell?.numericValue !== undefined
                            ? String(cell.numericValue)
                            : (cell?.textValue ?? '');
                        return (
                            <div key={c.id}>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {c.label} <span className="text-xs text-slate-400">({c.type})</span>
                                </label>
                                {c.type === 'BOOLEAN' ? (
                                    <select
                                        value={cell?.numericValue ? '1' : '0'}
                                        onChange={(e) => handleCellChange(c.id, e.target.value === '1' ? 'true' : 'false')}
                                        disabled={isClosed}
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                                    >
                                        <option value="0">No</option>
                                        <option value="1">Sí</option>
                                    </select>
                                ) : c.type === 'TEXT' ? (
                                    <textarea
                                        value={v}
                                        onChange={(e) => handleCellChange(c.id, e.target.value)}
                                        disabled={isClosed}
                                        rows={3}
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={v}
                                        onChange={(e) => handleCellChange(c.id, e.target.value)}
                                        disabled={isClosed}
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-right dark:border-slate-700 dark:bg-slate-800"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Observaciones y revisión</h2>
                <textarea
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    rows={4}
                    placeholder="Observaciones del mes (incidencias, aclaraciones, etc.)"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="mt-3 flex items-center gap-2">
                    <input
                        id="reviewed"
                        type="checkbox"
                        checked={isReviewed}
                        onChange={(e) => setIsReviewed(e.target.checked)}
                    />
                    <label htmlFor="reviewed" className="text-sm text-slate-700 dark:text-slate-200">
                        Marcar como revisado
                    </label>
                </div>
                <button
                    onClick={saveMeta}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                    <Save size={16} /> Guardar metadatos
                </button>
                {isReviewed && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600">
                        <Check size={12} /> Fila revisada
                    </p>
                )}
            </div>
        </div>
    );
}
