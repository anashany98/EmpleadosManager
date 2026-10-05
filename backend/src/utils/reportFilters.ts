import { AppError } from './AppError';

/** Date-only filters include the whole calendar day; explicit timestamps keep their precision. */
export function parseReportDate(value: unknown, endOfDay = false): Date | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') throw new AppError('La fecha no es válida', 400);
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new AppError('La fecha no es válida', 400);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        if (date.toISOString().slice(0, 10) !== value) throw new AppError('La fecha no es válida', 400);
        if (endOfDay) date.setUTCHours(23, 59, 59, 999);
    }
    return date;
}

export function parseReportDateRange(from: unknown, to: unknown, maxDays?: number) {
    const start = parseReportDate(from);
    const end = parseReportDate(to, true);
    if (start && end) {
        if (start > end) throw new AppError('La fecha inicial debe ser anterior o igual a la final', 400);
        if (maxDays && end.getTime() - start.getTime() >= maxDays * 86400000) {
            throw new AppError(`El rango máximo permitido es de ${maxDays} días`, 400);
        }
    }
    return { start, end };
}

export function parseReportYear(value: unknown): number {
    const year = value === undefined || value === '' ? new Date().getFullYear() : Number(value);
    if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new AppError('El año no es válido', 400);
    return year;
}

export function parseReportMonth(value: unknown): number | undefined {
    if (value === undefined || value === '') return undefined;
    const month = Number(value);
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new AppError('El mes debe estar entre 1 y 12', 400);
    return month;
}
