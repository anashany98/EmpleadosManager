import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, FileSearch, Loader2, Sparkles, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../api/client';
import type { EmployeeImportField, EmployeeImportPreview, EmployeeImportSuggestion } from '../types';

type ImportStep = 'detect' | 'map' | 'review';

interface EmployeeImportWizardProps {
    isOpen: boolean;
    file: File | null;
    onClose: () => void;
    onImported: () => void;
    onBusyChange?: (busy: boolean) => void;
}

function getConfidenceStyles(confidence: EmployeeImportSuggestion['confidence']) {
    if (confidence === 'high') {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20';
    }

    if (confidence === 'medium') {
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20';
    }

    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20';
}

function buildFormData(file: File, mapping?: Record<string, string>) {
    const formData = new FormData();
    formData.append('file', file);
    if (mapping) {
        formData.append('mapping', JSON.stringify(mapping));
    }
    return formData;
}

export function EmployeeImportWizard({
    isOpen,
    file,
    onClose,
    onImported,
    onBusyChange
}: EmployeeImportWizardProps) {
    const [step, setStep] = useState<ImportStep>('detect');
    const [preview, setPreview] = useState<EmployeeImportPreview | null>(null);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [showAllFields, setShowAllFields] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const busy = loadingPreview || submitting;

    // M2: ref to ignore stale loadPreview responses if a newer request
    // started before the previous one finished. Without this, the
    // second click on "Revisar" can race the first request and the
    // slower response wins, reverting the UI to stale data.
    const previewRequestIdRef = useRef(0);

    useEffect(() => {
        onBusyChange?.(busy);
    }, [busy, onBusyChange]);

    useEffect(() => {
        // M1: reset when closing OR when the file changes (so a new
        // file does not inherit the previous file's preview/mapping).
        if (!isOpen || !file) {
            setStep('detect');
            setPreview(null);
            setMapping({});
            setShowAllFields(false);
            setLoadingPreview(false);
            setSubmitting(false);
            setPreviewError(null);
        }
    }, [isOpen, file]);

    const loadPreview = useCallback(async (targetMapping?: Record<string, string>, nextStep: ImportStep = 'map') => {
        if (!file) return;

        const requestId = ++previewRequestIdRef.current;
        setLoadingPreview(true);
        setPreviewError(null);
        try {
            const response = await api.post('/employees/import/preview', buildFormData(file, targetMapping));
            // Discard stale responses from earlier in-flight requests.
            if (requestId !== previewRequestIdRef.current) return;

            const payload = (response as any).data || response;
            const nextPreview = payload.data || payload;

            setPreview(nextPreview);
            setMapping(nextPreview.currentMapping || {});
            setStep(nextStep);
        } catch (error) {
            if (requestId !== previewRequestIdRef.current) return;
            const message = error instanceof Error ? error.message : 'No se pudo analizar el archivo';
            setPreviewError(message);
            toast.error(message);
        } finally {
            if (requestId === previewRequestIdRef.current) {
                setLoadingPreview(false);
            }
        }
    }, [file]);

    useEffect(() => {
        if (!isOpen || !file) return;
        void loadPreview(undefined, 'map');
    }, [file, isOpen, loadPreview]);

    // M4: re-preview automatically when the mapping changes (debounced).
    // This gives the user immediate feedback as they tweak the column
    // assignments without forcing them to click "Revisar" each time.
    const mappingKey = useMemo(() => JSON.stringify(mapping), [mapping]);
    useEffect(() => {
        if (!isOpen || !file || !preview || step !== 'map') return;
        const timer = setTimeout(() => {
            void loadPreview(mapping, 'map');
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mappingKey, isOpen, file, step]);

    const suggestionMap = useMemo(() => {
        const entries = preview?.suggestions || [];
        return new Map(entries.map((suggestion) => [suggestion.fieldKey, suggestion]));
    }, [preview]);

    const fields = preview?.availableFields || [];

    const visibleFields = useMemo(() => {
        return fields.filter((field) => showAllFields || field.required || !!mapping[field.key]);
    }, [fields, mapping, showAllFields]);

    const groupedFields = useMemo(() => {
        const groups = new Map<string, EmployeeImportField[]>();
        visibleFields.forEach((field) => {
            const current = groups.get(field.group) || [];
            current.push(field);
            groups.set(field.group, current);
        });
        return Array.from(groups.entries());
    }, [visibleFields]);

    const mappedFieldList = useMemo(() => {
        if (!preview) return [] as EmployeeImportField[];
        return preview.availableFields.filter((field) => !!mapping[field.key]);
    }, [mapping, preview]);

    const previewColumns = useMemo(() => {
        if (!preview) return [] as EmployeeImportField[];
        const populatedFields = mappedFieldList.filter((field) => preview.previewRows.some((row) => row.mapped[field.key]));
        // M3: when nothing is populated yet (e.g. a re-preview with a
        // brand-new mapping has not finished), fall back to the mapped
        // field list so the user still sees something useful.
        if (populatedFields.length > 0) return populatedFields;
        if (mappedFieldList.length > 0) return mappedFieldList;
        // Final fallback: show the required fields as a hint.
        return preview.availableFields.filter((field) => field.required);
    }, [mappedFieldList, preview]);

    // M5: stricter review guard. DNI + firstName is enough to create
    // an employee, but if the user mapped firstName without lastName
    // (or used a single fullName column) we should surface a soft
    // warning so the import matches the real-world naming convention.
    const hasNameMapping = !!(mapping.fullName || mapping.firstName);
    const canReview = !!mapping.dni && hasNameMapping;

    const handleMappingChange = (fieldKey: string, header: string) => {
        setMapping((current) => {
            const next = Object.fromEntries(
                Object.entries(current).filter(([currentFieldKey, currentHeader]) => currentFieldKey === fieldKey || currentHeader !== header)
            );
            if (!header) {
                delete next[fieldKey];
            } else {
                next[fieldKey] = header;
            }
            return next;
        });
    };

    const handleReview = async () => {
        if (!canReview) {
            toast.error('Asigna al menos el DNI y una columna de nombre antes de continuar.');
            return;
        }

        // M5: soft warning when the user mapped firstName but not
        // lastName (or vice versa). The import would still succeed
        // but the resulting employee name field would be the
        // concatenation of both, which is rarely what the user
        // actually wants.
        if (mapping.firstName && !mapping.lastName && !mapping.fullName) {
            toast('Tip: solo has mapeado "Nombre". Si tu Excel tiene apellidos en otra columna, mapéalos a "Apellidos" para mejorar la calidad del dato.', { icon: '💡' });
        } else if (mapping.lastName && !mapping.firstName && !mapping.fullName) {
            toast('Tip: solo has mapeado "Apellidos". Si tu Excel tiene nombre en otra columna, mapéalo a "Nombre".', { icon: '💡' });
        }

        await loadPreview(mapping, 'review');
    };

    const handleImport = async () => {
        if (!file) return;
        if (!canReview) {
            toast.error('La importacion necesita como minimo DNI y nombre.');
            return;
        }

        setSubmitting(true);
        try {
            const response = await api.post('/employees/import', buildFormData(file, mapping));
            const payload = response.data || response;
            const result = payload.data || payload;
            const importedCount = result.importedCount || 0;
            const errors = Array.isArray(result.errors) ? result.errors : [];

            if (errors.length > 0) {
                toast.success(`Importados ${importedCount} empleados.`);
                toast.error(errors.slice(0, 3).join(' | '));
            } else {
                toast.success(payload.message || `Importados ${importedCount} empleados.`);
            }

            onImported();
            onClose();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error al importar empleados';
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !file) return null;

    return (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm p-4 md:p-6 flex items-center justify-center">
            <div className="bg-white dark:bg-slate-900 w-full max-w-7xl max-h-[92vh] rounded-[2rem] shadow-2xl border border-slate-200/70 dark:border-slate-800 overflow-hidden flex flex-col">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/70 dark:bg-slate-950/40">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                                <UploadCloud size={22} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Importar empleados con revision previa</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{file.name}</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            <span className={`px-3 py-1 rounded-full border ${step === 'detect' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 dark:border-slate-700'}`}>
                                1. Analizar
                            </span>
                            <span className={`px-3 py-1 rounded-full border ${step === 'map' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 dark:border-slate-700'}`}>
                                2. Mapear
                            </span>
                            <span className={`px-3 py-1 rounded-full border ${step === 'review' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 dark:border-slate-700'}`}>
                                3. Revisar
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                        aria-label="Cerrar importacion"
                    >
                        <X size={22} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
                    {!preview || loadingPreview && step === 'detect' ? (
                        previewError && !loadingPreview ? (
                            <div className="h-full min-h-[420px] flex flex-col items-center justify-center gap-4 px-6 text-center">
                                <div className="w-20 h-20 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-300">
                                    <AlertTriangle size={34} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">No se pudo analizar el archivo</h3>
                                    <p className="text-sm text-rose-700 dark:text-rose-300 mt-1 max-w-md">{previewError}</p>
                                    <button
                                        type="button"
                                        onClick={() => void loadPreview(undefined, 'map')}
                                        className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full min-h-[420px] flex flex-col items-center justify-center gap-4 px-6 text-center">
                                <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-300">
                                    <Loader2 size={34} className="animate-spin" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Analizando columnas y formatos</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        Detecto automaticamente los campos, reviso la estructura del archivo y preparo una vista previa antes de importar.
                                    </p>
                                </div>
                            </div>
                        )
                    ) : null}

                    {preview && step === 'map' ? (
                        <div className="p-6 md:p-8 space-y-6">
                            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.8fr] gap-6 items-start">
                                <div className="bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                <Sparkles size={18} className="text-blue-500" />
                                                Mapeo detectado automaticamente
                                            </h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                Revisa cada campo antes de generar la vista previa final.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setShowAllFields((current) => !current)}
                                            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            {showAllFields ? 'Ocultar opcionales' : 'Mostrar mas campos'}
                                        </button>
                                    </div>

                                    <div className="max-h-[56vh] overflow-auto divide-y divide-slate-100 dark:divide-slate-800">
                                        {groupedFields.map(([group, groupFields]) => (
                                            <div key={group} className="p-6 space-y-4">
                                                <div className="flex items-center justify-between gap-4">
                                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{group}</h4>
                                                    <span className="text-xs text-slate-400">{groupFields.length} campo(s)</span>
                                                </div>

                                                <div className="space-y-3">
                                                    {groupFields.map((field) => {
                                                        const suggestion = suggestionMap.get(field.key);
                                                        const currentHeader = mapping[field.key] || '';

                                                        return (
                                                            <div key={field.key} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 p-4">
                                                                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                                                                    <div className="lg:w-72 shrink-0">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="font-semibold text-slate-900 dark:text-white">{field.label}</span>
                                                                            {field.required ? (
                                                                                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300 text-[10px] font-bold uppercase tracking-wide">
                                                                                    Obligatorio
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                        {field.description ? (
                                                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{field.description}</p>
                                                                        ) : null}
                                                                    </div>

                                                                    <div className="flex-1 space-y-2">
                                                                        <select
                                                                            value={currentHeader}
                                                                            onChange={(event) => handleMappingChange(field.key, event.target.value)}
                                                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100"
                                                                        >
                                                                            <option value="">No importar este campo</option>
                                                                            {preview.headers.map((header) => (
                                                                                <option key={`${field.key}-${header}`} value={header}>{header}</option>
                                                                            ))}
                                                                        </select>

                                                                        {suggestion ? (
                                                                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                                                                <span className={`px-2.5 py-1 rounded-full border font-semibold ${getConfidenceStyles(suggestion.confidence)}`}>
                                                                                    Deteccion {suggestion.confidence}
                                                                                </span>
                                                                                <span className="text-slate-500 dark:text-slate-400">
                                                                                    Sugerencia: <span className="font-medium text-slate-700 dark:text-slate-200">{suggestion.header}</span> - {suggestion.reason}
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-xs text-slate-400">Sin sugerencia automatica para este campo.</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <FileSearch size={18} className="text-emerald-500" />
                                            Resumen del archivo
                                        </h3>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-4">
                                                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Filas</div>
                                                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{preview.totalRows}</div>
                                            </div>
                                            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-4">
                                                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Campos asignados</div>
                                                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{Object.keys(mapping).length}</div>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 p-4">
                                            <div className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Columnas sin usar</div>
                                            <div className="flex flex-wrap gap-2">
                                                {preview.unmappedHeaders.length > 0 ? preview.unmappedHeaders.map((header) => (
                                                    <span key={header} className="px-3 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                                                        {header}
                                                    </span>
                                                )) : (
                                                    <span className="text-sm text-emerald-600 dark:text-emerald-300">Todas las columnas detectadas estan en uso.</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <AlertTriangle size={18} className="text-amber-500" />
                                            Avisos previos
                                        </h3>

                                        <div className="space-y-3 max-h-72 overflow-auto pr-1">
                                            {preview.warnings.length > 0 ? preview.warnings.map((warning) => (
                                                <div key={warning} className="rounded-2xl border border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200 p-4 text-sm">
                                                    {warning}
                                                </div>
                                            )) : (
                                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200 p-4 text-sm">
                                                    No se detectaron avisos importantes en el analisis inicial.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {preview && step === 'review' ? (
                        <div className="p-6 md:p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="rounded-[1.75rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Campos mapeados</div>
                                    <div className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{preview.stats.mappedFields}</div>
                                </div>
                                <div className="rounded-[1.75rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Columnas sin usar</div>
                                    <div className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{preview.stats.unmappedHeaders}</div>
                                </div>
                                <div className="rounded-[1.75rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Filas con avisos</div>
                                    <div className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{preview.stats.rowsWithWarnings}</div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <Eye size={18} className="text-blue-500" />
                                            Vista previa de filas importadas
                                        </h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            Esta tabla ya refleja el mapeo que se usara al confirmar la importacion.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-300 font-medium">
                                        <CheckCircle2 size={16} />
                                        {preview.previewRows.length} fila(s) revisadas
                                    </div>
                                </div>

                                <div className="overflow-auto max-h-[52vh]">
                                    <table className="min-w-full text-sm">
                                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400">Fila</th>
                                                {previewColumns.map((field) => (
                                                    <th key={field.key} className="px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                        {field.label}
                                                    </th>
                                                ))}
                                                <th className="px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400 min-w-[260px]">Avisos</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {preview.previewRows.map((row) => (
                                                <tr key={row.rowNumber} className="bg-white dark:bg-slate-900 align-top">
                                                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">{row.rowNumber}</td>
                                                    {previewColumns.map((field) => (
                                                        <td key={`${row.rowNumber}-${field.key}`} className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                            {row.mapped[field.key] || '—'}
                                                        </td>
                                                    ))}
                                                    <td className="px-4 py-3">
                                                        {row.warnings.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {row.warnings.map((warning) => (
                                                                    <div key={warning} className="rounded-xl border border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200 px-3 py-2 text-xs">
                                                                        {warning}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-300 text-xs font-semibold">
                                                                <CheckCircle2 size={14} /> Sin avisos
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Avisos de esta importacion</h3>
                                <div className="space-y-3">
                                    {preview.warnings.length > 0 ? preview.warnings.map((warning) => (
                                        <div key={warning} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                            {warning}
                                        </div>
                                    )) : (
                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200 px-4 py-3 text-sm">
                                            Todo parece correcto. Si la muestra coincide con tu archivo, puedes lanzar la importacion.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="px-6 py-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {preview ? `${preview.totalRows} fila(s) detectadas en el archivo.` : 'Preparando vista previa...' }
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            Cancelar
                        </button>

                        {step === 'review' ? (
                            <button
                                type="button"
                                onClick={() => setStep('map')}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Volver al mapeo
                            </button>
                        ) : null}

                        {step === 'map' ? (
                            <button
                                type="button"
                                onClick={() => void handleReview()}
                                disabled={busy}
                                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                            >
                                {loadingPreview ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
                                Revisar vista previa
                            </button>
                        ) : null}

                        {step === 'review' ? (
                            <button
                                type="button"
                                onClick={() => void handleImport()}
                                disabled={busy}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                Confirmar importacion
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
