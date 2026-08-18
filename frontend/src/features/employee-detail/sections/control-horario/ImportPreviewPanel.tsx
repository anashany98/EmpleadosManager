import { Loader2 } from 'lucide-react';
import type { TimeSheetImportPreview } from './types';

interface ImportPreviewPanelProps {
    preview: TimeSheetImportPreview;
    importing: boolean;
    onSelectSheet: (sheetName: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ImportPreviewPanel({
    preview,
    importing,
    onSelectSheet,
    onConfirm,
    onCancel
}: ImportPreviewPanelProps) {
    return (
        <div className="border-t border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="font-semibold text-blue-950 dark:text-blue-100">Vista previa: {preview.entries.length} días de la hoja {preview.sheetName}</p>
                    {preview.sheets && preview.sheets.length > 1 && (
                        <label className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-900 dark:text-blue-100">
                            Hoja a importar
                            <select
                                value={preview.sheetName}
                                disabled={importing}
                                onChange={(event) => onSelectSheet(event.target.value)}
                                className="rounded-md border border-blue-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-blue-700 dark:bg-slate-800 dark:text-white"
                            >
                                {preview.sheets.map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                        </label>
                    )}
                    <p className="text-xs text-blue-800 dark:text-blue-200">Se importarán las cuatro horas y las observaciones del mes abierto. Los demás días se conservarán.</p>
                    {preview.warnings.length > 0 && <p className="mt-1 text-xs font-medium text-amber-700">{preview.warnings.join(' ')}</p>}
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={onCancel} disabled={importing} className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700">Cancelar</button>
                    <button type="button" onClick={onConfirm} disabled={importing} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-700 px-3 text-xs font-semibold text-white disabled:opacity-50">{importing && <Loader2 size={13} className="animate-spin" />} Aplicar importación</button>
                </div>
            </div>
        </div>
    );
}
