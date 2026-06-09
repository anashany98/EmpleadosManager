import * as ExcelJS from 'exceljs';

export class ExcelParser {
    /**
     * Extracts the raw value from an ExcelJS cell.
     * For date cells, converts the Date back to an Excel serial number
     * to maintain compatibility with the xlsx library's sheet_to_json behavior.
     */
    static getCellRawValue(cell: ExcelJS.Cell): any {
        if (!cell || cell.value === null || cell.value === undefined) {
            return undefined;
        }

        const { ValueType } = ExcelJS;

        switch (cell.type) {
            case ValueType.Number:
                return cell.value as number;
            case ValueType.String:
                return cell.value as string;
            case ValueType.Boolean:
                return cell.value as boolean;
            case ValueType.Date:
                // Convert Date back to Excel serial number
                // to maintain compatibility with xlsx sheet_to_json(raw:true)
                return ((cell.value as Date).getTime() / 86400000) + 25569;
            case ValueType.Formula: {
                const result = (cell.value as any).result;
                if (result instanceof Date) {
                    return (result.getTime() / 86400000) + 25569;
                }
                return result;
            }
            case ValueType.RichText:
                return (cell.value as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('');
            case ValueType.Hyperlink:
                return (cell.value as any).text ?? cell.value;
            case ValueType.Error:
                return (cell.value as any).error ?? cell.value;
            default:
                return cell.value;
        }
    }

    /**
     * Reads a sheet into an array of JSON objects, similar to XLSX.utils.sheet_to_json.
     * @param buffer The Excel file buffer
     * @param options.defval Default value for empty cells (omit to exclude empty keys)
     * @returns Object with `headers` (array of header names in column order) and
     *   `rows` (array of plain objects keyed by header name). Headers and rows
     *   are extracted in a single workbook pass to keep peak memory bounded.
     */
    static async readSheetAsJson(buffer: Buffer, options?: { defval?: any }): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) return { headers: [], rows: [] };

        // Read headers from first row, preserving column order
        const headerRow = worksheet.getRow(1);
        const headerEntries: { col: number; name: string }[] = [];
        headerRow.eachCell((cell, colNumber) => {
            const name = cell.value != null ? String(cell.value) : '';
            if (name) {
                headerEntries.push({ col: colNumber, name });
            }
        });
        const headers = headerEntries.map((entry) => entry.name);

        const defval = options?.defval;
        const data: Record<string, any>[] = [];

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const obj: Record<string, any> = {};

            for (const { col, name } of headerEntries) {
                const cell = row.getCell(col);
                const value = ExcelParser.getCellRawValue(cell);
                if (value !== undefined) {
                    obj[name] = value;
                } else if (defval !== undefined) {
                    obj[name] = defval;
                }
            }

            data.push(obj);
        });

        return { headers, rows: data };
    }

    /**
     * Parsea un buffer de archivo Excel y devuelve un array de objetos JSON
     * con las cabeceras como keys.
     */
    static async parseBuffer(buffer: Buffer): Promise<any[]> {
        const { rows } = await ExcelParser.readSheetAsJson(buffer, { defval: "" });
        return rows;
    }

    /**
     * Obtiene las cabeceras del archivo para mostrarlas en el frontend
     */
    static async getHeaders(buffer: Buffer): Promise<string[]> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) return [];

        const headers: string[] = [];
        const firstRow = worksheet.getRow(1);
        firstRow.eachCell((cell) => {
            headers.push(cell.value != null ? String(cell.value) : '');
        });

        return headers;
    }
}
