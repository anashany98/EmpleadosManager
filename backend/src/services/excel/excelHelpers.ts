import * as ExcelJS from 'exceljs';

export type Accent = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';

export interface ExcelContext {
    title?: string;
    subtitle?: string;
    periodLabel?: string;
    filters?: string[];
}

export interface MetricCard {
    label: string;
    value: string | number;
    hint?: string;
}

export interface TableColumn {
    header: string;
    key: string;
    width: number;
    align?: 'left' | 'center' | 'right';
    numFmt?: string;
    wrapText?: boolean;
}

export const COLORS: Record<Accent | 'navy' | 'slate' | 'muted' | 'border' | 'white' | 'success' | 'warning' | 'danger', string> = {
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

export function createWorkbook(subject: string) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RRHH';
    workbook.lastModifiedBy = 'OpenCode';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.company = 'RRHH';
    workbook.subject = subject;
    return workbook;
}

export function toCellValue(value: unknown): ExcelJS.CellValue {
    if (value === null || value === undefined) return '';
    if (value instanceof Date || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return String(value);
}

export function formatCurrency(value: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

export function formatNumber(value: number, decimals = 2) {
    return new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

export function formatPercent(value: number) {
    return `${formatNumber(value, 2)}%`;
}

export function formatDate(value?: string | Date | null) {
    if (!value) return '-';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('es-ES');
}

export function formatTime(value?: string | Date | null) {
    if (!value) return '-';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export function safeNumber(value: unknown) {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
}

export function uniqueCount(values: Array<string | null | undefined>) {
    return new Set(values.filter(Boolean)).size;
}

export function sumBy<T>(items: T[], selector: (item: T) => number) {
    return items.reduce((total, item) => total + selector(item), 0);
}

export function groupRows<T>(items: T[], keySelector: (item: T) => string) {
    const grouped = new Map<string, T[]>();
    items.forEach((item) => {
        const key = keySelector(item) || 'Sin asignar';
        const current = grouped.get(key) || [];
        current.push(item);
        grouped.set(key, current);
    });
    return grouped;
}

export function normalizeFilters(context?: ExcelContext) {
    const lines = [
        context?.periodLabel ? `Periodo: ${context.periodLabel}` : null,
        ...(context?.filters || []).filter(Boolean)
    ].filter(Boolean) as string[];

    return lines.length > 0 ? lines.join('  |  ') : 'Sin filtros adicionales';
}

export function configureSheet(sheet: ExcelJS.Worksheet, headerRowNumber: number) {
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

export function setColumns(sheet: ExcelJS.Worksheet, columns: TableColumn[]) {
    columns.forEach((column, index) => {
        const worksheetColumn = sheet.getColumn(index + 1);
        worksheetColumn.width = column.width;
    });
}

export function addReportBanner(
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

    const cardsPerRow = Math.min(4, metrics.length);
    const baseCardWidth = Math.max(2, Math.floor(finalColumn / cardsPerRow));

    metrics.slice(0, cardsPerRow).forEach((metric, index) => {
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

export function addTable(
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

export function addRankingSheet(
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

export const TIPO_LABEL_ES: Record<string, string> = {
    PER_DIEM: 'Dietas',
    LODGING: 'Hospedaje',
    FLIGHT: 'Vuelo',
    TRANSPORT: 'Transporte',
    CONTRACTOR: 'Autónomos',
    OTHER: 'Otros'
};
