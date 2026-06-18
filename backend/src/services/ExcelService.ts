import * as ExcelJS from 'exceljs';
import { EncryptionService } from './EncryptionService';

type Accent = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';

interface ExcelContext {
    title?: string;
    subtitle?: string;
    periodLabel?: string;
    filters?: string[];
}

interface MetricCard {
    label: string;
    value: string | number;
    hint?: string;
}

interface TableColumn {
    header: string;
    key: string;
    width: number;
    align?: 'left' | 'center' | 'right';
    numFmt?: string;
    wrapText?: boolean;
}

const COLORS: Record<Accent | 'navy' | 'slate' | 'muted' | 'border' | 'white' | 'success' | 'warning' | 'danger', string> = {
    navy: 'FF0F172A',
    slate: 'FFF8FAFC',
    muted: 'FF64748B',
    border: 'FFE2E8F0',
    white: 'FFFFFFFF',
    success: 'FF16A34A',
    warning: 'FFF59E0B',
    danger: 'FFDC2626',
    blue: 'FF2563EB',
    emerald: 'FF059669',
    amber: 'FFD97706',
    rose: 'FFE11D48',
    violet: 'FF7C3AED'
};

function createWorkbook(subject: string) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RRHH';
    workbook.lastModifiedBy = 'OpenCode';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.company = 'RRHH';
    workbook.subject = subject;
    return workbook;
}

function toCellValue(value: unknown): ExcelJS.CellValue {
    if (value === null || value === undefined) return '';
    if (value instanceof Date || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return String(value);
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatNumber(value: number, decimals = 2) {
    return new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

function formatPercent(value: number) {
    return `${formatNumber(value, 2)}%`;
}

function formatDate(value?: string | Date | null) {
    if (!value) return '-';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('es-ES');
}

function formatTime(value?: string | Date | null) {
    if (!value) return '-';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function safeNumber(value: unknown) {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
}

function uniqueCount(values: Array<string | null | undefined>) {
    return new Set(values.filter(Boolean)).size;
}

function sumBy<T>(items: T[], selector: (item: T) => number) {
    return items.reduce((total, item) => total + selector(item), 0);
}

function groupRows<T>(items: T[], keySelector: (item: T) => string) {
    const grouped = new Map<string, T[]>();
    items.forEach((item) => {
        const key = keySelector(item) || 'Sin asignar';
        const current = grouped.get(key) || [];
        current.push(item);
        grouped.set(key, current);
    });
    return grouped;
}

function normalizeFilters(context?: ExcelContext) {
    const lines = [
        context?.periodLabel ? `Periodo: ${context.periodLabel}` : null,
        ...(context?.filters || []).filter(Boolean)
    ].filter(Boolean) as string[];

    return lines.length > 0 ? lines.join('  |  ') : 'Sin filtros adicionales';
}

function configureSheet(sheet: ExcelJS.Worksheet, headerRowNumber: number) {
    sheet.properties.defaultRowHeight = 20;
    sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
    sheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
            left: 0.3,
            right: 0.3,
            top: 0.4,
            bottom: 0.4,
            header: 0.2,
            footer: 0.2
        }
    };
}

function setColumns(sheet: ExcelJS.Worksheet, columns: TableColumn[]) {
    columns.forEach((column, index) => {
        const worksheetColumn = sheet.getColumn(index + 1);
        worksheetColumn.width = column.width;
    });
}

function addReportBanner(
    sheet: ExcelJS.Worksheet,
    title: string,
    subtitle: string,
    metrics: MetricCard[],
    accent: Accent,
    columnCount: number,
    context?: ExcelContext
) {
    const finalColumn = Math.max(columnCount, 8);
    setColumns(sheet, Array.from({ length: finalColumn }, () => ({ header: '', key: '', width: 16 })));

    sheet.mergeCells(1, 1, 1, finalColumn);
    sheet.getCell(1, 1).value = title;
    sheet.getCell(1, 1).font = { size: 20, bold: true, color: { argb: COLORS.white } };
    sheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS[accent] } };
    sheet.getCell(1, 1).alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(1).height = 28;

    sheet.mergeCells(2, 1, 2, finalColumn);
    sheet.getCell(2, 1).value = subtitle;
    sheet.getCell(2, 1).font = { size: 11, color: { argb: COLORS.muted } };
    sheet.getCell(2, 1).alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(2).height = 20;

    const cardsPerRow = Math.min(4, Math.max(metrics.length, 1));
    const baseCardWidth = Math.max(2, Math.floor(finalColumn / cardsPerRow));

    metrics.forEach((metric, index) => {
        const startColumn = index * baseCardWidth + 1;
        const endColumn = index === cardsPerRow - 1 ? finalColumn : Math.min(finalColumn, startColumn + baseCardWidth - 1);

        sheet.mergeCells(4, startColumn, 4, endColumn);
        sheet.mergeCells(5, startColumn, 5, endColumn);
        sheet.mergeCells(6, startColumn, 6, endColumn);

        const labelCell = sheet.getCell(4, startColumn);
        labelCell.value = metric.label.toUpperCase();
        labelCell.font = { size: 9, bold: true, color: { argb: COLORS.muted } };
        labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate } };

        const valueCell = sheet.getCell(5, startColumn);
        valueCell.value = metric.value;
        valueCell.font = { size: 16, bold: true, color: { argb: COLORS.navy } };
        valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
        valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate } };

        const hintCell = sheet.getCell(6, startColumn);
        hintCell.value = metric.hint || '';
        hintCell.font = { size: 9, color: { argb: COLORS.muted }, italic: true };
        hintCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        hintCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate } };

        for (let rowNumber = 4; rowNumber <= 6; rowNumber += 1) {
            for (let columnNumber = startColumn; columnNumber <= endColumn; columnNumber += 1) {
                sheet.getCell(rowNumber, columnNumber).border = {
                    top: { style: 'thin', color: { argb: COLORS.border } },
                    left: { style: 'thin', color: { argb: COLORS.border } },
                    bottom: { style: 'thin', color: { argb: COLORS.border } },
                    right: { style: 'thin', color: { argb: COLORS.border } }
                };
            }
        }
    });

    sheet.mergeCells(8, 1, 8, finalColumn);
    sheet.getCell(8, 1).value = `Generado el ${new Date().toLocaleString('es-ES')}  |  ${normalizeFilters(context)}`;
    sheet.getCell(8, 1).font = { size: 10, color: { argb: COLORS.muted } };
    sheet.getCell(8, 1).alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getRow(8).height = 18;

    return 10;
}

function addTable(
    sheet: ExcelJS.Worksheet,
    startRowNumber: number,
    columns: TableColumn[],
    rows: Array<Record<string, unknown>>,
    accent: Accent,
    totals?: Record<string, unknown>
) {
    setColumns(sheet, columns);

    const headerRow = sheet.getRow(startRowNumber);
    headerRow.values = [undefined, ...columns.map((column) => column.header)];
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: COLORS.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS[accent] } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: COLORS[accent] } },
            left: { style: 'thin', color: { argb: COLORS[accent] } },
            bottom: { style: 'thin', color: { argb: COLORS[accent] } },
            right: { style: 'thin', color: { argb: COLORS[accent] } }
        };
    });

    rows.forEach((rowData, index) => {
        const row = sheet.getRow(startRowNumber + index + 1);
        row.values = [undefined, ...columns.map((column) => toCellValue(rowData[column.key]))];
        row.height = 20;

        row.eachCell((cell, columnNumber) => {
            const column = columns[columnNumber - 1];
            cell.font = { size: 10, color: { argb: COLORS.navy } };
            cell.alignment = {
                horizontal: column?.align || 'left',
                vertical: 'middle',
                wrapText: !!column?.wrapText
            };
            cell.border = {
                bottom: { style: 'thin', color: { argb: COLORS.border } }
            };

            if (column?.numFmt && typeof cell.value === 'number') {
                cell.numFmt = column.numFmt;
            }

            if (index % 2 === 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
        });
    });

    const totalRowNumber = startRowNumber + rows.length + 1;
    if (totals && Object.keys(totals).length > 0) {
        const totalRow = sheet.getRow(totalRowNumber);
        totalRow.values = [undefined, ...columns.map((column) => toCellValue(totals[column.key]))];
        totalRow.eachCell((cell, columnNumber) => {
            const column = columns[columnNumber - 1];
            cell.font = { bold: true, color: { argb: COLORS.navy } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            cell.border = {
                top: { style: 'thin', color: { argb: COLORS.border } },
                bottom: { style: 'thin', color: { argb: COLORS.border } }
            };
            cell.alignment = { horizontal: column?.align || 'left', vertical: 'middle' };
            if (column?.numFmt && typeof cell.value === 'number') {
                cell.numFmt = column.numFmt;
            }
        });
    }

    sheet.autoFilter = {
        from: { row: startRowNumber, column: 1 },
        to: { row: startRowNumber, column: columns.length }
    };

    configureSheet(sheet, startRowNumber);
}

function addRankingSheet(
    workbook: ExcelJS.Workbook,
    name: string,
    title: string,
    subtitle: string,
    metrics: MetricCard[],
    columns: TableColumn[],
    rows: Array<Record<string, unknown>>,
    accent: Accent,
    context?: ExcelContext,
    totals?: Record<string, unknown>
) {
    const sheet = workbook.addWorksheet(name);
    const headerRowNumber = addReportBanner(sheet, title, subtitle, metrics, accent, columns.length, context);
    addTable(sheet, headerRowNumber, columns, rows, accent, totals);
    return sheet;
}

export class ExcelService {
    static async generateAttendanceReport(data: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('Reporte de fichajes');
        const employees = uniqueCount(data.map((entry) => entry.employee?.id));
        const departments = uniqueCount(data.map((entry) => entry.employee?.department));
        const typeCounts = groupRows(data, (entry) => entry.type || 'N/A');
        const typeBreakdown = Array.from(typeCounts.entries()).map(([type, entries]) => ({
            type,
            records: entries.length
        }));

        addRankingSheet(
            workbook,
            'Resumen',
            context.title || 'Reporte de asistencia y fichajes',
            context.subtitle || 'Exportación detallada de fichajes individuales para auditoría operativa.',
            [
                { label: 'Registros', value: data.length, hint: 'Marcajes encontrados' },
                { label: 'Personas', value: employees, hint: 'Empleados con fichajes' },
                { label: 'Departamentos', value: departments, hint: 'Áreas implicadas' },
                { label: 'Tipos', value: typeBreakdown.length, hint: 'Clases de marcaje' }
            ],
            [
                { header: 'Tipo de registro', key: 'type', width: 24 },
                { header: 'Volumen', key: 'records', width: 14, align: 'right' }
            ],
            typeBreakdown,
            'blue',
            context,
            { type: 'TOTAL', records: data.length }
        );

        addRankingSheet(
            workbook,
            'Detalle de fichajes',
            'Detalle de fichajes',
            'Listado cronológico de marcajes individuales para contraste y auditoría.',
            [
                { label: 'Primer registro', value: data[0]?.timestamp ? formatDate(data[0].timestamp) : '-', hint: 'Inicio visible' },
                { label: 'Último registro', value: data[data.length - 1]?.timestamp ? formatDate(data[data.length - 1].timestamp) : '-', hint: 'Fin visible' },
                { label: 'Entradas', value: typeCounts.get('IN')?.length || 0, hint: 'Marcajes de inicio' },
                { label: 'Salidas', value: typeCounts.get('OUT')?.length || 0, hint: 'Marcajes de cierre' }
            ],
            [
                { header: 'Empleado', key: 'employee', width: 28 },
                { header: 'DNI', key: 'dni', width: 16 },
                { header: 'Departamento', key: 'department', width: 20 },
                { header: 'Fecha', key: 'date', width: 14, align: 'center' },
                { header: 'Hora', key: 'time', width: 12, align: 'center' },
                { header: 'Tipo', key: 'type', width: 18, align: 'center' },
                { header: 'Subcuenta 465', key: 'subaccount465', width: 16, align: 'center' }
            ],
            data.map((entry) => ({
                employee: entry.employee?.name || 'N/A',
                dni: EncryptionService.decrypt(entry.employee?.dni) || '-',
                department: entry.employee?.department || 'Sin asignar',
                date: formatDate(entry.timestamp),
                time: formatTime(entry.timestamp),
                type: entry.type || '-',
                subaccount465: entry.employee?.subaccount465 || '-'
            })),
            'blue',
            context
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateAttendanceSummaryReport(data: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('Resumen operativo de asistencia');
        const totalHours = sumBy(data, (item) => safeNumber(item.totalHours));
        const employees = uniqueCount(data.map((item) => item.employeeId));
        const incompleteDays = data.filter((item) => item.status === 'INCOMPLETE').length;
        const averageHours = data.length > 0 ? totalHours / data.length : 0;

        const employeeRollup = Array.from(groupRows(data, (item) => item.employeeName || 'N/A').entries())
            .map(([employee, items]) => ({
                employee,
                days: items.length,
                totalHours: sumBy(items, (item) => safeNumber(item.totalHours)),
                incomplete: items.filter((item) => item.status === 'INCOMPLETE').length,
                averageHours: items.length > 0 ? sumBy(items, (item) => safeNumber(item.totalHours)) / items.length : 0
            }))
            .sort((left, right) => right.totalHours - left.totalHours);

        addRankingSheet(
            workbook,
            'Resumen diario',
            context.title || 'Resumen diario de asistencia',
            context.subtitle || 'Consolidado de horas trabajadas por persona y día.',
            [
                { label: 'Jornadas', value: data.length, hint: 'Días trabajados' },
                { label: 'Personas', value: employees, hint: 'Empleados activos en el periodo' },
                { label: 'Horas', value: formatNumber(totalHours, 2), hint: 'Horas acumuladas' },
                { label: 'Incompletas', value: incompleteDays, hint: 'Revisión recomendada' }
            ],
            [
                { header: 'Empleado', key: 'employee', width: 28 },
                { header: 'Día', key: 'days', width: 12, align: 'center' },
                { header: 'Horas totales', key: 'totalHours', width: 16, align: 'right', numFmt: '#,##0.00' },
                { header: 'Media diaria', key: 'averageHours', width: 16, align: 'right', numFmt: '#,##0.00' },
                { header: 'Días incompletos', key: 'incomplete', width: 18, align: 'center' }
            ],
            employeeRollup,
            'blue',
            context,
            {
                employee: 'TOTAL',
                days: data.length,
                totalHours,
                averageHours,
                incomplete: incompleteDays
            }
        );

        addRankingSheet(
            workbook,
            'Detalle diario',
            'Detalle diario de asistencia',
            'Vista por empleado, día y segmentos horarios consolidados.',
            [
                { label: 'Media diaria', value: formatNumber(averageHours, 2), hint: 'Horas por jornada' },
                { label: 'Máximo diario', value: formatNumber(Math.max(...data.map((item) => safeNumber(item.totalHours)), 0), 2), hint: 'Pico de jornada' },
                { label: 'Mínimo diario', value: formatNumber(Math.min(...data.map((item) => safeNumber(item.totalHours)).filter((value) => value > 0), averageHours || 0), 2), hint: 'Jornada más baja' },
                { label: 'Segmentos', value: data.reduce((sum, item) => sum + (item.segments?.length || 0), 0), hint: 'Bloques horarios' }
            ],
            [
                { header: 'Empleado', key: 'employee', width: 28 },
                { header: 'DNI', key: 'dni', width: 16 },
                { header: 'Departamento', key: 'department', width: 18 },
                { header: 'Fecha', key: 'date', width: 14, align: 'center' },
                { header: 'Horas', key: 'hours', width: 12, align: 'right', numFmt: '#,##0.00' },
                { header: 'Estado', key: 'status', width: 14, align: 'center' },
                { header: 'Primer fichaje', key: 'firstSegment', width: 14, align: 'center' },
                { header: 'Último fichaje', key: 'lastSegment', width: 14, align: 'center' },
                { header: 'Segmentos', key: 'segments', width: 60, wrapText: true }
            ],
            data.map((item) => ({
                employee: item.employeeName,
                dni: EncryptionService.decrypt(item.employeeDni) || '-',
                department: item.department || 'Sin asignar',
                date: formatDate(item.date),
                hours: safeNumber(item.totalHours),
                status: item.status === 'COMPLETE' ? 'Completo' : 'Incompleto',
                firstSegment: item.segments?.length ? formatTime(item.segments[0].start) : '-',
                lastSegment: item.segments?.length ? formatTime(item.segments[item.segments.length - 1].end || item.segments[item.segments.length - 1].start) : '-',
                segments: (item.segments || []).map((segment: any) => `${formatTime(segment.start)} - ${segment.end ? formatTime(segment.end) : 'Abierto'} (${segment.type})`).join(' | ')
            })),
            'blue',
            context
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateOvertimeReport(data: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('Reporte de horas extra');
        const totalHours = sumBy(data, (entry) => safeNumber(entry.hours));
        const totalCost = sumBy(data, (entry) => safeNumber(entry.totalCost));
        const employees = uniqueCount(data.map((entry) => entry.employee?.id));
        const averageRate = data.length > 0 ? sumBy(data, (entry) => safeNumber(entry.rate)) / data.length : 0;

        const departmentRollup = Array.from(groupRows(data, (entry) => entry.employee?.department || 'Sin asignar').entries())
            .map(([department, entries]) => ({
                department,
                employees: uniqueCount(entries.map((entry) => entry.employee?.id)),
                hours: sumBy(entries, (entry) => safeNumber(entry.hours)),
                totalCost: sumBy(entries, (entry) => safeNumber(entry.totalCost))
            }))
            .sort((left, right) => right.totalCost - left.totalCost);

        addRankingSheet(
            workbook,
            'Resumen',
            context.title || 'Reporte de horas extra',
            context.subtitle || 'Vista ejecutiva de horas adicionales y su impacto económico.',
            [
                { label: 'Registros', value: data.length, hint: 'Entradas liquidadas' },
                { label: 'Personas', value: employees, hint: 'Empleados con horas extra' },
                { label: 'Horas', value: formatNumber(totalHours, 2), hint: 'Volumen total' },
                { label: 'Coste', value: formatCurrency(totalCost), hint: 'Impacto económico' }
            ],
            [
                { header: 'Departamento', key: 'department', width: 24 },
                { header: 'Personas', key: 'employees', width: 12, align: 'center' },
                { header: 'Horas', key: 'hours', width: 14, align: 'right', numFmt: '#,##0.00' },
                { header: 'Coste', key: 'totalCost', width: 16, align: 'right', numFmt: '#,##0.00"€"' }
            ],
            departmentRollup,
            'emerald',
            context,
            {
                department: 'TOTAL',
                employees,
                hours: totalHours,
                totalCost
            }
        );

        addRankingSheet(
            workbook,
            'Detalle',
            'Detalle de horas extra',
            'Desglose por persona, fecha y tipo de hora adicional.',
            [
                { label: 'Media tarifa', value: formatCurrency(averageRate), hint: 'Tarifa media por hora' },
                { label: 'Máximo coste', value: formatCurrency(Math.max(...data.map((entry) => safeNumber(entry.totalCost)), 0)), hint: 'Registro más costoso' },
                { label: 'Horas máximas', value: formatNumber(Math.max(...data.map((entry) => safeNumber(entry.hours)), 0), 2), hint: 'Pico por registro' },
                { label: 'Tipos', value: uniqueCount(data.map((entry) => entry.type)), hint: 'Clases de extra' }
            ],
            [
                { header: 'Empleado', key: 'employee', width: 28 },
                { header: 'DNI', key: 'dni', width: 16 },
                { header: 'Departamento', key: 'department', width: 20 },
                { header: 'Fecha', key: 'date', width: 14, align: 'center' },
                { header: 'Horas', key: 'hours', width: 12, align: 'right', numFmt: '#,##0.00' },
                { header: 'Tarifa', key: 'rate', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Coste total', key: 'totalCost', width: 16, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Tipo', key: 'type', width: 18, align: 'center' }
            ],
            data.map((entry) => ({
                employee: entry.employee?.name || 'N/A',
                dni: EncryptionService.decrypt(entry.employee?.dni) || '-',
                department: entry.employee?.department || 'Sin asignar',
                date: formatDate(entry.date),
                hours: safeNumber(entry.hours),
                rate: safeNumber(entry.rate),
                totalCost: safeNumber(entry.totalCost),
                type: entry.type || '-'
            })),
            'emerald',
            context
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateVacationReport(data: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('Reporte de vacaciones');
        const totalQuota = sumBy(data, (employee) => safeNumber(employee.totalQuota));
        const usedDays = sumBy(data, (employee) => safeNumber(employee.usedDays));
        const pendingDays = sumBy(data, (employee) => safeNumber(employee.pendingDays));
        const remainingDays = sumBy(data, (employee) => safeNumber(employee.remainingDays));
        const atRisk = data.filter((employee) => safeNumber(employee.remainingDays) <= 5).length;

        const departmentRollup = Array.from(groupRows(data, (employee) => employee.department || 'Sin asignar').entries())
            .map(([department, employees]) => {
                const total = sumBy(employees, (employee) => safeNumber(employee.totalQuota));
                const used = sumBy(employees, (employee) => safeNumber(employee.usedDays));
                return {
                    department,
                    employees: employees.length,
                    totalQuota: total,
                    usedDays: used,
                    remainingDays: total - used,
                    usageRate: total > 0 ? Number(((used / total) * 100).toFixed(2)) : 0
                };
            })
            .sort((left, right) => right.usedDays - left.usedDays);

        addRankingSheet(
            workbook,
            'Resumen',
            context.title || 'Reporte de vacaciones',
            context.subtitle || 'Estado de cuota, consumo y saldo de vacaciones por persona.',
            [
                { label: 'Empleados', value: data.length, hint: 'Personas analizadas' },
                { label: 'Cuota total', value: formatNumber(totalQuota, 1), hint: 'Días disponibles' },
                { label: 'Consumidos', value: formatNumber(usedDays, 1), hint: 'Días disfrutados' },
                { label: 'Pendientes', value: formatNumber(pendingDays, 1), hint: 'Aprobación en curso' },
                { label: 'Saldo crítico', value: atRisk, hint: 'Con <= 5 días restantes' }
            ],
            [
                { header: 'Departamento', key: 'department', width: 24 },
                { header: 'Empleados', key: 'employees', width: 12, align: 'center' },
                { header: 'Cuota', key: 'totalQuota', width: 14, align: 'right', numFmt: '#,##0.0' },
                { header: 'Consumidos', key: 'usedDays', width: 14, align: 'right', numFmt: '#,##0.0' },
                { header: 'Saldo', key: 'remainingDays', width: 14, align: 'right', numFmt: '#,##0.0' },
                { header: 'Uso %', key: 'usageRate', width: 12, align: 'right', numFmt: '0.00%' }
            ],
            departmentRollup.map((row) => ({ ...row, usageRate: row.usageRate / 100 })),
            'amber',
            context,
            {
                department: 'TOTAL',
                employees: data.length,
                totalQuota,
                usedDays,
                remainingDays,
                usageRate: totalQuota > 0 ? usedDays / totalQuota : 0
            }
        );

        addRankingSheet(
            workbook,
            'Detalle',
            'Detalle de vacaciones',
            'Vista individual con consumo, saldo y volumen de solicitudes registradas.',
            [
                { label: 'Saldo disponible', value: formatNumber(remainingDays, 1), hint: 'Total pendiente' },
                { label: 'Uso global', value: formatPercent(totalQuota > 0 ? (usedDays / totalQuota) * 100 : 0), hint: 'Porcentaje consumido' },
                { label: 'Máximo consumo', value: formatNumber(Math.max(...data.map((employee) => safeNumber(employee.usedDays)), 0), 1), hint: 'Empleado con más uso' },
                { label: 'Solicitudes', value: data.reduce((sum, employee) => sum + safeNumber(employee.requests ?? (employee.vacations || []).length), 0), hint: 'Peticiones registradas' }
            ],
            [
                { header: 'Empleado', key: 'employee', width: 28 },
                { header: 'Departamento', key: 'department', width: 20 },
                { header: 'Anuales', key: 'annualQuotaDays', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Arrastradas', key: 'carriedOverDays', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Importadas', key: 'importedUsedDays', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Aprobadas', key: 'approvedUsedDays', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Pendientes', key: 'pendingDays', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Saldo', key: 'remainingDays', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Saldo proj.', key: 'projectedRemainingDays', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Solicitudes', key: 'requests', width: 12, align: 'center' }
            ],
            data.map((employee) => ({
                employee: employee.name,
                department: employee.department || 'Sin asignar',
                annualQuotaDays: safeNumber(employee.annualQuotaDays),
                carriedOverDays: safeNumber(employee.carriedOverDays),
                importedUsedDays: safeNumber(employee.importedUsedDays),
                approvedUsedDays: safeNumber(employee.approvedUsedDays),
                pendingDays: safeNumber(employee.pendingDays),
                remainingDays: safeNumber(employee.remainingDays),
                projectedRemainingDays: safeNumber(employee.projectedRemainingDays),
                requests: safeNumber(employee.requests ?? (employee.vacations || []).length)
            })),
            'amber',
            context
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateCostReport(data: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('Reporte de costes');
        const totalBruto = sumBy(data, (item) => safeNumber(item.bruto));
        const totalEmployerSS = sumBy(data, (item) => safeNumber(item.ssEmpresa));
        const totalNet = sumBy(data, (item) => safeNumber(item.neto));
        const totalCost = sumBy(data, (item) => safeNumber(item.totalCost));
        const averageCost = data.length > 0 ? totalCost / data.length : 0;

        const departmentRollup = Array.from(groupRows(data, (item) => item.department || 'Sin asignar').entries())
            .map(([department, entries]) => ({
                department,
                employees: entries.length,
                bruto: sumBy(entries, (item) => safeNumber(item.bruto)),
                ssEmpresa: sumBy(entries, (item) => safeNumber(item.ssEmpresa)),
                totalCost: sumBy(entries, (item) => safeNumber(item.totalCost))
            }))
            .sort((left, right) => right.totalCost - left.totalCost);

        addRankingSheet(
            workbook,
            'Resumen',
            context.title || 'Reporte de costes de personal',
            context.subtitle || 'Visión de coste empresa con base de nómina consolidada.',
            [
                { label: 'Empleados', value: data.length, hint: 'Personas liquidadas' },
                { label: 'Coste total', value: formatCurrency(totalCost), hint: 'Coste empresa acumulado' },
                { label: 'Bruto', value: formatCurrency(totalBruto), hint: 'Retribución bruta' },
                { label: 'SS empresa', value: formatCurrency(totalEmployerSS), hint: 'Carga social' }
            ],
            [
                { header: 'Departamento', key: 'department', width: 24 },
                { header: 'Empleados', key: 'employees', width: 12, align: 'center' },
                { header: 'Bruto', key: 'bruto', width: 16, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'SS empresa', key: 'ssEmpresa', width: 16, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Coste total', key: 'totalCost', width: 18, align: 'right', numFmt: '#,##0.00"€"' }
            ],
            departmentRollup,
            'violet',
            context,
            {
                department: 'TOTAL',
                employees: data.length,
                bruto: totalBruto,
                ssEmpresa: totalEmployerSS,
                totalCost
            }
        );

        addRankingSheet(
            workbook,
            'Detalle',
            'Detalle de costes de personal',
            'Desglose por persona con bruto, seguridad social, IRPF y coste final.',
            [
                { label: 'Coste medio', value: formatCurrency(averageCost), hint: 'Media por persona' },
                { label: 'Neto total', value: formatCurrency(totalNet), hint: 'Pagado a plantilla' },
                { label: 'IRPF total', value: formatCurrency(sumBy(data, (item) => safeNumber(item.irpf))), hint: 'Retención acumulada' },
                { label: 'SS trabajador', value: formatCurrency(sumBy(data, (item) => safeNumber(item.ssTrabajador))), hint: 'Aportación trabajador' }
            ],
            [
                { header: 'Empleado', key: 'name', width: 28 },
                { header: 'DNI', key: 'dni', width: 16 },
                { header: 'Departamento', key: 'department', width: 20 },
                { header: 'Bruto', key: 'bruto', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'SS empresa', key: 'ssEmpresa', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'SS trabajador', key: 'ssTrabajador', width: 16, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'IRPF', key: 'irpf', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Neto', key: 'neto', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Coste total', key: 'totalCost', width: 16, align: 'right', numFmt: '#,##0.00"€"' }
            ],
            data.map((item) => ({
                ...item,
                department: item.department || 'Sin asignar'
            })),
            'violet',
            context,
            {
                name: 'TOTAL',
                bruto: totalBruto,
                ssEmpresa: totalEmployerSS,
                ssTrabajador: sumBy(data, (item) => safeNumber(item.ssTrabajador)),
                irpf: sumBy(data, (item) => safeNumber(item.irpf)),
                neto: totalNet,
                totalCost
            }
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateDetailedAbsenceReport(data: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('Reporte de ausencias');
        const totalDays = sumBy(data, (item) => safeNumber(item.days));
        const affectedEmployees = uniqueCount(data.map((item) => item.employee?.id));
        const averageDuration = data.length > 0 ? totalDays / data.length : 0;
        const typeBreakdown = Array.from(groupRows(data, (item) => item.type || 'Sin tipo').entries())
            .map(([type, entries]) => ({
                type,
                cases: entries.length,
                days: sumBy(entries, (item) => safeNumber(item.days))
            }))
            .sort((left, right) => right.days - left.days);

        addRankingSheet(
            workbook,
            'Resumen',
            context.title || 'Reporte detallado de ausencias',
            context.subtitle || 'Control de bajas, incidencias y suspensiones registradas.',
            [
                { label: 'Casos', value: data.length, hint: 'Ausencias registradas' },
                { label: 'Empleados', value: affectedEmployees, hint: 'Plantilla afectada' },
                { label: 'Días', value: formatNumber(totalDays, 1), hint: 'Duración acumulada' },
                { label: 'Media', value: formatNumber(averageDuration, 1), hint: 'Días por caso' }
            ],
            [
                { header: 'Tipo', key: 'type', width: 26 },
                { header: 'Casos', key: 'cases', width: 12, align: 'center' },
                { header: 'Días', key: 'days', width: 14, align: 'right', numFmt: '#,##0.0' }
            ],
            typeBreakdown,
            'rose',
            context,
            { type: 'TOTAL', cases: data.length, days: totalDays }
        );

        addRankingSheet(
            workbook,
            'Detalle',
            'Detalle de ausencias',
            'Listado cronológico con motivo, duración y tipología de la ausencia.',
            [
                { label: 'Mayor ausencia', value: formatNumber(Math.max(...data.map((item) => safeNumber(item.days)), 0), 1), hint: 'Duración máxima' },
                { label: 'Tipos', value: typeBreakdown.length, hint: 'Clasificaciones distintas' },
                { label: 'Inicio más reciente', value: data[0]?.startDate ? formatDate(data[0].startDate) : '-', hint: 'Último caso' },
                { label: 'Fin más lejano', value: data.length > 0 ? formatDate(data.reduce((latest, item) => latest > new Date(item.endDate) ? latest : new Date(item.endDate), new Date(data[0].endDate))) : '-', hint: 'Cobertura final' }
            ],
            [
                { header: 'Empleado', key: 'employee', width: 28 },
                { header: 'DNI', key: 'dni', width: 16 },
                { header: 'Departamento', key: 'department', width: 18 },
                { header: 'Inicio', key: 'startDate', width: 14, align: 'center' },
                { header: 'Fin', key: 'endDate', width: 14, align: 'center' },
                { header: 'Días', key: 'days', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Tipo', key: 'type', width: 18, align: 'center' },
                { header: 'Motivo', key: 'reason', width: 40, wrapText: true }
            ],
            data.map((item) => ({
                employee: item.employee?.name || 'N/A',
                dni: EncryptionService.decrypt(item.employee?.dni) || '-',
                department: item.employee?.department || 'Sin asignar',
                startDate: formatDate(item.startDate),
                endDate: formatDate(item.endDate),
                days: safeNumber(item.days),
                type: item.type || '-',
                reason: item.reason || '-'
            })),
            'rose',
            context
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateKPIReport(summary: any, deptStats: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('KPIs de gestion');

        addRankingSheet(
            workbook,
            'Resumen ejecutivo',
            context.title || 'KPIs de organización',
            context.subtitle || 'Cuadro de mando de rotación, absentismo y estructura de plantilla.',
            [
                { label: 'Plantilla', value: summary.headcount || 0, hint: 'Personas activas' },
                { label: 'Altas', value: summary.hires || 0, hint: 'Incorporaciones del periodo' },
                { label: 'Bajas', value: summary.exits || 0, hint: 'Salidas registradas' },
                { label: 'Absentismo', value: formatPercent(safeNumber(summary.absenteeismRate)), hint: 'Tasa mensual' }
            ],
            [
                { header: 'Métrica', key: 'metric', width: 28 },
                { header: 'Valor', key: 'value', width: 18 },
                { header: 'Lectura', key: 'hint', width: 48, wrapText: true }
            ],
            [
                { metric: 'Rotación', value: formatPercent(safeNumber(summary.turnoverRate)), hint: 'Cuanto mayor sea, mayor presión de sustitución y adaptación.' },
                { metric: 'Días totales de ausencia', value: safeNumber(summary.totalAbsenceDays), hint: 'Impacto acumulado del absentismo en el periodo.' },
                { metric: 'Balance altas/bajas', value: safeNumber(summary.hires) - safeNumber(summary.exits), hint: 'Variación neta de plantilla.' },
                { metric: 'Periodo', value: summary.period || context.periodLabel || '-', hint: 'Marco temporal consolidado.' }
            ],
            'violet',
            context
        );

        addRankingSheet(
            workbook,
            'Absentismo por depto',
            'Absentismo por departamento',
            'Ranking departamental para detectar focos de ausencia y necesidad de refuerzo.',
            [
                { label: 'Departamentos', value: deptStats.length, hint: 'Áreas comparadas' },
                { label: 'Mayor tasa', value: formatPercent(Math.max(...deptStats.map((item) => safeNumber(item.rate)), 0)), hint: 'Pico departamental' },
                { label: 'Mayor volumen', value: formatNumber(Math.max(...deptStats.map((item) => safeNumber(item.absenceDays)), 0), 1), hint: 'Días de ausencia' },
                { label: 'Promedio', value: formatPercent(deptStats.length > 0 ? sumBy(deptStats, (item) => safeNumber(item.rate)) / deptStats.length : 0), hint: 'Media de áreas' }
            ],
            [
                { header: 'Departamento', key: 'department', width: 26 },
                { header: 'Empleados', key: 'employees', width: 12, align: 'center' },
                { header: 'Días ausencia', key: 'absenceDays', width: 16, align: 'right', numFmt: '#,##0.0' },
                { header: 'Días potenciales', key: 'potentialDays', width: 18, align: 'right', numFmt: '#,##0.0' },
                { header: 'Tasa', key: 'rate', width: 12, align: 'right', numFmt: '0.00%' }
            ],
            deptStats.map((item) => ({ ...item, rate: safeNumber(item.rate) / 100 })),
            'violet',
            context,
            {
                department: 'PROMEDIO',
                employees: sumBy(deptStats, (item) => safeNumber(item.employees)),
                absenceDays: sumBy(deptStats, (item) => safeNumber(item.absenceDays)),
                potentialDays: sumBy(deptStats, (item) => safeNumber(item.potentialDays)),
                rate: deptStats.length > 0 ? sumBy(deptStats, (item) => safeNumber(item.rate)) / deptStats.length / 100 : 0
            }
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateGenderGapReport(data: any, context: ExcelContext = {}) {
        const workbook = createWorkbook('Reporte de igualdad');
        const summary = data?.summary || {};
        const rows = data?.rows || [];

        addRankingSheet(
            workbook,
            'Resumen',
            context.title || 'Reporte de igualdad y diversidad',
            context.subtitle || 'Seguimiento de plantilla y brecha salarial por género.',
            [
                { label: 'Brecha global', value: formatPercent(safeNumber(summary.gapPercentage)), hint: 'Diferencia retributiva media' },
                { label: 'Hombres', value: summary.maleCount || 0, hint: 'Plantilla masculina' },
                { label: 'Mujeres', value: summary.femaleCount || 0, hint: 'Plantilla femenina' },
                { label: 'Paridad', value: summary.maleCount && summary.femaleCount ? formatNumber((safeNumber(summary.femaleCount) / Math.max(safeNumber(summary.maleCount), 1)) * 100, 1) + '%' : '0%', hint: 'Ratio mujeres / hombres' }
            ],
            [
                { header: 'Indicador', key: 'indicator', width: 28 },
                { header: 'Valor', key: 'value', width: 18 },
                { header: 'Lectura', key: 'hint', width: 44, wrapText: true }
            ],
            [
                { indicator: 'Sueldo medio hombres', value: formatCurrency(safeNumber(summary.maleAvgBruto)), hint: 'Promedio bruto estimado con las últimas nóminas válidas.' },
                { indicator: 'Sueldo medio mujeres', value: formatCurrency(safeNumber(summary.femaleAvgBruto)), hint: 'Promedio bruto estimado con las últimas nóminas válidas.' },
                { indicator: 'Diferencia absoluta', value: formatCurrency(safeNumber(summary.maleAvgBruto) - safeNumber(summary.femaleAvgBruto)), hint: 'Gap bruto en valor nominal.' },
                { indicator: 'Cobertura', value: rows.length, hint: 'Departamentos con comparación posible.' }
            ],
            'rose',
            context
        );

        addRankingSheet(
            workbook,
            'Detalle por depto',
            'Brecha salarial por departamento',
            'Comparativa departamental para detectar focos de desigualdad y desequilibrio de plantilla.',
            [
                { label: 'Departamentos', value: rows.length, hint: 'Áreas comparables' },
                { label: 'Mayor gap', value: formatPercent(Math.max(...rows.map((row: any) => safeNumber(row.gap)), 0)), hint: 'Pico departamental' },
                { label: 'Mayor media H', value: formatCurrency(Math.max(...rows.map((row: any) => safeNumber(row.maleAvg)), 0)), hint: 'Promedio bruto masculino más alto' },
                { label: 'Mayor media M', value: formatCurrency(Math.max(...rows.map((row: any) => safeNumber(row.femaleAvg)), 0)), hint: 'Promedio bruto femenino más alto' }
            ],
            [
                { header: 'Departamento', key: 'department', width: 24 },
                { header: 'Hombres', key: 'maleCount', width: 12, align: 'center' },
                { header: 'Mujeres', key: 'femaleCount', width: 12, align: 'center' },
                { header: 'Media H', key: 'maleAvg', width: 16, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Media M', key: 'femaleAvg', width: 16, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Gap', key: 'gap', width: 12, align: 'right', numFmt: '0.00%' }
            ],
            rows.map((row: any) => ({ ...row, gap: safeNumber(row.gap) / 100 })),
            'rose',
            context
        );

        return workbook.xlsx.writeBuffer();
    }
}
