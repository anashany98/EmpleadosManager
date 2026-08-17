import ExcelJS from 'exceljs';
import { AppError } from '../utils/AppError';
import { PayrollControlService, type DailyEntryPayload } from './PayrollControlService';

export interface TimeSheetImportPreview {
    sheetName: string;
    entries: DailyEntryPayload[];
    warnings: string[];
}

const normalize = (value: unknown) => String(value ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function cellValue(cell: ExcelJS.Cell): unknown {
    const value = cell.value as ExcelJS.CellValue | undefined;
    return typeof value === 'object' && value && 'result' in value ? value.result : value;
}

function dateFromCell(value: unknown): string | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === 'number' && Number.isFinite(value)) {
        const epoch = new Date(Date.UTC(1899, 11, 30));
        epoch.setUTCDate(epoch.getUTCDate() + Math.floor(value));
        return epoch.toISOString().slice(0, 10);
    }
    const text = String(value ?? '').trim();
    const parsed = /^([0-3]?\d)[/-]([01]?\d)[/-](\d{4})$/.exec(text);
    if (parsed) return `${parsed[3]}-${parsed[2].padStart(2, '0')}-${parsed[1].padStart(2, '0')}`;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function timeFromCell(value: unknown): string | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const hours = value.getUTCHours();
        const minutes = value.getUTCMinutes();
        return hours === 0 && minutes === 0 ? null : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        const totalMinutes = Math.round((value % 1) * 24 * 60);
        if (!totalMinutes) return null;
        return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
    }
    const match = /^(\d{1,2})[:.](\d{2})$/.exec(String(value ?? '').trim());
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
    const normalized = `${match[1].padStart(2, '0')}:${match[2]}`;
    return normalized === '00:00' ? null : normalized;
}

function hasTimeValue(value: unknown): boolean {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getUTCHours() !== 0 || value.getUTCMinutes() !== 0;
    if (typeof value === 'number') return value % 1 !== 0;
    return Boolean(String(value ?? '').trim()) && String(value).trim() !== '00:00' && String(value).trim() !== '0:00';
}

export class PayrollControlImportService {
    static async preview(buffer: Buffer, year: number, month: number): Promise<TimeSheetImportPreview> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Workbook['xlsx']['load']>[0]);
        const prefix = `${year}-${String(month).padStart(2, '0')}-`;

        for (const sheet of workbook.worksheets) {
            let headerRow = 0;
            sheet.eachRow((row, rowNumber) => {
                if (headerRow) return;
                const labels = [1, 2, 3, 4, 5, 6].map((column) => normalize(cellValue(row.getCell(column))));
                if (labels[1] === 'FECHAS' && labels[2] === 'ENTRADA' && labels[3] === 'SALIDA' && labels[4] === 'ENTRADA' && labels[5] === 'SALIDA') headerRow = rowNumber;
            });
            if (!headerRow) continue;

            const entries: DailyEntryPayload[] = [];
            const warnings: string[] = [];
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber <= headerRow) return;
                const workDate = dateFromCell(cellValue(row.getCell(2)));
                if (!workDate || !workDate.startsWith(prefix)) return;
                const times = [3, 4, 5, 6].map((column) => timeFromCell(cellValue(row.getCell(column))));
                const rawTimes = [3, 4, 5, 6].map((column) => cellValue(row.getCell(column)));
                if (rawTimes.some((value, index) => hasTimeValue(value) && !times[index])) {
                    warnings.push(`Fila ${rowNumber}: una hora no se ha podido interpretar.`);
                    return;
                }
                const notes = String(cellValue(row.getCell(12)) ?? '').trim();
                if (!times.some(Boolean) && !notes) return;
                entries.push({
                    workDate,
                    entryTime: times[0], breakOutTime: times[1], breakInTime: times[2], exitTime: times[3],
                    discountHours: 0.5, scheduledHours: 8, isHoliday: false, dietAmount: 0,
                    notes
                });
            });
            if (entries.length) return { sheetName: sheet.name, entries, warnings };
        }
        throw new AppError(`No se encontraron filas del ${String(month).padStart(2, '0')}/${year} con el formato de control horario.`, 422);
    }

    static async import(buffer: Buffer, recordId: string, expectedVersion: number, year: number, month: number, userId: string) {
        const preview = await this.preview(buffer, year, month);
        const record = await PayrollControlService.updateDailyEntries(recordId, expectedVersion, preview.entries, userId);
        return {
            record,
            importedDays: preview.entries.length,
            warnings: preview.warnings
        };
    }
}
