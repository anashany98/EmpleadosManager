import ExcelJS from 'exceljs';
import { AppError } from '../utils/AppError';
import type { DailyEntryPayload } from './PayrollControlService';

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
                const rawTimes = [3, 4, 5, 6].map((column) => cellValue(row.getCell(column)));
                const times = rawTimes.map((value) => timeFromCell(value));
                if (rawTimes.some((value, index) => hasTimeValue(value) && !times[index])) {
                    warnings.push(`Fila ${rowNumber}: una hora no se ha podido interpretar.`);
                    return;
                }
                const notes = String(cellValue(row.getCell(12)) ?? '').trim();
                const normalizedNotes = normalize(notes);
                // La plantilla marca el festivo en la columna OBSERVACIONES
                // ("Festivo"); la columna K depende de un libro externo, así que
                // no es fiable como señal.
                const isHoliday = normalizedNotes.includes('FESTIVO');
                // Sin turno partido, SALIDA 1 es el fin de jornada (la pausa la
                // recoge la columna DESCONTAR). Con turno partido, SALIDA 1 /
                // ENTRADA 2 son la pausa de comer y SALIDA 2 el fin de jornada.
                const hasSecondShift = Boolean(times[2] || times[3]);
                const entryTime = times[0];
                const breakOutTime = hasSecondShift ? times[1] : null;
                const breakInTime = hasSecondShift ? times[2] : null;
                const exitTime = hasSecondShift ? times[3] : (times[1] ?? null);
                if (!entryTime && !breakOutTime && !breakInTime && !exitTime && !notes) return;
                // DESCONTAR (col 8) y H.LAB (col 9) de la plantilla; si faltan,
                // se usan los valores por defecto (0,5 h de descanso y 8 h de jornada).
                const parseHoursCell = (column: number, fallback: number): number => {
                    const raw = cellValue(row.getCell(column));
                    const numeric = typeof raw === 'number' && Number.isFinite(raw)
                        ? raw
                        : typeof raw === 'string'
                            ? Number(raw.trim().replace(',', '.'))
                            : NaN;
                    return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : fallback;
                };
                entries.push({
                    workDate,
                    entryTime,
                    breakOutTime,
                    breakInTime,
                    exitTime,
                    discountHours: parseHoursCell(8, 0.5),
                    scheduledHours: parseHoursCell(9, 8),
                    isHoliday,
                    dietAmount: 0,
                    notes: isHoliday ? notes.replace(/festivo/gi, '').trim() : notes
                });
            });
            if (entries.length) return { sheetName: sheet.name, entries, warnings };
        }
        throw new AppError(`No se encontraron filas del ${String(month).padStart(2, '0')}/${year} con el formato de control horario.`, 422);
    }
}
