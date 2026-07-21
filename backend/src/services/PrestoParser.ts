import { OBRA_EXPENSE_TYPES, OBRA_TYPE_LABELS, type ObraExpenseType } from '../../../shared/obras';

export const PRESTO_HINT_VS_FIELDS = {
    referencia: 'obra_code' as const,
    fecha: 'date' as const,
    proveedor: 'vendor' as const,
    totalBase: 'amount' as const,
    descripcion: 'description' as const,
    numero: 'reference' as const
};

export interface PrestoMappingHints {
    headers: string[];
    defaultMapping: Record<string, string>;
    autoTipo: 'PER_DIEM' | 'LODGING' | 'FLIGHT' | 'TRANSPORT' | 'OTHER';
    isPresto: true;
}

export interface PrestoMappedRow {
    rowIndex: number;
    obra_code: string;
    date: Date;
    type: ObraExpenseType;
    amount: number;
    currency: 'EUR';
    vendor: string;
    reference: string;
    description: string;
}

export interface PrestoPreviewResult {
    isPresto: true;
    pedidos: PrestoPedido[];
    suggestedRowCount: number;
}

export interface PrestoPedido {
    rowInicio: number;
    rowFin: number;
    referencia: string | null;
    numero: string | null;
    fecha: Date | null;
    proveedor: string | null;
    totalConIva: number | null;
    base: number | null;
    descripcion: string | null;
    cantidad: number | null;
    totalBase: number | null;
    localizador: string | null;
    typeHint: ObraExpenseType | null;
}

export interface PrestoDetection {
    isPresto: boolean;
    motivo: string | null;
    pedidos: PrestoPedido[];
}

const TYPE_KEYWORDS: Array<{ keywords: string[]; type: ObraExpenseType }> = [
    { keywords: ['vuelo', 'vuelos', 'billete', 'aereo', 'aereos', 'avion', 'tren', 'renfe'], type: 'FLIGHT' },
    { keywords: ['hospedaje', 'hotel', 'alojamiento', 'hostal', 'apartamento'], type: 'LODGING' },
    { keywords: ['dieta', 'dietas', 'manutencion', 'comida', 'comidas'], type: 'PER_DIEM' },
    { keywords: ['transporte', 'taxi', 'uber', 'cabify', 'tren', 'transfer', 'autobus'], type: 'TRANSPORT' }
];

function inferType(description: string | null): ObraExpenseType | null {
    if (!description) return null;
    const text = description.toLowerCase();
    for (const { keywords, type } of TYPE_KEYWORDS) {
        if (keywords.some((kw) => text.includes(kw))) return type;
    }
    return null;
}

function extractLocalizador(description: string | null): string | null {
    if (!description) return null;
    const m = description.match(/LOCALIZADOR\s*[:\s]\s*([A-Z0-9\-_/]{4,})/i);
    return m ? m[1] : null;
}

function toNumber(v: unknown): number | null {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const cleaned = String(v).replace(/\s/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}

function isPrestoCabecera1(cell?: any[]): boolean {
    const first = (cell?.[0] ?? '').toString().trim().toLowerCase();
    return first === 's.';
}

export interface RawRow {
    cells: unknown[];
    rowNumber: number;
}

function readCells(sheet: { getRow: (n: number) => { getCell: (c: number) => { value: unknown } } }, rowNumber: number, maxCols: number): unknown[] {
    const r = sheet.getRow(rowNumber);
    const out: unknown[] = [];
    for (let c = 1; c <= maxCols; c++) out.push(r.getCell(c).value);
    return out;
}

export const PrestoParser = {
    detectAndParse(sheet: { rowCount: number; columnCount: number; getRow: (n: number) => { getCell: (c: number) => { value: unknown } } }): PrestoDetection {
        if (sheet.rowCount < 9 || sheet.columnCount < 8) {
            return { isPresto: false, motivo: 'Hoja demasiado pequeña', pedidos: [] };
        }

        const headerRow = readCells(sheet, 7, sheet.columnCount);
        if (!isPrestoCabecera1(headerRow)) {
            return { isPresto: false, motivo: 'Fila 7 no tiene forma de cabeceras Presto (S./Núm./...)', pedidos: [] };
        }

        const pedidos: PrestoPedido[] = [];
        let r = 8;
        while (r <= sheet.rowCount) {
            const firstCells = readCells(sheet, r, sheet.columnCount);
            const a = (firstCells[0] ?? '').toString().trim().toLowerCase();
            if (!a.startsWith('referencia:')) {
                r += 1;
                continue;
            }
            const referenciaRaw = (firstCells[0] ?? '').toString().trim();
            const refMatch = referenciaRaw.match(/^Referencia:\s*(.+)$/i);
            const referencia = refMatch ? refMatch[1].trim() : referenciaRaw;

            const pedidoRow = readCells(sheet, r + 1, sheet.columnCount);
            const numero = String(pedidoRow[1] ?? '').trim();
            const num = toNumber(pedidoRow[1]);
            const fecha = pedidoRow[2] instanceof Date
                ? (pedidoRow[2] as Date)
                : (typeof pedidoRow[2] === 'string' ? new Date(pedidoRow[2]) : null);
            const fechaValida = fecha instanceof Date && !isNaN(fecha.getTime()) ? fecha : null;
            const proveedor = String(pedidoRow[3] ?? '').trim() || null;
            const totalConIva = toNumber(pedidoRow[10]);
            const base = toNumber(pedidoRow[7]);

            if (!num || !fechaValida || !totalConIva) {
                r += 8;
                continue;
            }

            const detalleRow = readCells(sheet, r + 4, sheet.columnCount);
            const descripcion = String(detalleRow[3] ?? detalleRow[1] ?? '').trim() || null;
            const cantidad = toNumber(detalleRow[4]);
            const totalBase = toNumber(detalleRow[11]);
            const localizador = extractLocalizador(descripcion);
            const typeHint = inferType(descripcion);

            pedidos.push({
                rowInicio: r,
                rowFin: r + 7,
                referencia,
                numero,
                fecha: fechaValida,
                proveedor,
                totalConIva,
                base,
                descripcion,
                cantidad,
                totalBase,
                localizador,
                typeHint
            });

            r += 8;
        }

        return { isPresto: true, motivo: null, pedidos };
    },

    buildMappingHints(headers: string[]): PrestoMappingHints {
        const findCol = (candidates: string[]) => {
            const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '_');
            return headers.find((h) => candidates.some((c) => norm(h) === norm(c))) || '';
        };
        const headerFor = (key: keyof typeof PRESTO_HINT_VS_FIELDS) => findCol([key, `${key}_presto`]);

        const defaultMapping: Record<string, string> = {};
        const refHeader = headerFor('referencia');
        const dateHeader = headerFor('fecha');
        const providerHeader = headerFor('proveedor');
        const amountHeader = headerFor('totalBase');
        const descriptionHeader = headerFor('descripcion');
        const numeroHeader = headerFor('numero');

        if (refHeader) defaultMapping['obra_code'] = refHeader;
        if (dateHeader) defaultMapping['date'] = dateHeader;
        if (providerHeader) defaultMapping['vendor'] = providerHeader;
        if (amountHeader) defaultMapping['amount'] = amountHeader;
        if (descriptionHeader) defaultMapping['description'] = descriptionHeader;
        if (numeroHeader) defaultMapping['reference'] = numeroHeader;
        defaultMapping['type'] = '';
        defaultMapping['currency'] = '';
        defaultMapping['employee_dni'] = '';
        defaultMapping['vendor'] = defaultMapping['vendor'] || '';
        defaultMapping['origin'] = '';
        defaultMapping['destination'] = '';

        return {
            headers,
            defaultMapping,
            autoTipo: 'OTHER',
            isPresto: true
        };
    },

    toMappedRows(pedidos: PrestoPedido[], options: { defaultType?: ObraExpenseType; overrideObraCode?: string | null } = {}): Array<{
        obra_code: string; date: Date; type: ObraExpenseType; amount: number; currency: 'EUR';
        vendor: string; reference: string; description: string; rowIndex: number;
        originalRef: string | null;
    }> {
        const override = options.overrideObraCode && options.overrideObraCode.trim() !== '' ? options.overrideObraCode.trim() : null;
        return pedidos
            .filter((p) => (override || p.referencia) && p.fecha && (p.totalBase != null || p.totalConIva != null))
            .map((p, idx) => ({
                rowIndex: idx + 1,
                obra_code: override || p.referencia || '',
                originalRef: p.referencia || null,
                date: p.fecha as Date,
                type: options.defaultType || p.typeHint || 'OTHER',
                amount: p.totalBase ?? p.totalConIva ?? 0,
                currency: 'EUR',
                vendor: p.proveedor || '',
                reference: (p.localizador || p.numero || '').toString(),
                description: p.descripcion || p.referencia || ''
            }));
    }
};
