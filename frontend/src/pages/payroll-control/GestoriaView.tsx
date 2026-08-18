import { AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import type { ReviewSummary } from './types';

export interface GestoriaColumn {
    code: string;
    label: string;
    kind: 'CONCEPT' | 'RECORD';
    conceptConfigId: string;
}

interface GestoriaViewProps {
    recordsLength: number;
    reviewSummary: ReviewSummary;
    gestoriaPreview: any;
    gestoriaColumns: GestoriaColumn[];
    visibleGestoriaRecords: any[];
    gestoriaPreviewRows: Map<string, any>;
    gestoriaTotals: Record<string, number>;
    isLocked: boolean;
    lastSavedRecordId: string | null;
    onCellBlur: (recordId: string, field: string, value: any) => void;
    onRestoreField: (recordId: string, fieldName: string) => void;
    onConceptBlur: (record: any, conceptConfigId: string, value: number) => void;
}

export default function GestoriaView({
    recordsLength, reviewSummary, gestoriaPreview, gestoriaColumns,
    visibleGestoriaRecords, gestoriaPreviewRows, gestoriaTotals,
    isLocked, lastSavedRecordId, onCellBlur, onRestoreField, onConceptBlur
}: GestoriaViewProps) {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-emerald-50/60 px-4 py-3 text-xs dark:border-slate-700 dark:bg-emerald-950/10">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1.5 font-bold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">{recordsLength} empleados</span>
                    <span className={`rounded-full px-3 py-1.5 font-bold ${reviewSummary.missingCodes ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{reviewSummary.missingCodes} sin código</span>
                    {reviewSummary.missingRates > 0 && <span className="rounded-full bg-amber-100 px-3 py-1.5 font-bold text-amber-800">{reviewSummary.missingRates} horas sin tarifa (0€)</span>}
                    <span className="rounded-full bg-amber-100 px-3 py-1.5 font-bold text-amber-800">{reviewSummary.manualOverrides} con correcciones</span>
                    {gestoriaPreview && <span className={`rounded-full px-3 py-1.5 font-bold ${gestoriaPreview.errors?.length ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{gestoriaPreview.errors?.length || 0} incidencias de plantilla</span>}
                </div>
                <span className="text-slate-500">Los importes amarillos han sido corregidos manualmente.</span>
            </div>
            <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-xs">
                    <thead className="sticky top-0 z-20 bg-emerald-950 text-white shadow-sm">
                        <tr>
                            <th className="sticky left-0 z-30 min-w-32 border-b border-r border-emerald-800 bg-emerald-950 p-2.5">
                                Código trabajador
                            </th>
                            <th className="sticky left-32 z-30 min-w-56 border-b border-r border-emerald-800 bg-emerald-950 p-2.5">
                                Trabajador
                            </th>
                            <th className="w-20 border-b border-r border-emerald-800 p-2.5 text-center">
                                Fila Excel
                            </th>
                            {gestoriaColumns.map((column) => (
                                <th key={column.code} className="min-w-28 border-b border-r border-emerald-800 p-2.5 text-right">
                                    <span className="block font-mono text-[11px] text-emerald-300">{column.code}</span>
                                    <span className="block whitespace-nowrap">{column.label}</span>
                                </th>
                            ))}
                            <th className="min-w-36 border-b border-emerald-800 p-2.5">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleGestoriaRecords.length === 0 && (
                            <tr>
                                <td colSpan={gestoriaColumns.length + 4} className="px-6 py-14 text-center text-sm text-slate-500">
                                    No hay trabajadores que coincidan con este filtro.
                                </td>
                            </tr>
                        )}
                        {visibleGestoriaRecords.map((record) => {
                            const employeeName = `${record.employee?.lastName || ''}, ${record.employee?.firstName || record.employee?.name || ''}`;
                            const employeeCode = record.gestoriaCode || record.employee?.payrollAgencyEmployeeCode || '';
                            const previewRow = gestoriaPreviewRows.get(record.employeeId) as any;
                            const missingCode = !employeeCode;
                            const missingTemplateRow = Boolean(gestoriaPreview) && !previewRow?.row;
                            const hasMissingRate = (
                                (Number(record.overtimeHours || 0) > 0 && Number(record.overtimeRate || 0) === 0) ||
                                (Number(record.holidayOvertimeHours || 0) > 0 && Number(record.holidayOvertimeRate || 0) === 0)
                            );
                            const invalid = missingCode || missingTemplateRow;

                            return (
                                <tr key={record.id} className={lastSavedRecordId === record.id ? 'bg-emerald-100/80 outline outline-1 -outline-offset-1 outline-emerald-400 dark:bg-emerald-950/30' : invalid ? 'bg-rose-50/70 dark:bg-rose-950/15' : 'hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10'}>
                                    <td className={`sticky left-0 z-10 border-b border-r border-slate-200 p-1 ${invalid ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-white dark:bg-slate-900'} dark:border-slate-700`}>
                                        <input
                                            type="text"
                                            disabled={isLocked}
                                            defaultValue={employeeCode}
                                            onBlur={(event) => onCellBlur(record.id, 'gestoriaCode', event.target.value.trim() || null)}
                                            placeholder="Sin código"
                                            className={`h-8 w-full rounded border-0 bg-transparent px-2 font-mono font-bold outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 dark:focus:bg-slate-800 ${missingCode ? 'text-rose-700 placeholder:text-rose-500' : 'text-slate-800 dark:text-slate-100'}`}
                                        />
                                    </td>
                                    <td className={`sticky left-32 z-10 border-b border-r border-slate-200 px-3 py-2 font-semibold ${invalid ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-white dark:bg-slate-900'} dark:border-slate-700`}>
                                        {employeeName}
                                    </td>
                                    <td className="border-b border-r border-slate-200 px-2 text-center font-mono text-slate-500 dark:border-slate-700">
                                        {previewRow?.row || '—'}
                                    </td>
                                    {gestoriaColumns.map((column) => {
                                        if (column.conceptConfigId === 'totalOvertimeAmount') {
                                            return (
                                                <td key={column.code} className={`border-b border-r border-slate-200 p-1 dark:border-slate-700 ${record.isTotalOvertimeAmountManual ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}>
                                                    <div className="flex items-center">
                                                        {record.isTotalOvertimeAmountManual && <button type="button" onClick={() => onRestoreField(record.id, 'totalOvertimeAmount')} title="Restaurar cálculo" className="text-amber-600"><RotateCcw size={12} /></button>}
                                                        <input type="number" step="0.01" disabled={isLocked} defaultValue={Number(record.totalOvertimeAmount || 0)} onBlur={(event) => onCellBlur(record.id, 'totalOvertimeAmount', Number(event.target.value))} className="h-8 w-full bg-transparent px-2 text-right font-mono outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 dark:focus:bg-slate-800" />
                                                    </div>
                                                </td>
                                            );
                                        }
                                        if (column.conceptConfigId === 'diets') {
                                            return (
                                                <td key={column.code} className="border-b border-r border-slate-200 p-1 dark:border-slate-700">
                                                    <input type="number" step="0.01" disabled={isLocked} defaultValue={Number(record.diets || 0)} onBlur={(event) => onCellBlur(record.id, 'diets', Number(event.target.value))} className="h-8 w-full bg-transparent px-2 text-right font-mono outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 dark:focus:bg-slate-800" />
                                                </td>
                                            );
                                        }
                                        const concept = (record.conceptValues || []).find((item: any) => item.conceptConfigId === column.conceptConfigId);
                                        return (
                                            <td key={column.code} className="border-b border-r border-slate-200 p-1 dark:border-slate-700">
                                                <input type="number" step="0.01" disabled={isLocked || !concept} defaultValue={Number(concept?.value || 0)} onBlur={(event) => concept && onConceptBlur(record, concept.conceptConfigId, Number(event.target.value))} className="h-8 w-full bg-transparent px-2 text-right font-mono outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 dark:focus:bg-slate-800" />
                                            </td>
                                        );
                                    })}
                                    <td className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                                        {missingCode ? (
                                            <span className="inline-flex items-center gap-1 font-semibold text-rose-700"><AlertCircle size={13} /> Falta código</span>
                                        ) : missingTemplateRow ? (
                                            <span className="inline-flex items-center gap-1 font-semibold text-rose-700"><AlertCircle size={13} /> No está en plantilla</span>
                                        ) : hasMissingRate ? (
                                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700" title="Horas calculadas con tarifa a 0.00 €/h"><AlertCircle size={13} /> Tarifa 0 €</span>
                                        ) : gestoriaPreview ? (
                                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><CheckCircle2 size={13} /> Preparado</span>
                                        ) : (
                                            <span className="text-slate-400">Sin validar</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="sticky bottom-0 z-20 bg-slate-900 font-bold text-white">
                        <tr>
                            <td colSpan={3} className="sticky left-0 bg-slate-900 p-3 text-right uppercase tracking-wide">Totales para gestoría</td>
                            {gestoriaColumns.map((column) => (
                                <td key={column.code} className="border-l border-slate-700 p-3 text-right font-mono">
                                    {Number(gestoriaTotals[column.code] || 0).toFixed(2)} €
                                </td>
                            ))}
                            <td className="border-l border-slate-700 p-3">
                                {visibleGestoriaRecords.length} trabajadores
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
