/**
 * scheduleCalc.ts — réplica frontend de las fórmulas del backend
 * (backend/src/services/EmployeeScheduleService.ts). Se usa para
 * feedback en vivo mientras el usuario edita sin esperar al backend.
 *
 * REGLA: si cambias la fórmula aquí, cámbiala también en el backend
 * y viceversa. La paridad se valida con tests.
 */
export interface DayInput {
    date: string;
    entry1?: string | null;
    exit1?: string | null;
    entry2?: string | null;
    exit2?: string | null;
    discountMin?: number;
    notes?: string | null;
}

export interface DayComputed extends DayInput {
    hoursWorked: number;
    hoursExtra: number;
    hoursExtraFestive: number;
    isWeekend: boolean;
    isHoliday: boolean;
    holidayName?: string;
}

const DEFAULT_DAILY_HOURS = 8;
const DEFAULT_LUNCH_BREAK_MIN = 30;

export function parseHHmm(s: string | null | undefined): number | null {
    if (!s) return null;
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
    return h * 60 + mm;
}

function diffMinutes(a: number, b: number): number {
    if (b < a) return b + 24 * 60 - a;
    return b - a;
}

export function isWeekend(iso: string): boolean {
    const d = new Date(iso + 'T00:00:00Z');
    const dow = d.getUTCDay();
    return dow === 0 || dow === 6;
}

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
        hoursExtraFestive = hoursWorked;
        hoursExtra = 0;
    } else {
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
