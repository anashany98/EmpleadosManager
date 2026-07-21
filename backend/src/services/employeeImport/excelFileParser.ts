import ExcelJS from 'exceljs';
import { MAX_IMPORT_ROWS, ParsedImportFile } from './importTypes';
import { cleanText, hasMeaningfulRowData, looksLikeHeaderRow, parseCsvBuffer } from './csvParser';
import { AppError } from '../../utils/AppError';

/**
 * HIGH-007: este parser usaba `xlsx` (Prototype Pollution + ReDoS)
 * que ya no tiene fix upstream. Lo migramos a `exceljs`, que
 * ya estaba en dependencias para la generación de reportes.
 *
 * La API es distinta (workbook.read() vs XLSX.read()), pero la
 * semántica es equivalente. Acepta los mismos formatos (.xlsx,
 * .xls, .xlsm) con la salvedad de que exceljs NO carga .xls BIFF
 * legacy — si el proyecto necesita ese formato, mantener `xlsx`
 * en una versión parcheada (lo cual hoy no existe).
 */

export interface ExcelParserOptions {
    cellStyles?: boolean;
    cellFormula?: boolean;
    cellHTML?: boolean;
    cellNF?: boolean;
    cellText?: boolean;
}

const DEFAULT_OPTIONS: ExcelParserOptions = {
    cellStyles: false,
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellText: false
};

async function loadWorkbook(buffer: Buffer, options: ExcelParserOptions = {}): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    // exceljs lee de Buffer/Stream directamente. La opción
    // `cellStyles/cellFormula/...` no existe en exceljs: solo
    // leemos valores.
    // Cast: exceljs 4.x declara `Buffer` con la firma legacy
    // (ArrayBufferLike); nuestro `Buffer` es el global Node.
    // El doble cast pasa por la verificación estructural.
    const buf = buffer as unknown as Parameters<ExcelJS.Workbook['xlsx']['load']>[0];
    await workbook.xlsx.load(buf);
    return workbook;
}

export async function countExcelRows(buffer: Buffer): Promise<number> {
    const workbook = await loadWorkbook(buffer, DEFAULT_OPTIONS);
    const firstSheet = workbook.worksheets[0];
    if (!firstSheet) return 0;
    // rowCount incluye la fila de cabecera. Lo devolvemos tal
    // cual para mantener la semántica del caller.
    return firstSheet.rowCount;
}

export async function parseExcelBuffer(buffer: Buffer): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
    const workbook = await loadWorkbook(buffer, DEFAULT_OPTIONS);
    const firstSheet = workbook.worksheets[0];
    if (!firstSheet) return { headers: [], rows: [] };

    const headers: string[] = [];
    const headerRow = firstSheet.getRow(1);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // Alineamos headers por índice: la columna 1 -> headers[0]
        const value = cell.value;
        const text = value != null ? String(value) : '';
        headers[colNumber - 1] = text;
    });
    // Rellenamos huecos por si la primera fila tiene celdas vacías
    for (let i = 0; i < headers.length; i += 1) {
        if (headers[i] === undefined) headers[i] = '';
    }

    // Filas de datos: a partir de la fila 2
    const rows: Record<string, any>[] = [];
    firstSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // saltar cabecera
        const obj: Record<string, any> = {};
        for (let col = 0; col < headers.length; col += 1) {
            const header = headers[col] || `Columna ${col + 1}`;
            const cell = row.getCell(col + 1);
            obj[header] = cell.value ?? '';
        }
        rows.push(obj);
    });

    return { headers, rows };
}

export async function parseInputFile(buffer: Buffer): Promise<ParsedImportFile> {
    // Excel files start with "PK" (ZIP magic bytes)
    const isExcel = buffer[0] === 0x50 && buffer[1] === 0x4b;

    if (isExcel) {
        const rowCount = await countExcelRows(buffer);
        if (rowCount > MAX_IMPORT_ROWS) {
            throw new AppError(
                `El archivo contiene aproximadamente ${rowCount} filas, pero el maximo permitido es ${MAX_IMPORT_ROWS}. Divide el archivo en lotes mas pequenos.`,
                400
            );
        }

        const parsed = await parseExcelBuffer(buffer);
        const headers = parsed.headers.map((header, index) => cleanText(header) || `Columna ${index + 1}`);

        const rows = parsed.rows
            .map((row) => {
                const normalizedRow: Record<string, any> = {};
                headers.forEach((header) => {
                    normalizedRow[header] = row[header] ?? '';
                });
                return normalizedRow;
            })
            .filter((row) => hasMeaningfulRowData(row))
            .filter((row) => !looksLikeHeaderRow(row, headers));

        return {
            source: 'excel',
            headers,
            rows,
            meta: {}
        };
    }

    return parseCsvBuffer(buffer);
}

// Re-export para mantener compatibilidad con callers que usan
// `parseInputFile` o `parseExcelBuffer` síncronos. Como ahora son
// async, este módulo exporta también wrappers síncronos que
// rechazan (forzando al caller a migrar). En la práctica, todos
// los callers ya son async (los import services), pero dejamos
// este helper explícito para detectar regresiones.

/**
 * @deprecated use parseInputFile (async)
 */
export function parseInputFileSync(): never {
    throw new Error('parseInputFileSync ha sido eliminado tras migrar de xlsx a exceljs. Usa parseInputFile (async).');
}
