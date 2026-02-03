import * as XLSX from 'xlsx';

export class ExcelParser {
    /**
     * Parsea un buffer de archivo Excel y devuelve un array de objetos JSON
     * con las cabeceras como keys.
     */
    static parseBuffer(buffer: Buffer): any[] {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convertir a JSON crudo (array de objetos)
        // defval: "" asegura que celdas vacías no rompan la estructura si es necesario
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        return jsonData;
    }

    /**
     * Obtiene las cabeceras del archivo para mostrarlas en el frontend
     */
    static getHeaders(buffer: Buffer): string[] {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        // Leer solo la primera fila
        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
        return headers || [];
    }
}
