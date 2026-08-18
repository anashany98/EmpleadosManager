import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Upload, FileUp, CheckCircle, AlertTriangle, Save, ArrowRight, X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../api/client';
import { useApiUnwrap } from '../hooks/useApiUnwrap';
import { useEffect } from 'react';

const DEFAULT_FIELDS = [
    { key: 'obra_code', label: 'Código de obra', required: true },
    { key: 'employee_dni', label: 'DNI empleado (opcional)', required: false },
    { key: 'type', label: 'Tipo (PER_DIEM/LODGING/FLIGHT/TRANSPORT/OTHER)', required: true },
    { key: 'date', label: 'Fecha', required: true },
    { key: 'amount', label: 'Importe', required: true },
    { key: 'currency', label: 'Moneda', required: false },
    { key: 'description', label: 'Descripción', required: false },
    { key: 'vendor', label: 'Proveedor', required: false },
    { key: 'reference', label: 'Referencia / localizador', required: false },
    { key: 'origin', label: 'Origen (vuelo/transp.)', required: false },
    { key: 'destination', label: 'Destino (vuelo/transp.)', required: false }
] as const;

const TEMPLATE_HEADERS = [
    'obra_code',
    'employee_dni',
    'type',
    'date',
    'amount',
    'currency',
    'description',
    'vendor',
    'reference',
    'origin',
    'destination'
];

const TEMPLATE_SAMPLE_ROW = [
    'OB-001',
    '12345678A',
    'FLIGHT',
    '15/07/2026',
    '120.50',
    'EUR',
    'Vuelo Madrid-Lisboa cliente ACME',
    'Iberia',
    'IB1234',
    'MAD',
    'LIS'
];

type Step = 'UPLOAD' | 'MAP' | 'REVIEW';
type LayoutHint = 'presto' | 'flat' | 'unknown';

interface ObraOption {
    id: string;
    code: string;
    name: string;
}

interface UploadResponse {
    batchId: string;
    headers: string[];
    detectedLayout?: LayoutHint;
    prestoPedidosCount?: number;
}

interface PreviewRow {
    rowIndex: number;
    data?: {
        obraId?: string;
        type?: string;
        date?: string;
        amount?: number;
        currency?: string;
    };
}

interface PreviewResponse {
    totalRows: number;
    validCount: number;
    invalidCount: number;
    invalid: Array<{
        rowIndex: number;
        obraCode?: string;
        originalRef?: string;
        employeeDni?: string;
        warnings: string[];
    }>;
    valid: PreviewRow[];
}

interface CommitResponse {
    inserted: number;
    warningsCount: number;
}

const PRESTO_MAPPING: Record<string, string> = {
    obra_code: '',
    date: '',
    amount: '',
    description: '',
    vendor: '',
    reference: '',
    type: '',
    currency: '',
    employee_dni: '',
    origin: '',
    destination: ''
};

export default function ObraImportPage() {
    useEffect(() => { fetchObras(); }, []);

    const navigate = useNavigate();
    const unwrap = useApiUnwrap();
    const [step, setStep] = useState<Step>('UPLOAD');
    const [file, setFile] = useState<File | null>(null);
    const [batchId, setBatchId] = useState<string | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [preview, setPreview] = useState<PreviewResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [layout, setLayout] = useState<LayoutHint>('flat');
    const [prestoPedidosCount, setPrestoPedidosCount] = useState(0);
    const [obras, setObras] = useState<any[]>([]);
    const [obraOverride, setObraOverride] = useState<string>('');

    const fetchObras = async () => {
        try {
            const res = await api.get('/obras', { params: { limit: 200 } });
            const data = unwrap<{ data?: ObraOption[] } | ObraOption[]>(res);
            setObras(Array.isArray(data) ? data : (data?.data ?? []));
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpload = async () => {
        if (!file) return toast.error('Selecciona un archivo');
        try {
            setLoading(true);
            const formData = new FormData();
            formData.append('file', file);
            if (obraOverride) formData.append('obraOverride', obraOverride);
            const res = await api.post('/obra-imports/upload', formData);
            const data = unwrap<UploadResponse>(res);
            setBatchId(data.batchId);
            setHeaders(data.headers || []);
            const detected: LayoutHint = data.detectedLayout || 'flat';
            setLayout(detected);
            setPrestoPedidosCount(Number(data.prestoPedidosCount) || 0);

            if (detected === 'presto' && Number(data.prestoPedidosCount) > 0) {
                setMapping({ ...PRESTO_MAPPING });
                if (obraOverride) {
                    toast.success(`Detectado formato Presto · ${data.prestoPedidosCount} pedido(s). Se asignarán a la obra seleccionada.`);
                } else {
                    toast.success(`Detectado formato Presto · ${data.prestoPedidosCount} pedido(s). Las referencias del archivo deben existir como obras o selecciona una obra destino arriba.`);
                }
                void runPreview();
            } else {
                setStep('MAP');
                autoMap(data.headers || []);
                toast.success('Archivo subido');
            }
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Error al subir'));
        } finally {
            setLoading(false);
        }
    };

    const runPreview = async () => {
        if (!batchId) return;
        try {
            setLoading(true);
            const res = await api.post(`/obra-imports/${batchId}/preview`, { mappingRules: mapping, obraOverride: obraOverride || null });
            setPreview(unwrap<PreviewResponse>(res));
            setStep('REVIEW');
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Error al previsualizar'));
        } finally {
            setLoading(false);
        }
    };

    const autoMap = (hdrs: string[]) => {
        const candidates: Record<string, string[]> = {
            obra_code: ['obra_code', 'codigo_obra', 'codigo', 'obra', 'code'],
            employee_dni: ['employee_dni', 'dni', 'empleado_dni'],
            type: ['type', 'tipo', 'tipo_gasto'],
            date: ['date', 'fecha'],
            amount: ['amount', 'importe', 'total'],
            currency: ['currency', 'moneda'],
            description: ['description', 'descripcion', 'concepto'],
            vendor: ['vendor', 'proveedor'],
            reference: ['reference', 'referencia', 'localizador'],
            origin: ['origin', 'origen'],
            destination: ['destination', 'destino']
        };
        const m: Record<string, string> = {};
        for (const [field, opts] of Object.entries(candidates)) {
            const hit = hdrs.find((h) => opts.some((o) => h.toLowerCase().replace(/\s+/g, '_') === o));
            if (hit) m[field] = hit;
        }
        setMapping(m);
    };

    const handlePreview = async () => {
        if (!batchId) return;
        try {
            setLoading(true);
            const res = await api.post(`/obra-imports/${batchId}/preview`, { mappingRules: mapping });
            setPreview(unwrap<PreviewResponse>(res));
            setStep('REVIEW');
            toast.success('Vista previa generada');
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Error al generar vista previa'));
        } finally {
            setLoading(false);
        }
    };

    const handleCommit = async () => {
        if (!batchId) return;
        try {
            setLoading(true);
            const res = await api.post(`/obra-imports/${batchId}/commit`, { mappingRules: mapping, obraOverride: obraOverride || null });
            const r = unwrap<CommitResponse>(res);
            toast.success(`Importación completada: ${r.inserted} gastos, ${r.warningsCount} avisos`);
            navigate('/obras');
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Error al confirmar importación'));
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = () => {
        const sep = ';';
        const lines = [
            TEMPLATE_HEADERS.join(sep),
            TEMPLATE_SAMPLE_ROW.join(sep)
        ];
        const csv = '﻿' + lines.join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_gastos_obra.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><FileUp className="text-blue-600" /> Importar gastos de obra</h1>
                    <p className="text-slate-500 text-sm">Sube un Excel con los gastos de dietas, hospedaje, vuelos o transporte.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={downloadTemplate} className="px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm flex items-center gap-1.5 hover:bg-emerald-100">
                        <Download size={16} /> Descargar plantilla
                    </button>
                    <button onClick={() => navigate('/obras')} className="text-slate-500 hover:text-slate-700" aria-label="Cancelar"><X /></button>
                </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
                {(['UPLOAD', 'MAP', 'REVIEW'] as Step[]).map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${step === s ? 'bg-blue-600 text-white' : (['UPLOAD', 'MAP', 'REVIEW'] as Step[]).indexOf(step) > i ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {i + 1}. {s}
                        </div>
                        {i < 2 && <ArrowRight size={14} className="text-slate-400" />}
                    </div>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {step === 'UPLOAD' && (
                    <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                        <Upload className="mx-auto text-blue-500 mb-4" size={48} />
                        <p className="font-semibold mb-2">Subir archivo Excel</p>
                        <p className="text-sm text-slate-500 mb-4">Cabeceras esperadas: obra_code, type, date, amount (mínimo)</p>

                        <div className="max-w-md mx-auto mb-6 text-left">
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                Obra destino <span className="text-slate-400">(opcional, recomendado para Presto)</span>
                            </label>
                            <select
                                value={obraOverride}
                                onChange={(e) => setObraOverride(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm"
                            >
                                <option value="">— Usar el código del archivo (comportamiento por defecto) —</option>
                                {obras.map((o: any) => (
                                    <option key={o.id} value={o.code}>
                                        {o.code} · {o.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-slate-400 mt-1">
                                Si tu archivo trae códigos que no existen en el sistema (p.ej. referencias Presto sin registrar),
                                selecciona aquí la obra a la que se asignarán todos los gastos.
                            </p>
                        </div>

                        <input
                            id="file-input"
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="hidden"
                        />
                        <label htmlFor="file-input" className="cursor-pointer inline-block bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm">
                            {file ? file.name : 'Elegir archivo...'}
                        </label>
                        <button disabled={!file || loading} onClick={handleUpload} className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                            {loading ? 'Subiendo...' : 'Subir'}
                        </button>
                    </motion.div>
                )}

                {step === 'MAP' && (
                    <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <h3 className="font-bold mb-4">Mapeo de columnas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {DEFAULT_FIELDS.map((f) => (
                                <div key={f.key} className="flex items-center gap-3">
                                    <span className="text-sm font-medium w-48 text-slate-700 dark:text-slate-300">
                                        {f.label}{f.required && <span className="text-rose-500 ml-1">*</span>}
                                    </span>
                                    <select
                                        className="flex-1 px-2 py-1.5 border rounded-lg bg-white dark:bg-slate-800"
                                        value={mapping[f.key] || ''}
                                        onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                                    >
                                        <option value="">— Ignorar —</option>
                                        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between mt-6">
                            <button onClick={() => setStep('UPLOAD')} className="px-3 py-2 text-slate-600">← Atrás</button>
                            <button onClick={handlePreview} disabled={loading || !mapping.obra_code || !mapping.type || !mapping.date || !mapping.amount} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                                {loading ? 'Procesando...' : 'Vista previa →'}
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 'REVIEW' && preview && (
                    <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        {layout === 'presto' && (
                            <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500/30 p-4 text-sm text-blue-800 dark:text-blue-200">
                                <strong>Formato Presto detectado</strong> — se han parseado automáticamente {prestoPedidosCount} pedido(s). Los gastos se crearán como <code>LODGING</code>/<code>FLIGHT</code>/etc. según palabras clave de la descripción. No es necesario mapear columnas.
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border"><p className="text-xs text-slate-500">Total filas</p><p className="text-xl font-bold">{preview.totalRows}</p></div>
                            <div className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-xl border border-emerald-200"><p className="text-xs text-emerald-700">Válidas</p><p className="text-xl font-bold text-emerald-700">{preview.validCount}</p></div>
                            <div className="bg-amber-50 dark:bg-amber-900/30 p-4 rounded-xl border border-amber-200"><p className="text-xs text-amber-700">Con avisos</p><p className="text-xl font-bold text-amber-700">{preview.invalidCount}</p></div>
                        </div>

                        {preview.invalidCount > 0 && (
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 p-5">
                                <h3 className="font-bold flex items-center gap-2 text-amber-700 mb-3"><AlertTriangle size={18} /> Filas con avisos (no se importarán)</h3>
                                <div className="max-h-64 overflow-auto text-xs space-y-1">
                                    {preview.invalid.map((w, i: number) => (
                                        <div key={i} className="flex justify-between bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                                            <span className="flex items-center gap-2">
                                                <span>Fila {w.rowIndex}</span>
                                                {w.obraCode && <span className="font-mono text-blue-600">obra={w.obraCode}</span>}
                                                {w.originalRef && w.originalRef !== w.obraCode && (
                                                    <span className="font-mono text-slate-500" title="Referencia original del archivo">← ref={w.originalRef}</span>
                                                )}
                                                {w.employeeDni && <span className="font-mono text-slate-500">dni={w.employeeDni}</span>}
                                            </span>
                                            <span className="font-mono text-rose-600">{w.warnings.join(', ')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-white dark:bg-slate-900 rounded-xl border p-5">
                            <h3 className="font-bold flex items-center gap-2 text-emerald-700 mb-3"><CheckCircle size={18} /> Válidas (muestra de {preview.valid.length})</h3>
                            <div className="max-h-64 overflow-auto text-xs">
                                <table className="w-full">
                                    <thead className="text-slate-500"><tr><th className="text-left">Fila</th><th className="text-left">Obra</th><th className="text-left">Tipo</th><th className="text-left">Fecha</th><th className="text-right">Importe</th></tr></thead>
                                    <tbody>
                                        {preview.valid.map((v) => (
                                            <tr key={v.rowIndex} className="border-t border-slate-100 dark:border-slate-800">
                                                <td className="py-1">{v.rowIndex}</td>
                                                <td className="py-1">{v.data?.obraId?.substring(0, 8)}...</td>
                                                <td className="py-1">{v.data?.type}</td>
                                                <td className="py-1">{String(v.data?.date).substring(0, 10)}</td>
                                                <td className="py-1 text-right font-semibold">{Number(v.data?.amount).toLocaleString('es-ES', { style: 'currency', currency: v.data?.currency || 'EUR' })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <button onClick={() => setStep('MAP')} className="px-3 py-2 text-slate-600">← Ajustar mapeo</button>
                            <button onClick={handleCommit} disabled={loading || preview.validCount === 0} className="px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                                <Save size={16} /> {loading ? 'Importando...' : `Confirmar (${preview.validCount})`}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
