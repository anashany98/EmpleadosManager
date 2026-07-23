import { MAX_IMPORT_ROWS, ParsedImportFile } from './importTypes';
import { AppError } from '../../utils/AppError';

export function normalizeString(value: string): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function compactNormalize(value: string): string {
    return normalizeString(value).replace(/\s+/g, '');
}

export function cleanText(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\s+/g, ' ').trim();
}

export function hasMeaningfulRowData(row: Record<string, any>): boolean {
    return Object.values(row).some((value) => cleanText(value) !== '');
}

export function looksLikeHeaderRow(row: Record<string, any>, headers: string[]): boolean {
    if (!row || headers.length === 0) return false;
    const normalizedHeaders = headers.map((header) => cleanText(header).toLowerCase());
    const values = Object.values(row).map((value) => cleanText(value).toLowerCase());
    if (values.length === 0) return false;
    let matches = 0;
    for (const value of values) {
        if (!value) continue;
        if (normalizedHeaders.includes(value)) matches += 1;
    }
    const nonEmpty = values.filter((value) => value !== '').length;
    return nonEmpty > 0 && matches / nonEmpty >= 0.6;
}

export function detectUtf16Encoding(buffer: Buffer): 'utf-16le' | 'utf-16be' | null {
    if (buffer.length >= 2) {
        if (buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf-16le';
        if (buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf-16be';
    }

    const sampleSize = Math.min(buffer.length, 128);
    let evenNulls = 0;
    let oddNulls = 0;

    for (let index = 0; index < sampleSize; index += 1) {
        if (buffer[index] !== 0x00) continue;
        if (index % 2 === 0) {
            evenNulls += 1;
        } else {
            oddNulls += 1;
        }
    }

    const threshold = Math.max(4, Math.floor(sampleSize / 10));
    if (oddNulls >= threshold && oddNulls > evenNulls * 2) return 'utf-16le';
    if (evenNulls >= threshold && evenNulls > oddNulls * 2) return 'utf-16be';
    return null;
}

export function decodeCsvBuffer(buffer: Buffer): { text: string; encoding: string } {
    const utf16Encoding = detectUtf16Encoding(buffer);
    if (utf16Encoding) {
        return {
            text: new TextDecoder(utf16Encoding).decode(buffer),
            encoding: utf16Encoding
        };
    }

    try {
        return {
            text: new TextDecoder('utf-8', { fatal: true }).decode(buffer),
            encoding: 'utf-8'
        };
    } catch {
        return {
            text: new TextDecoder('windows-1252').decode(buffer),
            encoding: 'windows-1252'
        };
    }
}

export function getFirstNonEmptyLine(text: string): string {
    const lines = text.split(/\r?\n/);
    return lines.find((line) => line.trim()) || '';
}

export function countDelimiter(line: string, delimiter: string): number {
    let count = 0;
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') {
            if (inQuotes && line[index + 1] === '"') {
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (!inQuotes && char === delimiter) count += 1;
    }

    return count;
}

export function detectDelimiter(text: string): string {
    const firstLine = getFirstNonEmptyLine(text);
    const candidates = [',', ';', '\t', '|'];

    let bestDelimiter = ',';
    let bestCount = -1;

    for (const candidate of candidates) {
        const count = countDelimiter(firstLine, candidate);
        if (count > bestCount) {
            bestCount = count;
            bestDelimiter = candidate;
        }
    }

    return bestDelimiter;
}

export function parseCsvText(text: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];

        if (inQuotes) {
            if (char === '"') {
                if (text[index + 1] === '"') {
                    currentField += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                currentField += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
            continue;
        }

        if (char === delimiter) {
            currentRow.push(currentField);
            currentField = '';
            continue;
        }

        if (char === '\r') {
            if (text[index + 1] === '\n') index += 1;
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = '';
            continue;
        }

        if (char === '\n') {
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = '';
            continue;
        }

        currentField += char;
    }

    if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }

    return rows
        .map((row) => row.map((cell) => cleanText(cell)))
        .filter((row) => row.some((cell) => cell !== ''));
}

export function parseCsvBuffer(buffer: Buffer): ParsedImportFile {
    const decoded = decodeCsvBuffer(buffer);
    const text = decoded.text.replace(/^\uFEFF/, '');
    const delimiter = detectDelimiter(text);
    const parsedRows = parseCsvText(text, delimiter);

    if (parsedRows.length === 0) {
        throw new Error('Archivo CSV vacio o no valido.');
    }

    if (parsedRows.length - 1 > MAX_IMPORT_ROWS) {
        throw new AppError(
            `El archivo contiene aproximadamente ${parsedRows.length - 1} filas, pero el m+ximo permitido es ${MAX_IMPORT_ROWS}. Divide el archivo en lotes m+s peque+os.`,
            400
        );
    }

    const headers = parsedRows[0].map((header, index) => cleanText(header) || `Columna ${index + 1}`);
    const rows = parsedRows.slice(1)
        .map((values) => {
            const row: Record<string, string> = {};
            headers.forEach((header, index) => {
                row[header] = cleanText(values[index] || '');
            });
            return row;
        })
        .filter((row) => hasMeaningfulRowData(row))
        .filter((row) => !looksLikeHeaderRow(row, headers));

    return {
        source: 'csv',
        headers,
        rows,
        meta: {
            encoding: decoded.encoding,
            delimiter: delimiter === '\t' ? 'TAB' : delimiter
        }
    };
}
