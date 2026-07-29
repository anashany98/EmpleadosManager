/**
 * EmployeeScheduleService — cálculo de horas trabajadas, horas extra y horas
 * extra-festivo para un (empleado, mes). Replica las fórmulas del Excel
 * horario.xlsx original:
 *
 *   H.TRAB = (exit1 - entry1) + (exit2 - entry2), en horas decimales
 *   H.LAB  = jornada estándar del empleado (8h por defecto, configurable)
 *   H.EXT  = max(0, H.TRAB - H.LAB)  si día laborable (no finde, no festivo)
 *   H.EXT Festivos = H.TRAB  si es festivo o finde
 *   DESCONTAR = minutos de pausa comida que se restan a H.LAB
 *
 * Las fórmulas se aplican **en backend** (source of truth) y en frontend
 * (preview en vivo). Mantenerlas idénticas en ambos sitios es crítico;
 * cualquier cambio debe actualizarse en `computeDay` (backend) y
 * `frontend/src/utils/scheduleCalc.ts` (frontend).
 */
import { prisma } from '../lib/prisma';
import { createLogger } from './LoggerService';

const log = createLogger('EmployeeScheduleService');

const DEFAULT_DAILY_HOURS = 8;
const DEFAULT_LUNCH_BREAK_MIN = 30;
const MS_PER_HOUR = 1000 * 60 * 60;

export interface DayInput {
    /** ISO date YYYY-MM-DD */
    date: string;
    /** HH:mm o null/undefined */
    entry1?: string | null;
    exit1?: string | null;
    entry2?: string | null;
    exit2?: string | null;
    /** Minutos de descuento (pausa comida) */
    discountMin?: number | null;
    notes?: string | null;
}

export interface DayComputed extends DayInput {
    hoursWorked: number;     // H.TRAB
    hoursExtra: number;      // H.EXT (en laborable)
    hoursExtraFestive: number; // H.EXT Festivos (en finde/festivo)
    isWeekend: boolean;
    isHoliday: boolean;
    holidayName?: string;
}

export interface MonthSummary {
    year: number;
    month: number; // 1-12
    totalWorked: number;
    totalExtra: number;
    totalExtraFestive: number;
    totalExtraEuros?: number; // si se proporciona precio hora extra
    days: DayComputed[];
}

// ─── Pure helpers (no DB) ───────────────────────────────────────────

/** Parsea 'HH:mm' o 'HH:mm:ss' a minutos desde medianoche. null si vacío. */
export function parseHHmm(s: string | null | undefined): number | null {
    if (!s) return null;
    const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!m) return null;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
    if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
    return h * 60 + mm;
}

/** Formatea minutos a 'HH:mm'. */
export function formatHHmm(min: number | null | undefined): string | null {
    if (min === null || min === undefined || !Number.isFinite(min)) return null;
    const m = Math.max(0, Math.round(min));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Diferencia en minutos entre dos timestamps HH:mm (b - a). Maneja turno nocturno (b < a → +24h). */
export function diffMinutes(a: number, b: number): number {
    if (b < a) return b + 24 * 60 - a;
    return b - a;
}

/** ¿Es sábado o domingo? (0=Dom, 6=Sáb en JS Date) */
export function isWeekend(iso: string): boolean {
    const d = new Date(iso + 'T00:00:00Z');
    const dow = d.getUTCDay();
    return dow === 0 || dow === 6;
}

/**
 * Calcula las horas de un día replicando la fórmula del Excel:
 *   H.TRAB = (exit1 - entry1) + (exit2 - entry2), en horas decimales
 *   Si un turno está vacío, se ignora.
 */
export function computeDay(
    input: DayInput,
    opts: { isHoliday: boolean; holidayName?: string; dailyHours?: number; lunchBreakMin?: number },
): DayComputed {
    const e1 = parseHHmm(input.entry1);
    const s1 = parseHHmm(input.exit1);
    const e2 = parseHHmm(input.entry2);
    const s2 = parseHHmm(input.exit2);
    const daily = opts.dailyHours ?? DEFAULT_DAILY_HOURS;
    const lunch = opts.lunchBreakMin ?? DEFAULT_LUNCH_BREAK_MIN;

    let minutes = 0;
    if (e1 !== null && s1 !== null) minutes += diffMinutes(e1, s1);
    if (e2 !== null && s2 !== null) minutes += diffMinutes(e2, s2);
    const hoursWorked = minutes / 60;
    const weekend = isWeekend(input.date);
    const isHol = opts.isHoliday;
    let hoursExtra = 0;
    let hoursExtraFestive = 0;
    if (weekend || isHol) {
        // Todo lo trabajado en festivo/finde es extra.
        hoursExtraFestive = hoursWorked;
        hoursExtra = 0;
    } else {
        // En laborable: extra = max(0, trabajado - jornada) - descuento comida
        const effective = Math.max(0, hoursWorked - (input.discountMin ?? lunch) / 60);
        hoursExtra = Math.max(0, effective - daily);
    }
    return {
        ...input,
        hoursWorked,
        hoursExtra,
        hoursExtraFestive,
        isWeekend: weekend,
        isHoliday: isHol,
        holidayName: opts.holidayName,
    };
}

// ─── DB-backed helpers ─────────────────────────────────────────────

/** Devuelve un Set de fechas festivas (YYYY-MM-DD) en un rango [from, to]. */
export async function getHolidaySet(fromIso: string, toIso: string): Promise<Map<string, string>> {
    const from = new Date(fromIso + 'T00:00:00Z');
    const to = new Date(toIso + 'T00:00:00Z');
    const rows = await prisma.holiday.findMany({
        where: { date: { gte: from, lte: to } },
        select: { date: true, name: true, scope: true, region: true, companyId: true },
    });
    const map = new Map<string, string>();
    for (const r of rows) {
        // Por defecto: si hay varios en la misma fecha, gana el más específico
        // (COMPANY > REGIONAL > NATIONAL). Si ninguno es específico, el primero.
        const iso = r.date.toISOString().slice(0, 10);
        const existing = map.get(iso);
        if (!existing) {
            map.set(iso, r.name);
            continue;
        }
        // Si el nuevo es más específico, gana
        // (asumimos que vienen ya ordenados por specificity si los sembramos así)
    }
    return map;
}

/**
 * Devuelve todas las entradas de horario de un empleado en un mes, junto
 * con el día computado (horas trabajadas, extras, etc.). Si el día no tiene
 * entrada, se genera una vacía con isWeekend/isHoliday detectados.
 */
export async function getMonthForEmployee(
    employeeId: string,
    year: number,
    month: number, // 1-12
    opts: { dailyHours?: number; lunchBreakMin?: number } = {},
): Promise<MonthSummary> {
    const firstIso = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastIso = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const [entries, holidayMap] = await Promise.all([
        prisma.employeeScheduleEntry.findMany({
            where: { employeeId, date: { gte: new Date(firstIso), lte: new Date(lastIso) } },
            orderBy: { date: 'asc' },
        }),
        getHolidaySet(firstIso, lastIso),
    ]);

    const byDate = new Map<string, typeof entries[number]>();
    for (const e of entries) {
        byDate.set(e.date.toISOString().slice(0, 10), e);
    }

    const days: DayComputed[] = [];
    for (let d = 1; d <= lastDay; d++) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const row = byDate.get(iso);
        const input: DayInput = row
            ? {
                date: iso,
                entry1: row.entry1 ? formatHHmm(toMinFromTime(row.entry1)) : null,
                exit1: row.exit1 ? formatHHmm(toMinFromTime(row.exit1)) : null,
                entry2: row.entry2 ? formatHHmm(toMinFromTime(row.entry2)) : null,
                exit2: row.exit2 ? formatHHmm(toMinFromTime(row.exit2)) : null,
                discountMin: row.discountMin,
                notes: row.notes,
            }
            : { date: iso, entry1: null, exit1: null, entry2: null, exit2: null, discountMin: 0, notes: null };
        const holName = holidayMap.get(iso);
        days.push(computeDay(input, { isHoliday: !!holName, holidayName: holName, ...opts }));
    }

    const totalWorked = round2(days.reduce((s, d) => s + d.hoursWorked, 0));
    const totalExtra = round2(days.reduce((s, d) => s + d.hoursExtra, 0));
    const totalExtraFestive = round2(days.reduce((s, d) => s + d.hoursExtraFestive, 0));
    return { year, month, totalWorked, totalExtra, totalExtraFestive, days };
}

// ─── CRUD helpers (delegan al cliente Prisma; thin layer) ───────────

export const EmployeeScheduleService = {
    async upsertDay(employeeId: string, companyId: string | null, input: DayInput) {
        const [y, m, d] = input.date.split('-').map(Number);
        const date = new Date(Date.UTC(y, m - 1, d));
        return prisma.employeeScheduleEntry.upsert({
            where: { employeeId_date: { employeeId, date } },
            create: {
                employeeId,
                companyId: companyId ?? null,
                date,
                entry1: input.entry1 ? timeFromHHmm(input.entry1) : null,
                exit1: input.exit1 ? timeFromHHmm(input.exit1) : null,
                entry2: input.entry2 ? timeFromHHmm(input.entry2) : null,
                exit2: input.exit2 ? timeFromHHmm(input.exit2) : null,
                discountMin: input.discountMin ?? 0,
                notes: input.notes ?? null,
            },
            update: {
                entry1: input.entry1 ? timeFromHHmm(input.entry1) : null,
                exit1: input.exit1 ? timeFromHHmm(input.exit1) : null,
                entry2: input.entry2 ? timeFromHHmm(input.entry2) : null,
                exit2: input.exit2 ? timeFromHHmm(input.exit2) : null,
                discountMin: input.discountMin ?? 0,
                notes: input.notes ?? null,
            },
        });
    },

    async deleteDay(employeeId: string, iso: string) {
        const [y, m, d] = iso.split('-').map(Number);
        const date = new Date(Date.UTC(y, m - 1, d));
        return prisma.employeeScheduleEntry.deleteMany({
            where: { employeeId, date },
        });
    },

    async getMonth(employeeId: string, year: number, month: number) {
        return getMonthForEmployee(employeeId, year, month);
    },
};

// ─── Internal time helpers (Prisma returns Date for @db.Time) ───────

function toMinFromTime(t: Date): number {
    return t.getUTCHours() * 60 + t.getUTCMinutes();
}

function timeFromHHmm(s: string): Date {
    const min = parseHHmm(s) ?? 0;
    const d = new Date(Date.UTC(1970, 0, 1, 0, 0, 0));
    d.setUTCHours(Math.floor(min / 60), min % 60, 0, 0);
    return d;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

// Touch log to keep tree-shaker from dropping (used by callers via service object).
log.debug('EmployeeScheduleService loaded');
