import { Fragment } from 'react';
import type { KeyboardEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { controlHorarioTotals } from './types';
import type { GrandTotals } from './types';
import MonthlyTotalsBar from './MonthlyTotalsBar';
import CellInput, { formatPercent } from './CellInput';

interface MonthlyControlGridProps {
    controlModalOpen: boolean;
    columnPreset: 'ESSENTIAL' | 'ALL';
    tableDensity: 'COMFORTABLE' | 'COMPACT';
    groupedRecords: Record<string, any[]>;
    configurableConcepts: any[];
    columnCount: number;
    isClosed: boolean;
    isLocked: boolean;
    lastSavedRecordId: string | null;
    grandTotals: GrandTotals;
    visibleCount: number;
    missingCodes: number;
    manualOverrides: number;
    savingState: 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR';
    onCellBlur: (recordId: string, field: string, value: any) => void;
    onRestoreField: (recordId: string, fieldName: string) => void;
    onConceptBlur: (record: any, conceptConfigId: string, value: number) => void;
}

export default function MonthlyControlGrid({
    controlModalOpen, columnPreset, tableDensity, groupedRecords,
    configurableConcepts, columnCount, isClosed, isLocked, lastSavedRecordId,
    grandTotals, visibleCount, missingCodes, manualOverrides, savingState,
    onCellBlur, onRestoreField, onConceptBlur
}: MonthlyControlGridProps) {
    // Navegación con Enter entre celdas editables de la rejilla.
    const handleControlGridKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
        if (event.key !== 'Enter') return;
        const target = event.target as HTMLInputElement;
        if (!(target instanceof HTMLInputElement) || target.disabled) return;
        const editable = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('tbody input:not(:disabled)'));
        const index = editable.indexOf(target);
        if (index < 0) return;
        event.preventDefault();
        const next = editable[index + (event.shiftKey ? -1 : 1)];
        next?.focus();
        next?.select();
    };

    return (
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm ${controlModalOpen ? 'flex min-h-0 flex-1 flex-col' : ''}`}>
            <div className={controlModalOpen ? 'h-full min-h-0 overflow-auto' : 'overflow-x-auto max-h-[70vh]'}>
                <table onKeyDown={handleControlGridKeyDown} className={`w-full border-collapse text-left tabular-nums ${columnPreset === 'ESSENTIAL' ? 'payroll-essential-columns' : ''} ${
                    tableDensity === 'COMFORTABLE'
                        ? 'min-w-[2450px] text-sm [&_thead_th]:px-4 [&_thead_th]:py-3.5 [&_tbody_td]:px-3 [&_tbody_td]:py-2.5 [&_tbody_input]:min-h-9 [&_tbody_input]:min-w-24 [&_tbody_input]:px-2.5 [&_tbody_input]:py-2'
                        : 'min-w-[1900px] text-xs [&_thead_th]:px-2.5 [&_thead_th]:py-2.5 [&_tbody_td]:px-1.5 [&_tbody_td]:py-1 [&_tbody_input]:min-w-20 [&_tbody_input]:py-1'
                }`}>
                    <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-semibold sticky top-0 z-20 shadow-sm">
                        <tr className="bg-slate-950 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">
                            <th colSpan={4} className="border-r border-slate-700 px-3 py-2 text-left">Empleado y tarifas</th>
                            <th colSpan={6} className="border-r border-slate-700 px-3 py-2 text-center">Horas</th>
                            <th colSpan={3} className="border-r border-slate-700 px-3 py-2 text-center">Variables</th>
                            <th colSpan={3} className="border-r border-slate-700 px-3 py-2 text-center">Retenciones</th>
                            <th colSpan={4} className="border-r border-slate-700 px-3 py-2 text-center">Resultados efectivos</th>
                            {configurableConcepts.length > 0 && <th colSpan={configurableConcepts.length} className="px-3 py-2 text-center">Otros conceptos</th>}
                        </tr>
                        <tr>
                            <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700">Categoría</th>
                            <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Tarifa H.Ext</th>
                            <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Tarifa H.Fest</th>
                            {/* Trabajador BLOQUEADO */}
                            <th className="min-w-64 p-2.5 border-b border-r border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-700 font-bold text-slate-900 dark:text-white sticky left-0 z-30 shadow-[6px_0_10px_-8px_rgba(15,23,42,0.65)]">
                                Trabajador (Solo Lectura)
                            </th>
                            <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Cant. H.Ext</th>
                            <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Cant. H.Fest</th>
                            <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right font-bold text-blue-600 dark:text-blue-400">Total Importe</th>
                            <th title="Suma de las horas trabajadas de la rejilla diaria del empleado" className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Trabajadas</th>
                            <th title="Suma de la jornada planificada (festivos y fines de semana = 0)" className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Planificadas</th>
                            <th title="Trabajadas − Planificadas" className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Diferencia</th>
                            <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Var. Positiva</th>
                            <th title="Campo informativo. No resta en las fórmulas automáticas." className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Var. Negativa ⓘ</th>
                            <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Dietas</th>
                            <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">IRPF %</th>
                            <th title="TGSS fijo para todos los empleados (6,35%)" className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">TGSS %</th>
                            <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">% Dispon.</th>
                            <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right font-bold text-slate-900 dark:text-white">BRUTO</th>
                            <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Productividad (ratio)</th>
                            <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Horas</th>
                            <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Diferencia</th>
                            {configurableConcepts.map((concept) => <th key={concept.conceptConfigId} className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">{concept.label}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {Object.entries(groupedRecords).map(([dept, deptRecords]) => {
                            // Subtotales del grupo
                            const subtotal = deptRecords.reduce((acc, r) => {
                                const horario = controlHorarioTotals(r);
                                return {
                                    total: acc.total + Number(r.totalOvertimeAmount || 0),
                                    posVar: acc.posVar + Number(r.positiveVariable || 0),
                                    diets: acc.diets + Number(r.diets || 0),
                                    gross: acc.gross + Number(r.gross || 0),
                                    prod: acc.prod + Number(r.productivity || 0),
                                    hours: acc.hours + Number(r.hoursAmount || 0),
                                    diff: acc.diff + Number(r.difference || 0),
                                    trabajadas: acc.trabajadas + horario.trabajadas,
                                    planificadas: acc.planificadas + horario.planificadas,
                                    horarioDiferencia: acc.horarioDiferencia + horario.diferencia
                                };
                            }, { total: 0, posVar: 0, diets: 0, gross: 0, prod: 0, hours: 0, diff: 0, trabajadas: 0, planificadas: 0, horarioDiferencia: 0 });

                            return (
                                <Fragment key={dept}>
                                    {/* Cabecera de Grupo */}
                                    <tr className="bg-slate-200/70 dark:bg-slate-800/80 font-bold text-slate-800 dark:text-slate-200">
                                        <td colSpan={columnCount} className="p-2 pl-4 text-xs uppercase tracking-wide">
                                            {dept} ({deptRecords.length} trabajadores)
                                        </td>
                                    </tr>

                                    {/* Filas de Empleados del Grupo */}
                                    {deptRecords.map(r => {
                                        const empName = `${r.employee?.lastName || ''}, ${r.employee?.firstName || r.employee?.name || ''}`;

                                        return (
                                            <tr key={r.id} className={`payroll-record-row transition-colors ${lastSavedRecordId === r.id ? 'bg-emerald-100/80 outline outline-1 -outline-offset-1 outline-emerald-400 dark:bg-emerald-950/30' : 'hover:bg-blue-50/40 dark:hover:bg-slate-800/40'}`}>
                                                {/* Categoría */}
                                                <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                                                    <CellInput
                                                        recordId={r.id}
                                                        field="category"
                                                        display={r.category || ''}
                                                        parse={(raw) => raw}
                                                        onBlur={onCellBlur}
                                                        disabled={isClosed}
                                                        className="w-full bg-transparent px-2 py-1 text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 rounded"
                                                    />
                                                </td>

                                                {/* Tarifa H.Ext */}
                                                <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                    <CellInput
                                                        recordId={r.id}
                                                        field="overtimeRate"
                                                        display={String(Number(r.overtimeRate || 0))}
                                                        parse={(raw) => Number(raw)}
                                                        onBlur={onCellBlur}
                                                        disabled={isClosed}
                                                        type="number"
                                                        step="0.01"
                                                        className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 rounded"
                                                    />
                                                </td>

                                                {/* Tarifa H.Fest */}
                                                <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                    <CellInput
                                                        recordId={r.id}
                                                        field="holidayOvertimeRate"
                                                        display={String(Number(r.holidayOvertimeRate || 0))}
                                                        parse={(raw) => Number(raw)}
                                                        onBlur={onCellBlur}
                                                        disabled={isClosed}
                                                        type="number"
                                                        step="0.01"
                                                        className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 rounded"
                                                    />
                                                </td>

                                                {/* NOMBRE TRABAJADOR - LECTURA BLOQUEADA */}
                                                <td className="min-w-64 p-2 border-r border-slate-300 dark:border-slate-600 font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/90 sticky left-0 z-10 select-none shadow-[6px_0_10px_-8px_rgba(15,23,42,0.65)]">
                                                    {empName}
                                                </td>

                                                {/* Cantidad H.Ext (suma diaria, sobrescribible) */}
                                                <td title={r.isOvertimeHoursManual ? 'Sobrescrito a mano en Control Gestoría. Restaura para volver a la suma de la rejilla diaria.' : 'Suma automática de las entradas diarias del empleado'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right ${r.isOvertimeHoursManual ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {r.isOvertimeHoursManual && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onRestoreField(r.id, 'overtimeHours')}
                                                                title="Restaurar suma automática de la rejilla diaria"
                                                                className="text-amber-600 hover:text-amber-800"
                                                            >
                                                                <RotateCcw size={12} />
                                                            </button>
                                                        )}
                                                        <CellInput
                                                            recordId={r.id}
                                                            field="overtimeHours"
                                                            display={String(Number(r.overtimeHours || 0))}
                                                            parse={(raw) => Number(raw)}
                                                            onBlur={onCellBlur}
                                                            disabled={isClosed}
                                                            type="number"
                                                            step="0.5"
                                                            className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 rounded"
                                                        />
                                                    </div>
                                                </td>

                                                {/* Cantidad H.Fest (suma diaria, sobrescribible) */}
                                                <td title={r.isHolidayOvertimeHoursManual ? 'Sobrescrito a mano en Control Gestoría. Restaura para volver a la suma de la rejilla diaria.' : 'Suma automática de las entradas diarias del empleado'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right ${r.isHolidayOvertimeHoursManual ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {r.isHolidayOvertimeHoursManual && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onRestoreField(r.id, 'holidayOvertimeHours')}
                                                                title="Restaurar suma automática de la rejilla diaria"
                                                                className="text-amber-600 hover:text-amber-800"
                                                            >
                                                                <RotateCcw size={12} />
                                                            </button>
                                                        )}
                                                        <CellInput
                                                            recordId={r.id}
                                                            field="holidayOvertimeHours"
                                                            display={String(Number(r.holidayOvertimeHours || 0))}
                                                            parse={(raw) => Number(raw)}
                                                            onBlur={onCellBlur}
                                                            disabled={isClosed}
                                                            type="number"
                                                            step="0.5"
                                                            className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 rounded"
                                                        />
                                                    </div>
                                                </td>

                                                {/* Total Importe (Calculado/Sobrescrito) */}
                                                <td title={r.isTotalOvertimeAmountManual ? `Calculado: ${Number(r.totalOvertimeAmountCalculated || 0).toFixed(2)} € · Manual efectivo: ${Number(r.totalOvertimeAmount || 0).toFixed(2)} €` : 'Valor calculado automáticamente'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right font-semibold ${r.isTotalOvertimeAmountManual ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50/60 dark:bg-slate-800/30'}`}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {r.isTotalOvertimeAmountManual && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onRestoreField(r.id, 'totalOvertimeAmount')}
                                                                title="Restaurar cálculo automático"
                                                                className="text-amber-600 hover:text-amber-800"
                                                            >
                                                                <RotateCcw size={12} />
                                                            </button>
                                                        )}
                                                        <CellInput
                                                            recordId={r.id}
                                                            field="totalOvertimeAmount"
                                                            display={String(Number(r.totalOvertimeAmount || 0))}
                                                            parse={(raw) => Number(raw)}
                                                            onBlur={onCellBlur}
                                                            disabled={isLocked}
                                                            type="number"
                                                            step="0.01"
                                                            className="w-full bg-transparent px-1 py-1 text-right font-bold text-blue-600 dark:text-blue-400 focus:ring-1 focus:ring-blue-500 rounded"
                                                        />
                                                    </div>
                                                </td>

                                                {/* Control horario: suma de las entradas diarias (solo lectura) */}
                                                {(() => {
                                                    const horario = controlHorarioTotals(r);
                                                    return (
                                                        <>
                                                            <td title="Suma de las horas trabajadas de la rejilla diaria" className="p-1 border-r border-slate-100 dark:border-slate-800 text-right font-mono text-slate-700 dark:text-slate-300">
                                                                {horario.trabajadas.toFixed(2)} h
                                                            </td>
                                                            <td title="Suma de la jornada planificada" className="p-1 border-r border-slate-100 dark:border-slate-800 text-right font-mono text-slate-700 dark:text-slate-300">
                                                                {horario.planificadas.toFixed(2)} h
                                                            </td>
                                                            <td title="Trabajadas − Planificadas" className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right font-mono ${horario.diferencia < 0 ? 'text-rose-600 dark:text-rose-400' : horario.diferencia > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                {horario.diferencia.toFixed(2)} h
                                                            </td>
                                                        </>
                                                    );
                                                })()}

                                                {/* Var. Positiva */}
                                                <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                    <CellInput
                                                        recordId={r.id}
                                                        field="positiveVariable"
                                                        display={String(Number(r.positiveVariable || 0))}
                                                        parse={(raw) => Number(raw)}
                                                        onBlur={onCellBlur}
                                                        disabled={isLocked}
                                                        type="number"
                                                        step="0.01"
                                                        className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 rounded"
                                                    />
                                                </td>

                                                {/* Var. Negativa */}
                                                <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                    <CellInput
                                                        recordId={r.id}
                                                        field="negativeVariable"
                                                        display={String(Number(r.negativeVariable || 0))}
                                                        parse={(raw) => Number(raw)}
                                                        onBlur={onCellBlur}
                                                        disabled={isLocked}
                                                        type="number"
                                                        step="0.01"
                                                        className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 rounded"
                                                    />
                                                </td>

                                                {/* Dietas (suma diaria, sobrescribible) */}
                                                <td title={r.isDietsManual ? 'Sobrescrito a mano en Control Gestoría. Restaura para volver a la suma de la rejilla diaria.' : 'Suma automática de las entradas diarias del empleado'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right ${r.isDietsManual ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {r.isDietsManual && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onRestoreField(r.id, 'diets')}
                                                                title="Restaurar suma automática de la rejilla diaria"
                                                                className="text-amber-600 hover:text-amber-800"
                                                            >
                                                                <RotateCcw size={12} />
                                                            </button>
                                                        )}
                                                        <CellInput
                                                            recordId={r.id}
                                                            field="diets"
                                                            display={String(Number(r.diets || 0))}
                                                            parse={(raw) => Number(raw)}
                                                            onBlur={onCellBlur}
                                                            disabled={isLocked}
                                                            type="number"
                                                            step="0.01"
                                                            className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 rounded"
                                                        />
                                                    </div>
                                                </td>

                                                {/* IRPF % */}
                                                <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                    <CellInput
                                                        recordId={r.id}
                                                        field="irpf"
                                                        display={formatPercent(r.irpf)}
                                                        parse={(raw) => Number(raw) / 100}
                                                        onBlur={onCellBlur}
                                                        disabled={isLocked}
                                                        type="number"
                                                        step="0.01"
                                                        title="Retención IRPF del empleado. Se recuerda de un mes a otro."
                                                        className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 rounded"
                                                    />
                                                </td>

                                                {/* TGSS % — fijo para todos */}
                                                <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                    <input
                                                        type="number"
                                                        value={6.35}
                                                        disabled
                                                        title="TGSS fijo para todos los empleados (6,35%)"
                                                        className="w-full cursor-not-allowed bg-transparent px-2 py-1 text-right text-slate-400 dark:text-slate-500"
                                                    />
                                                </td>

                                                {/* % Disponible */}
                                                <td title={r.isAvailablePercentageManual ? `Calculado: ${(Number(r.availablePercentageCalculated || 0) * 100).toFixed(2)} % · Manual efectivo: ${(Number(r.availablePercentage || 0) * 100).toFixed(2)} %` : 'Valor calculado automáticamente'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right ${r.isAvailablePercentageManual ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50/60 dark:bg-slate-800/30'}`}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {r.isAvailablePercentageManual && <button type="button" onClick={() => onRestoreField(r.id, 'availablePercentage')} title="Restaurar cálculo automático" className="text-amber-600"><RotateCcw size={12} /></button>}
                                                        <CellInput recordId={r.id} field="availablePercentage" display={formatPercent(r.availablePercentage)} parse={(raw) => Number(raw) / 100} onBlur={onCellBlur} disabled={isLocked} type="number" step="0.01" className="w-full bg-transparent px-1 py-1 text-right focus:ring-1 focus:ring-blue-500 rounded" />
                                                    </div>
                                                </td>

                                                {/* BRUTO */}
                                                <td title={r.isGrossManual ? `Calculado: ${Number(r.grossCalculated || 0).toFixed(2)} € · Manual efectivo: ${Number(r.gross || 0).toFixed(2)} €` : 'Valor calculado automáticamente'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right font-bold ${r.isGrossManual ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50/60 dark:bg-slate-800/30'}`}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {r.isGrossManual && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onRestoreField(r.id, 'gross')}
                                                                title="Restaurar cálculo automático"
                                                                className="text-amber-600 hover:text-amber-800"
                                                            >
                                                                <RotateCcw size={12} />
                                                            </button>
                                                        )}
                                                        <CellInput
                                                            recordId={r.id}
                                                            field="gross"
                                                            display={String(Number(r.gross || 0))}
                                                            parse={(raw) => Number(raw)}
                                                            onBlur={onCellBlur}
                                                            disabled={isLocked}
                                                            type="number"
                                                            step="0.0001"
                                                            className="w-full bg-transparent px-1 py-1 text-right font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 rounded"
                                                        />
                                                    </div>
                                                </td>

                                                {/* Productividad */}
                                                <td title={r.isProductivityManual ? `Calculado: ${Number(r.productivityCalculated || 0).toFixed(4)} · Manual efectivo: ${Number(r.productivity || 0).toFixed(4)}` : 'Valor calculado automáticamente'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right ${r.isProductivityManual ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50/60 dark:bg-slate-800/30'}`}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {r.isProductivityManual && <button type="button" onClick={() => onRestoreField(r.id, 'productivity')} title="Restaurar cálculo automático" className="text-amber-600"><RotateCcw size={12} /></button>}
                                                        <CellInput
                                                            recordId={r.id}
                                                            field="productivity"
                                                            display={String(Number(r.productivity || 0))}
                                                            parse={(raw) => Number(raw)}
                                                            onBlur={onCellBlur}
                                                            disabled={isLocked}
                                                            type="number"
                                                            step="0.0001"
                                                            className="w-full rounded bg-transparent px-2 py-1 text-right text-slate-800 focus:ring-1 focus:ring-blue-500 dark:text-slate-200"
                                                        />
                                                    </div>
                                                </td>

                                                {/* Horas */}
                                                <td title={r.isHoursAmountManual ? `Calculado: ${Number(r.hoursCalculated || 0).toFixed(2)} € · Manual efectivo: ${Number(r.hoursAmount || 0).toFixed(2)} €` : 'Valor calculado automáticamente'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right ${r.isHoursAmountManual ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50/60 dark:bg-slate-800/30'}`}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {r.isHoursAmountManual && <button type="button" onClick={() => onRestoreField(r.id, 'hoursAmount')} title="Restaurar cálculo automático" className="text-amber-600"><RotateCcw size={12} /></button>}
                                                        <CellInput recordId={r.id} field="hoursAmount" display={String(Number(r.hoursAmount || 0))} parse={(raw) => Number(raw)} onBlur={onCellBlur} disabled={isLocked} type="number" step="0.01" className="w-full bg-transparent px-1 py-1 text-right focus:ring-1 focus:ring-blue-500 rounded" />
                                                    </div>
                                                </td>

                                                {/* Diferencia */}
                                                <td title={r.isDifferenceManual ? `Calculado: ${Number(r.differenceCalculated || 0).toFixed(2)} € · Manual efectivo: ${Number(r.difference || 0).toFixed(2)} €` : 'Valor calculado automáticamente'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right ${r.isDifferenceManual ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50/60 dark:bg-slate-800/30'}`}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {r.isDifferenceManual && <button type="button" onClick={() => onRestoreField(r.id, 'difference')} title="Restaurar cálculo automático" className="text-amber-600"><RotateCcw size={12} /></button>}
                                                        <CellInput recordId={r.id} field="difference" display={String(Number(r.difference || 0))} parse={(raw) => Number(raw)} onBlur={onCellBlur} disabled={isLocked} type="number" step="0.01" className="w-full bg-transparent px-1 py-1 text-right focus:ring-1 focus:ring-blue-500 rounded" />
                                                    </div>
                                                </td>
                                                {configurableConcepts.map((definition) => {
                                                    const concept = (r.conceptValues || []).find((item: any) => item.conceptConfigId === definition.conceptConfigId);
                                                    return <td key={definition.conceptConfigId} className="p-1 border-r border-slate-100 dark:border-slate-800 text-right"><CellInput recordId={r.id} field={`concept-${definition.conceptConfigId}`} display={String(Number(concept?.value || 0))} parse={(raw) => Number(raw)} onBlur={(_, __, value) => concept && onConceptBlur(r, concept.conceptConfigId, Number(value))} disabled={isLocked || !concept} type="number" step="0.01" className="w-full bg-transparent px-1 py-1 text-right focus:ring-1 focus:ring-blue-500 rounded" /></td>;
                                                })}
                                            </tr>
                                        );
                                    })}

                                    {/* Subtotal del Grupo */}
                                    <tr className="payroll-detail-total border-t border-slate-200 bg-slate-100/60 font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                                        <td colSpan={3} className="p-2 pl-4 text-right">SUBTOTAL {dept}:</td>
                                        <td className="p-2 bg-slate-200/50 dark:bg-slate-800 sticky left-0">--</td>
                                        <td colSpan={2}></td>
                                        <td className="p-2 text-right text-blue-600 dark:text-blue-400 font-bold">{subtotal.total.toFixed(2)} €</td>
                                        <td className="p-2 text-right font-mono">{subtotal.trabajadas.toFixed(2)} h</td>
                                        <td className="p-2 text-right font-mono">{subtotal.planificadas.toFixed(2)} h</td>
                                        <td className="p-2 text-right font-mono">{subtotal.horarioDiferencia.toFixed(2)} h</td>
                                        <td className="p-2 text-right">{subtotal.posVar.toFixed(2)} €</td>
                                        <td colSpan={1}></td>
                                        <td className="p-2 text-right">{subtotal.diets.toFixed(2)} €</td>
                                        <td colSpan={3}></td>
                                        <td className="p-2 text-right font-bold text-slate-900 dark:text-white">{subtotal.gross.toFixed(2)} €</td>
                                        <td className="p-2 text-right">{subtotal.prod.toFixed(2)} €</td>
                                        <td className="p-2 text-right">{subtotal.hours.toFixed(2)} €</td>
                                        <td className="p-2 text-right">{subtotal.diff.toFixed(2)} €</td>
                                        {configurableConcepts.map((concept) => <td key={concept.conceptConfigId}></td>)}
                                    </tr>
                                </Fragment>
                            );
                        })}

                        {/* Fila Gran Total Final */}
                        <tr className="payroll-detail-total border-t-2 border-slate-700 bg-slate-900 text-sm font-bold text-white">
                            <td colSpan={3} className="p-3 text-right">GRAN TOTAL GENERAL:</td>
                            <td className="p-3 bg-slate-900 sticky left-0">TOTALES</td>
                            <td colSpan={2}></td>
                            <td className="p-3 text-right text-blue-400">{grandTotals.overtimeAmount.toFixed(2)} €</td>
                            <td className="p-3 text-right font-mono">{grandTotals.trabajadas.toFixed(2)} h</td>
                            <td className="p-3 text-right font-mono">{grandTotals.planificadas.toFixed(2)} h</td>
                            <td className="p-3 text-right font-mono">{grandTotals.horarioDiferencia.toFixed(2)} h</td>
                            <td className="p-3 text-right text-emerald-400">{grandTotals.positiveVar.toFixed(2)} €</td>
                            <td className="p-3 text-right text-rose-400">{grandTotals.negativeVar.toFixed(2)} €</td>
                            <td className="p-3 text-right">{grandTotals.diets.toFixed(2)} €</td>
                            <td colSpan={3}></td>
                            <td className="p-3 text-right text-white font-extrabold text-base">{grandTotals.gross.toFixed(2)} €</td>
                            <td className="p-3 text-right">{grandTotals.productivity.toFixed(2)} €</td>
                            <td className="p-3 text-right">{grandTotals.hoursAmount.toFixed(2)} €</td>
                            <td className="p-3 text-right">{grandTotals.difference.toFixed(2)} €</td>
                            {configurableConcepts.map((concept) => <td key={concept.conceptConfigId}></td>)}
                        </tr>
                    </tbody>
                </table>
            </div>
            <MonthlyTotalsBar
                visibleCount={visibleCount}
                missingCodes={missingCodes}
                manualOverrides={manualOverrides}
                grandTotals={grandTotals}
                savingState={savingState}
            />
        </div>
    );
}
