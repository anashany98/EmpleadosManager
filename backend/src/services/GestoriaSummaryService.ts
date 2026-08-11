/**
 * GestoriaSummaryService — cálculo del resumen (BRUTO, IRPF, TGSS) por
 * periodo y por empleado.
 *
 * Replica las fórmulas del Excel `resumen empleado.xlsx` original:
 *
 *   H.EXT.    = horas extra normales × precio hora extra
 *   H.S/D.    = horas extra finde × precio hora finde
 *   total €   = H.EXT. + H.S/D.
 *   % neto    = 1 - IRPF - TGSS
 *   BRUTO     = total € / % neto             (importe bruto que produce ese neto)
 *   DIFERENCIA = BRUTO - total €             (margen para la gestoría)
 *
 * Los conceptos se identifican por convención de `code` (case-insensitive,
 * sin acentos, se ignoran espacios y puntos). Si un operador no sigue la
 * convención, ese campo se computa como 0 y el resto sigue funcionando.
 *
 * Convenciones soportadas (orden de preferencia):
 *   - Horas extra (HOURS):  code contiene "EXTRA" y NO contiene "S/D" ni "FINDE"
 *   - Horas finde (HOURS):  code contiene "S/D" o "FINDE" o "FESTIVO"
 *   - Precio hora extra:    code contiene "PRECIO" y ("EXTRA" o "HORA")
 *   - Precio hora finde:    code contiene "PRECIO" y ("S/D" o "FINDE")
 *   - IRPF (PERCENT):       code == "IRPF"
 *   - TGSS (PERCENT):       code == "TGSS" o "SS"
 *
 * Si solo hay un concepto de horas y otro de precio, se aplican los
 * precios al global (no se distingue normal vs finde).
 */
import { prisma } from '../lib/prisma';
import { createLogger } from './LoggerService';

const log = createLogger('GestoriaSummaryService');

// ─── Helpers de matching por convención ─────────────────────────────

/** Quita acentos y pasa a minúsculas. */
function norm(s: string | null | undefined): string {
    if (!s) return '';
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s._\-/]+/g, '');
}

interface DetectedConcepts {
    horasExtra: string | null;   // conceptId de las horas extra normales
    horasFinde: string | null;   // conceptId de las horas finde/festivo
    precioExtra: string | null;  // conceptId del precio hora extra
    precioFinde: string | null;  // conceptId del precio hora finde
    irpf: string | null;         // conceptId del ratio IRPF
    tgss: string | null;         // conceptId del ratio TGSS
}

interface ConceptLite {
    id: string;
    code: string;
    label: string;
    type: 'HOURS' | 'PRICE' | 'AMOUNT' | 'PERCENT' | 'BOOLEAN' | 'TEXT';
}

/**
 * Detecta qué conceptos del periodo se usan para el cálculo del resumen.
 * Devuelve los IDs de los conceptos reconocidos (o null si no existen).
 */
export function detectConcepts(concepts: ConceptLite[]): DetectedConcepts {
    const result: DetectedConcepts = {
        horasExtra: null,
        horasFinde: null,
        precioExtra: null,
        precioFinde: null,
        irpf: null,
        tgss: null,
    };
    for (const c of concepts) {
        const n = norm(c.code);
        const lbl = norm(c.label);
        const key = (n || lbl);
        if (c.type === 'HOURS' && !result.horasExtra && /extra/.test(key) && !/sd|finde|festivo/.test(key)) {
            result.horasExtra = c.id;
        } else if (c.type === 'HOURS' && !result.horasFinde && /sd|finde|festivo/.test(key)) {
            result.horasFinde = c.id;
        } else if (c.type === 'PRICE' && !result.precioExtra && /precio/.test(key) && /extra|hora|normal/.test(key)) {
            // Precio explícitamente de horas extra / normales
            result.precioExtra = c.id;
        } else if (c.type === 'PRICE' && !result.precioFinde && /precio/.test(key) && /sd|finde|festivo/.test(key)) {
            result.precioFinde = c.id;
        } else if (c.type === 'PRICE' && !result.precioExtra && /precio/.test(key)) {
            // Precio genérico (sin sufijo): se usa para ambos.
            // Si luego aparece uno específico para finde, este queda como "extra".
            result.precioExtra = c.id;
        } else if (c.type === 'PERCENT' && !result.irpf && key === 'irpf') {
            result.irpf = c.id;
        } else if (c.type === 'PERCENT' && !result.tgss && (key === 'tgss' || key === 'ss')) {
            result.tgss = c.id;
        }
    }
    // Si solo hay un precio (genérico), se usa también para finde
    // (muchas empresas no diferencian precio normal vs finde).
    if (result.precioExtra && !result.precioFinde) {
        result.precioFinde = result.precioExtra;
    } else if (result.precioFinde && !result.precioExtra) {
        result.precioExtra = result.precioFinde;
    }
    return result;
}

// ─── Cálculo del resumen ────────────────────────────────────────────

export interface SummaryRow {
    rowId: string;
    employeeId: string | null;
    employeeName: string;
    department: string | null;
    category: string | null;
    horasExtra: number;
    horasFinde: number;
    precioExtra: number;
    precioFinde: number;
    totalHorasExtra: number;   // horas × precio horas extra
    totalHorasFinde: number;   // horas × precio horas finde
    totalEuros: number;         // H.EXT. + H.S/D.
    irpf: number;               // 0..1
    tgss: number;               // 0..1
    porcentajeNeto: number;     // 1 - IRPF - TGSS
    bruto: number;              // total € / % neto
    diferencia: number;         // BRUTO - total €
    isReviewed: boolean;
}

export interface PeriodSummary {
    periodId: string;
    detected: DetectedConcepts & { missing: string[] };
    rows: SummaryRow[];
    totals: {
        horasExtra: number;
        horasFinde: number;
        totalEuros: number;
        bruto: number;
        diferencia: number;
    };
    byCategory: Array<{
        category: string;
        employees: number;
        totalEuros: number;
        bruto: number;
    }>;
}

function num(v: number | string | { toString(): string } | null | undefined): number {
    if (v === null || v === undefined) return 0;
    // Prisma devuelve `Decimal` para los campos numéricos; lo
    // convertimos con `String(...)` para soportar tanto Decimal
    // como number plano (tests, mocks).
    const n = Number(typeof v === 'object' ? v.toString() : v);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Computa el resumen para un periodo completo.
 * Hace 1 round-trip a la BD (rows + concepts) y todo el cálculo en memoria.
 */
export async function getPeriodSummary(periodId: string): Promise<PeriodSummary> {
    const [period, concepts, rows] = await Promise.all([
        prisma.gestoriaPeriod.findUnique({ where: { id: periodId }, select: { id: true, companyId: true } }),
        prisma.gestoriaConcept.findMany({ where: { periodId } }),
        prisma.gestoriaEmployeeRow.findMany({
            where: { periodId },
            include: { cells: true },
            orderBy: { employeeName: 'asc' },
        }),
    ]);
    if (!period) {
        const err = new Error('Periodo no encontrado');
        (err as Error & { status?: number }).status = 404;
        throw err;
    }

    const detected = detectConcepts(concepts as ConceptLite[]);
    const missing: string[] = [];
    if (!detected.horasExtra && !detected.horasFinde) missing.push('horas extra o finde');
    if (!detected.precioExtra && !detected.precioFinde) missing.push('precio hora extra o finde');
    if (!detected.irpf) missing.push('IRPF');
    if (!detected.tgss) missing.push('TGSS');

    const summaryRows: SummaryRow[] = rows.map((r) => {
        const cellMap = new Map(r.cells.map((c) => [c.conceptId, c]));
        const hE = num(cellMap.get(detected.horasExtra ?? '')?.numericValue);
        const hF = num(cellMap.get(detected.horasFinde ?? '')?.numericValue);
        const pE = num(cellMap.get(detected.precioExtra ?? '')?.numericValue);
        const pF = num(cellMap.get(detected.precioFinde ?? '')?.numericValue);
        const irpf = num(cellMap.get(detected.irpf ?? '')?.numericValue);
        const tgss = num(cellMap.get(detected.tgss ?? '')?.numericValue);
        const totalHE = hE * pE;
        const totalHF = hF * pF;
        const totalEuros = round2(totalHE + totalHF);
        const pctNeto = Math.max(0, 1 - irpf - tgss);
        const bruto = pctNeto > 0 ? round2(totalEuros / pctNeto) : 0;
        const diferencia = round2(bruto - totalEuros);
        return {
            rowId: r.id,
            employeeId: r.employeeId,
            employeeName: r.employeeName ?? '—',
            department: r.department,
            category: r.category,
            horasExtra: round2(hE),
            horasFinde: round2(hF),
            precioExtra: round2(pE),
            precioFinde: round2(pF),
            totalHorasExtra: round2(totalHE),
            totalHorasFinde: round2(totalHF),
            totalEuros,
            irpf: round4(irpf),
            tgss: round4(tgss),
            porcentajeNeto: round4(pctNeto),
            bruto,
            diferencia,
            isReviewed: r.isReviewed,
        };
    });

    const totals = summaryRows.reduce(
        (acc, r) => ({
            horasExtra: round2(acc.horasExtra + r.horasExtra),
            horasFinde: round2(acc.horasFinde + r.horasFinde),
            totalEuros: round2(acc.totalEuros + r.totalEuros),
            bruto: round2(acc.bruto + r.bruto),
            diferencia: round2(acc.diferencia + r.diferencia),
        }),
        { horasExtra: 0, horasFinde: 0, totalEuros: 0, bruto: 0, diferencia: 0 },
    );

    // Por categoría
    const byCatMap = new Map<string, { employees: number; totalEuros: number; bruto: number }>();
    for (const r of summaryRows) {
        const cat = r.category || 'Sin categoría';
        const prev = byCatMap.get(cat) ?? { employees: 0, totalEuros: 0, bruto: 0 };
        prev.employees += 1;
        prev.totalEuros = round2(prev.totalEuros + r.totalEuros);
        prev.bruto = round2(prev.bruto + r.bruto);
        byCatMap.set(cat, prev);
    }
    const byCategory = Array.from(byCatMap.entries()).map(([category, v]) => ({
        category, ...v,
    }));

    log.debug(`summary for period=${periodId}: ${summaryRows.length} rows, missing: ${missing.join(',')}`);

    return {
        periodId,
        detected: { ...detected, missing },
        rows: summaryRows,
        totals,
        byCategory,
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function round4(n: number): number {
    return Math.round(n * 10000) / 10000;
}

export const GestoriaSummaryService = {
    detectConcepts,
    getPeriodSummary,
};
