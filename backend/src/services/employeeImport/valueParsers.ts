import { isValid, parse as parseDateString } from 'date-fns';
import { cleanText } from './csvParser';
import { normalizeString } from './csvParser';

export function collectSampleValues(rows: Record<string, any>[], header: string): string[] {
    const values: string[] = [];

    for (const row of rows) {
        const rawValue = row[header];
        const value = cleanText(rawValue);
        if (!value) continue;
        values.push(value);
        if (values.length >= 3) break;
    }

    return values;
}

export function isLikelyEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isLikelyPhone(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 7;
}

export function isLikelyDni(value: string): boolean {
    return /^[XYZ]?\d{5,8}[A-Z]$/i.test(value.trim());
}

export function parseBool(value: any): boolean | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value;
    const normalized = normalizeString(cleanText(value));
    if (!normalized) return null;
    if (['si', 's', 'yes', 'true', '1', 'x'].includes(normalized)) return true;
    if (['no', 'n', 'false', '0'].includes(normalized)) return false;
    return null;
}

export function parseMoney(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    const raw = cleanText(value);
    if (!raw) return null;

    let normalized = raw.replace(/\s+/g, '').replace(/€/g, '');

    if (normalized.includes(',') && normalized.includes('.')) {
        if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
            normalized = normalized.replace(/\./g, '').replace(',', '.');
        } else {
            normalized = normalized.replace(/,/g, '');
        }
    } else if (normalized.includes(',')) {
        const lastComma = normalized.lastIndexOf(',');
        const afterComma = normalized.slice(lastComma + 1);
        if (afterComma.length === 3 && /^\d{3}$/.test(afterComma)) {
            normalized = normalized.replace(/,/g, '');
        } else {
            normalized = normalized.replace(/\./g, '').replace(',', '.');
        }
    }

    normalized = normalized.replace(/[^0-9.-]/g, '');
    if (!normalized || normalized === '-' || normalized === '.') return null;

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

export function parseDate(value: any): Date | null {
    if (!value && value !== 0) return null;

    if (value instanceof Date) {
        return isValid(value) ? value : null;
    }

    if (typeof value === 'number') {
        if (value < 0 || value > 73050) return null;
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        if (!isValid(date)) return null;
        const year = date.getFullYear();
        if (year < 1900 || year > 2100) return null;
        return date;
    }

    const raw = cleanText(value);
    if (!raw) return null;

    if (/^\d{6,}$/.test(raw)) {
        if (/^\d{8}$/.test(raw)) {
            const compactParsed = parseDateString(raw, 'yyyyMMdd', new Date());
            if (isValid(compactParsed)) {
                const year = compactParsed.getFullYear();
                if (year >= 1900 && year <= 2100) return compactParsed;
            }
        }
        return null;
    }

    const formats = ['dd/MM/yyyy', 'd/M/yyyy', 'dd-MM-yyyy', 'd-M-yyyy', 'yyyy-MM-dd', 'dd.MM.yyyy', 'd.M.yyyy'];
    for (const format of formats) {
        const parsed = parseDateString(raw, format, new Date());
        if (isValid(parsed)) {
            const year = parsed.getFullYear();
            if (year >= 1900 && year <= 2100) return parsed;
        }
    }

    const fallback = new Date(raw);
    if (!isValid(fallback)) return null;
    const fallbackYear = fallback.getFullYear();
    if (fallbackYear < 1900 || fallbackYear > 2100) return null;
    return fallback;
}

export function formatPreviewDate(value: Date | null): string {
    if (!value) return '';
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function parseWeeklyHours(value: any): number | null {
    return parseMoney(value);
}

export function normalizeGender(value: any): string | null {
    const raw = normalizeString(cleanText(value));
    if (!raw) return null;

    const exactToken = (token: string) => raw === token;
    const tokenIncluded = (token: string) => {
        if (raw === token) return true;
        return new RegExp(`\\b${token}\\b`).test(raw);
    };

    if (['hombre', 'masculino', 'male', 'varon'].some(tokenIncluded)) return 'MALE';
    if (['mujer', 'femenino', 'female'].some(tokenIncluded)) return 'FEMALE';
    if (exactToken('m')) return 'MALE';
    if (exactToken('f')) return 'FEMALE';
    if (['otro', 'other', 'no binario'].some(tokenIncluded)) return 'OTHER';
    return null;
}

export function normalizeWorkingDayType(value: any): string {
    const raw = normalizeString(cleanText(value));
    if (!raw) return 'COMPLETE';
    if (['parcial', 'partial', 'part time', 'media jornada'].some((term) => raw.includes(term))) return 'PARTIAL';
    return 'COMPLETE';
}

export function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function uniqueValues(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean)));
}
