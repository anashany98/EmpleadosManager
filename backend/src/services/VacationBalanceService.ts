import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HolidayService } from './HolidayService';
import type { Decimal } from '@prisma/client/runtime/library';

export const DEFAULT_ANNUAL_VACATION_DAYS = 30;

type DbClient = Prisma.TransactionClient | typeof prisma;

type EmployeeBalanceEmployee = {
    id: string;
    entryDate?: Date | null;
    createdAt?: Date | null;
};

interface MaterializedVacationBalanceResult {
    created: boolean;
    summary: VacationBalanceSummary;
}

type VacationBalanceRecord = {
    year: number;
    annualQuotaDays: number | Decimal;
    carriedOverDays: number | Decimal;
    importedUsedDays: number | Decimal;
};

type VacationRecord = {
    startDate: Date | string;
    endDate: Date | string;
    status?: string | null;
    type?: string | null;
};

type VacationBalanceSummaryState = {
    summary: VacationBalanceSummary;
    anchored: boolean;
    explicit: boolean;
};

export interface VacationBalanceSummary {
    year: number;
    annualQuotaDays: number;
    carriedOverDays: number;
    importedUsedDays: number;
    totalEntitledDays: number;
    approvedUsedDays: number;
    pendingDays: number;
    availableDays: number;
    projectedAvailableDays: number;
}

function roundVacationValue(value: number | Decimal): number {
    return Number(value.toFixed(2));
}

function isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function normalizeDay(value: Date | string): Date {
    const date = new Date(value);
    const normalized = new Date(date);
    normalized.setHours(12, 0, 0, 0);
    return normalized;
}

export const VACATION_TYPES_FOR_BALANCE = ['VACATION', 'MATERNIDAD', 'PATERNIDAD', 'MATERNITY', 'PATERNITY'];

export function isVacationType(type?: string | null): boolean {
    if (!type) {
        return true; // Default is VACATION
    }
    return VACATION_TYPES_FOR_BALANCE.includes(type);
}

export function getVacationYearRange(year: number) {
    return {
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31, 23, 59, 59, 999)
    };
}

export function calculateNaturalDaysCount(startDate: Date, endDate: Date): number {
    const current = normalizeDay(startDate);
    const target = normalizeDay(endDate);

    if (current > target) {
        return 0;
    }

    let count = 0;
    while (current <= target) {
        count += 1;
        current.setDate(current.getDate() + 1);
    }

    return count;
}

export function calculateVacationRequestDays(startDate: Date, endDate: Date, type?: string | null): number {
    return isVacationType(type)
        ? calculateNaturalDaysCount(startDate, endDate)
        : HolidayService.getBusinessDaysCount(startDate, endDate);
}

export function calculateProratedAnnualVacationDays(referenceDate: Date, year: number, annualQuota = DEFAULT_ANNUAL_VACATION_DAYS): number {
    const { start, end } = getVacationYearRange(year);
    const normalizedReference = normalizeDay(referenceDate);
    const normalizedYearStart = normalizeDay(start);
    const normalizedYearEnd = normalizeDay(end);

    if (normalizedReference <= normalizedYearStart) {
        return annualQuota;
    }

    if (normalizedReference > normalizedYearEnd) {
        return 0;
    }

    const remainingDays = calculateNaturalDaysCount(normalizedReference, normalizedYearEnd);
    const totalDays = calculateNaturalDaysCount(normalizedYearStart, normalizedYearEnd);
    return roundVacationValue((annualQuota * remainingDays) / totalDays);
}

function getEmployeeReferenceDate(employee: EmployeeBalanceEmployee): Date | null {
    return employee.entryDate || employee.createdAt || null;
}

function buildDefaultVacationBalance(employee: EmployeeBalanceEmployee, year: number): VacationBalanceRecord {
    const referenceDate = getEmployeeReferenceDate(employee);
    const annualQuotaDays = referenceDate
        ? calculateProratedAnnualVacationDays(referenceDate, year)
        : DEFAULT_ANNUAL_VACATION_DAYS;

    return {
        year,
        annualQuotaDays,
        carriedOverDays: 0,
        importedUsedDays: 0
    };
}

function calculateVacationOverlapDays(vacation: VacationRecord, year: number): number {
    if (!isVacationType(vacation.type)) {
        return 0;
    }

    const { start, end } = getVacationYearRange(year);
    const normalizedVacationStart = normalizeDay(vacation.startDate);
    const normalizedVacationEnd = normalizeDay(vacation.endDate);
    const normalizedYearStart = normalizeDay(start);
    const normalizedYearEnd = normalizeDay(end);

    const overlapStart = normalizedVacationStart > normalizedYearStart ? normalizedVacationStart : normalizedYearStart;
    const overlapEnd = normalizedVacationEnd < normalizedYearEnd ? normalizedVacationEnd : normalizedYearEnd;

    if (overlapStart > overlapEnd) {
        return 0;
    }

    return calculateNaturalDaysCount(overlapStart, overlapEnd);
}

export function summarizeVacationBalance(
    balance: VacationBalanceRecord,
    vacations: VacationRecord[],
    year: number
): VacationBalanceSummary {
    const approvedUsedDays = vacations.reduce((sum, vacation) => {
        if (vacation.status !== 'APPROVED') {
            return sum;
        }

        return sum + calculateVacationOverlapDays(vacation, year);
    }, 0);

    const pendingDays = vacations.reduce((sum, vacation) => {
        if (vacation.status !== 'PENDING') {
            return sum;
        }

        return sum + calculateVacationOverlapDays(vacation, year);
    }, 0);

    const totalEntitledDays = roundVacationValue(Number(balance.annualQuotaDays) + Number(balance.carriedOverDays));
    const availableDays = roundVacationValue(totalEntitledDays - Number(balance.importedUsedDays) - approvedUsedDays);
    const projectedAvailableDays = roundVacationValue(availableDays - pendingDays);

    return {
        year,
        annualQuotaDays: roundVacationValue(balance.annualQuotaDays),
        carriedOverDays: roundVacationValue(balance.carriedOverDays),
        importedUsedDays: roundVacationValue(balance.importedUsedDays),
        totalEntitledDays,
        approvedUsedDays: roundVacationValue(approvedUsedDays),
        pendingDays: roundVacationValue(pendingDays),
        availableDays,
        projectedAvailableDays
    };
}

async function getVacationBalanceState(
    employee: EmployeeBalanceEmployee,
    year: number,
    db: DbClient,
    cache: Map<string, Promise<VacationBalanceSummaryState>>
): Promise<VacationBalanceSummaryState> {
    const cacheKey = `${employee.id}:${year}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const pendingState = (async () => {
        const { start, end } = getVacationYearRange(year);
        const [explicitBalance, vacations] = await Promise.all([
            db.employeeVacationBalance.findUnique({
                where: {
                    employeeId_year: {
                        employeeId: employee.id,
                        year
                    }
                }
            }),
            db.vacation.findMany({
                where: {
                    employeeId: employee.id,
                    startDate: { lte: end },
                    endDate: { gte: start },
                    type: { in: VACATION_TYPES_FOR_BALANCE }
                },
                select: {
                    startDate: true,
                    endDate: true,
                    status: true,
                    type: true
                }
            })
        ]);

        let balance = explicitBalance
            ? {
                year,
                annualQuotaDays: explicitBalance.annualQuotaDays,
                carriedOverDays: explicitBalance.carriedOverDays,
                importedUsedDays: explicitBalance.importedUsedDays
            }
            : buildDefaultVacationBalance(employee, year);
        let anchored = Boolean(explicitBalance);

        if (!explicitBalance) {
            const referenceDate = getEmployeeReferenceDate(employee);
            const referenceYear = referenceDate?.getFullYear() ?? year;
            if (year > referenceYear) {
                const previousState = await getVacationBalanceState(employee, year - 1, db, cache);
                if (previousState.anchored) {
                    balance = {
                        ...balance,
                        carriedOverDays: roundVacationValue(Math.max(0, previousState.summary.projectedAvailableDays))
                    };
                    anchored = true;
                }
            }
        }

        return {
            summary: summarizeVacationBalance(balance, vacations, year),
            anchored,
            explicit: Boolean(explicitBalance)
        };
    })();

    cache.set(cacheKey, pendingState);
    return pendingState;
}

async function getEmployeeBalanceEmployee(employeeId: string, db: DbClient): Promise<EmployeeBalanceEmployee | null> {
    return db.employee.findUnique({
        where: { id: employeeId },
        select: {
            id: true,
            entryDate: true,
            createdAt: true
        }
    });
}

export async function getEmployeeVacationBalanceSummary(
    employeeId: string,
    year: number,
    tx?: Prisma.TransactionClient
): Promise<VacationBalanceSummary | null> {
    const db = tx || prisma;
    const employee = await getEmployeeBalanceEmployee(employeeId, db);

    if (!employee) {
        return null;
    }

    const state = await getVacationBalanceState(employee, year, db, new Map());
    return state.summary;
}

export async function getCurrentEmployeeVacationBalanceSummary(
    employeeId: string,
    tx?: Prisma.TransactionClient
): Promise<VacationBalanceSummary | null> {
    return getEmployeeVacationBalanceSummary(employeeId, new Date().getFullYear(), tx);
}

export async function materializeEmployeeVacationBalance(
    employee: EmployeeBalanceEmployee,
    year: number,
    tx?: Prisma.TransactionClient
): Promise<MaterializedVacationBalanceResult> {
    const db = tx || prisma;
    const state = await getVacationBalanceState(employee, year, db, new Map());

    if (state.explicit) {
        return {
            created: false,
            summary: state.summary
        };
    }

    try {
        await db.employeeVacationBalance.create({
            data: {
                employeeId: employee.id,
                year,
                annualQuotaDays: roundVacationValue(state.summary.annualQuotaDays),
                carriedOverDays: roundVacationValue(state.summary.carriedOverDays),
                importedUsedDays: roundVacationValue(state.summary.importedUsedDays)
            }
        });
    } catch (error) {
        if (!isUniqueConstraintError(error)) {
            throw error;
        }

        return {
            created: false,
            summary: state.summary
        };
    }

    return {
        created: true,
        summary: state.summary
    };
}

export async function materializeVacationBalancesForYear(
    year: number,
    tx?: Prisma.TransactionClient
): Promise<{ year: number; processed: number; created: number; skipped: number }> {
    const db = tx || prisma;
    const employees = await db.employee.findMany({
        where: {
            active: true
        },
        select: {
            id: true,
            entryDate: true,
            createdAt: true
        }
    });

    let created = 0;

    for (const employee of employees) {
        const result = await materializeEmployeeVacationBalance(employee, year, tx);
        if (result.created) {
            created += 1;
        }
    }

    return {
        year,
        processed: employees.length,
        created,
        skipped: employees.length - created
    };
}

export async function upsertEmployeeVacationBalance(
    employee: EmployeeBalanceEmployee,
    year: number,
    values: {
        annualQuotaDays?: number | null;
        carriedOverDays?: number | null;
        importedUsedDays?: number | null;
    },
    tx?: Prisma.TransactionClient
) {
    const db = tx || prisma;
    const existing = await db.employeeVacationBalance.findUnique({
        where: {
            employeeId_year: {
                employeeId: employee.id,
                year
            }
        }
    });
    const fallback = buildDefaultVacationBalance(employee, year);

    const annualQuotaDays = roundVacationValue(values.annualQuotaDays ?? existing?.annualQuotaDays ?? fallback.annualQuotaDays);
    const carriedOverDays = roundVacationValue(values.carriedOverDays ?? existing?.carriedOverDays ?? 0);
    const importedUsedDays = roundVacationValue(values.importedUsedDays ?? existing?.importedUsedDays ?? 0);

    return db.employeeVacationBalance.upsert({
        where: {
            employeeId_year: {
                employeeId: employee.id,
                year
            }
        },
        create: {
            employeeId: employee.id,
            year,
            annualQuotaDays,
            carriedOverDays,
            importedUsedDays
        },
        update: {
            annualQuotaDays,
            carriedOverDays,
            importedUsedDays
        }
    });
}
