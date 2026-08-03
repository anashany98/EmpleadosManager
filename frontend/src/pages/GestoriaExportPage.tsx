/**
 * GestoriaExportPage — previsualización y descarga del .xls.
 *
 * Muestra:
 *  - Estado de la plantilla y de la contraseña
 *  - Mapeo actual (concept → celda) editable
 *  - Mapeos faltantes (conceptos sin dirección asignada)
 *  - Resumen (nº filas, totalAmount)
 *  - Muestra de las primeras filas
 *  - Botón "Generar y descargar" + historial de exports
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
    AlertTriangle,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    Save
} from 'lucide-react';
import { toast } from 'sonner';

import {
    gestoriaApi,
    type GestoriaPeriod,
    type GestoriaExportLog,
    type GestoriaExportPreview
} from '../api/gestoria';
import { getErrorMessage } from '../api/client';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function GestoriaExportPage() {
    const { periodId } = useParams<{ periodId: string }>();
    const navigate = useNavigate();

    const [period, setPeriod] = useState<GestoriaPeriod | null>(null);
    const [preview, setPreview] = useState<GestoriaExportPreview | null>(null);
    const [logs, setLogs] = useState<GestoriaExportLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Mapeo editable (form local). Refleja solo el mapping MANUAL del
    // periodo; el mapping AUTO (derivado de gestoriaCode en cada
    // concepto) se muestra aparte en el preview pero no se puede editar
    // desde aqui — se gestiona en la pantalla de Conceptos.
    const [mappingDraft, setMappingDraft] = useState<Record<string, string>>({});
    const [mappingDirty, setMappingDirty] = useState(false);

    const load = useCallback(async () => {
        if (!periodId) return;
        setLoading(true);
        setError(null);
        try {
            const [p, pv, l] = await Promise.all([
                gestoriaApi.getPeriod(periodId),
                gestoriaApi.previewExport(periodId),
                gestoriaApi.listExportLogs(periodId)
            ]);
            setPeriod(p.data);
            setPreview(pv.data);
            setLogs(l.data || []);
            setMappingDraft(pv.data.manualMapping || {});
            setMappingDirty(false);
        } catch (e) {
            setError(getErrorMessage(e, 'Error al cargar'));
        } finally {
            setLoading(false);
        }
    }, [periodId]);

    useEffect(() => { load(); }, [load]);

    const handleSaveMapping = async () => {
        if (!periodId) return;
        try {
            await gestoriaApi.updatePeriod(periodId, { exportMapping: mappingDraft });
            toast.success('Mapeo guardado');
            setMappingDirty(false);
            load();
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al guardar el mapeo'));
        }
    };

    const handleGenerate = async () => {
        if (!periodId) return;
        setGenerating(true);
        try {
            const res = await gestoriaApi.generateExport(periodId);
            toast.success(`Exportación generada (${res.data.rowCount} filas, ${formatBytes(res.data.fileSize)})`);
            // Disparar descarga automática
            const url = gestoriaApi.downloadExport(periodId, res.data.logId);
            window.open(url, '_blank');
            load();
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al generar la exportación'));
        } finally {
            setGenerating(false);
        }
    };

    const handleDownloadExisting = (logId: string) => {
        if (!periodId) return;
        const url = gestoriaApi.downloadExport(periodId, logId);
        window.open(url, '_blank');
    };

    if (loading) return <LoadingSpinner label="Cargando exportación..." />;
    if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
    if (!period || !preview) return null;

    return (
        <div className="space-y-4">
            <nav className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                <button onClick={() => navigate('/gestoria')} className="hover:text-indigo-600">Gestoría</button>
                <span>/</span>
                <span>Exportar · {MONTHS[period.month - 1]} {period.year}</span>
            </nav>

            <header>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Exportación a gestoría</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Previsualiza y genera el archivo .xls para enviar a la gestoría. La plantilla original nunca se modifica; se copia, se rellena con tus datos y se descarga.
                </p>
            </header>

            {/* Estado de la plantilla */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start gap-3">
                    {preview.templateReady ? (
                        <CheckCircle2 size={20} className="mt-0.5 text-emerald-500" />
                    ) : (
                        <AlertTriangle size={20} className="mt-0.5 text-amber-500" />
                    )}
                    <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {preview.templateReady ? 'Plantilla lista' : 'Plantilla no encontrada'}
                        </p>
                        <p className="text-xs text-slate-500">
                            {preview.templateReady
                                ? `Plantilla cargada desde ${preview.templatePath}`
                                : `Coloque el .xls en ${preview.templatePath}`}
                        </p>
                        {!preview.passwordConfigured && (
                            <p className="text-xs text-amber-600">
                                ⚠ GESTORIA_TEMPLATE_PASSWORD no está definida. Si la plantilla está cifrada, configura esta variable en .env y reinicia el backend.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Mapeo manual (override) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Mapeo a la plantilla .xls</h2>
                        <p className="text-xs text-slate-500">
                            <strong className="text-emerald-600">Automático</strong>: cada concepto con un código de gestoría (044, 048, …) se mapea solo a su columna.
                            Aquí puedes añadir <strong>overrides manuales</strong> para casos especiales (plantilla custom). El mapping manual gana sobre el automático.
                        </p>
                    </div>
                    <button
                        onClick={handleSaveMapping}
                        disabled={!mappingDirty}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                        <Save size={14} /> Guardar mapeo
                    </button>
                </div>

                {/* Auto-derivado de los gestoriaCode */}
                {preview.autoMapping && Object.keys(preview.autoMapping).length > 0 && (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-900/50 dark:bg-emerald-900/20">
                        <p className="font-semibold text-emerald-700 dark:text-emerald-300">Mapeo automático activo (gestoriaCode):</p>
                        <ul className="mt-1 ml-4 list-disc text-emerald-700 dark:text-emerald-300">
                            {Object.entries(preview.autoMapping).map(([code, addr]) => (
                                <li key={code}>
                                    <code className="font-mono">{code}</code> → <code className="font-mono">{addr}</code>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {preview.missingMappings.length > 0 && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        <div>
                            <p className="font-semibold">Conceptos sin mapeo:</p>
                            <p>{preview.missingMappings.join(', ')}</p>
                            <p className="mt-1 text-amber-600">No se incluirán en el .xls. Asígnales un código de gestoría (en Conceptos) o una celda manual aquí.</p>
                        </div>
                    </div>
                )}
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.keys(mappingDraft).sort().map((code) => (
                        <label key={code} className="flex items-center gap-2 text-sm">
                            <span className="w-32 truncate font-mono text-xs text-slate-600 dark:text-slate-300" title={code}>{code}</span>
                            <input
                                value={mappingDraft[code] || ''}
                                onChange={(e) => {
                                    setMappingDraft((prev) => ({ ...prev, [code]: e.target.value.toUpperCase() }));
                                    setMappingDirty(true);
                                }}
                                placeholder="B5, AA10..."
                                className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                            />
                        </label>
                    ))}
                </div>
            </div>

            {/* Resumen + acción */}
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Filas</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{preview.rowCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Total importes</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(preview.totalAmount)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Mapeos faltantes</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{preview.missingMappings.length}</p>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Muestra de la salida</h2>
                <p className="text-xs text-slate-500">Primeras 3 filas con sus celdas calculadas.</p>
                <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-2 py-1 text-left">Celda</th>
                                <th className="px-2 py-1 text-left">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {preview.sample.length === 0 && (
                                <tr><td colSpan={2} className="px-2 py-3 text-center text-slate-400">Sin muestra</td></tr>
                            )}
                            {preview.sample.flatMap((row, ri) => [
                                <tr key={`r${ri}-sep`} className="bg-slate-50 font-semibold dark:bg-slate-800/30">
                                    <td colSpan={2} className="px-2 py-1 text-slate-600 dark:text-slate-300">Fila #{ri + 1}</td>
                                </tr>,
                                ...Object.entries(row.values).map(([addr, val]) => (
                                    <tr key={`r${ri}-${addr}`}>
                                        <td className="px-2 py-0.5 font-mono text-slate-500">{addr}</td>
                                        <td className="px-2 py-0.5 text-slate-900 dark:text-white">{String(val)}</td>
                                    </tr>
                                ))
                            ])}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={handleGenerate}
                    disabled={generating || preview.rowCount === 0 || !preview.templateReady}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                    {generating ? <LoadingSpinner size="sm" /> : <Download size={16} />}
                    Generar y descargar
                </button>
                {preview.rowCount === 0 && (
                    <p className="text-xs text-slate-500">Añade al menos un empleado al periodo para poder exportar.</p>
                )}
            </div>

            {/* Historial */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Historial de exportaciones</h2>
                {logs.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Aún no se ha generado ninguna exportación para este periodo.</p>
                ) : (
                    <table className="mt-2 w-full text-xs">
                        <thead className="text-left text-slate-500">
                            <tr>
                                <th className="py-1">Fecha</th>
                                <th>Archivo</th>
                                <th>Tamaño</th>
                                <th>Filas</th>
                                <th>SHA-256</th>
                                <th>Descargas</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((l) => (
                                <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                                    <td className="py-1">{new Date(l.generatedAt).toLocaleString()}</td>
                                    <td className="font-mono">{l.outputFilename}</td>
                                    <td>{formatBytes(l.fileSize)}</td>
                                    <td>{l.rowCount}</td>
                                    <td className="font-mono text-[10px] text-slate-400" title={l.fileHash}>{l.fileHash.slice(0, 12)}…</td>
                                    <td>{l.downloadCount}</td>
                                    <td>
                                        <button
                                            onClick={() => handleDownloadExisting(l.id)}
                                            className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                                        >
                                            <FileSpreadsheet size={12} /> Re-descargar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatCurrency(n: number | null | undefined): string {
    if (n == null) return '—';
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
}
