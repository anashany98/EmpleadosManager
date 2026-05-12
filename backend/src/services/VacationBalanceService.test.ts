import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import {
    calculateNaturalDaysCount,
    calculateProratedAnnualVacationDays,
    getEmployeeVacationBalanceSummary,
    materializeVacationBalancesForYear
} from './VacationBalanceService';

vi.mock('../lib/prisma', () => ({
    prisma: {
        employee: {
            findUnique: vi.fn(),
            findMany: vi.fn()
        },
        employeeVacationBalance: {
            findUnique: vi.fn(),
            create: vi.fn()
        },
        vacation: {
            findMany: vi.fn()
        }
    }
}));

describe('VacationBalanceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.employee.findMany as any).mockResolvedValue([]);
        (prisma.employeeVacationBalance.create as any).mockResolvedValue(undefined);
    });

    it('counts natural vacation days inclusively', () => {
        expect(calculateNaturalDaysCount(new Date('2026-06-01'), new Date('2026-06-05'))).toBe(5);
        expect(calculateNaturalDaysCount(new Date('2026-06-01'), new Date('2026-06-01'))).toBe(1);
    });

    it('prorates new employee quota from entry date to year end', () => {
        expect(calculateProratedAnnualVacationDays(new Date('2026-01-01'), 2026)).toBe(30);
        expect(calculateProratedAnnualVacationDays(new Date('2026-12-31'), 2026)).toBeCloseTo(0.08, 2);
    });

    it('derives carry over from the previous anchored year', async () => {
        (prisma.employee.findUnique as any).mockResolvedValue({
            id: 'emp-1',
            entryDate: new Date('2026-01-01'),
            createdAt: new Date('2026-01-01')
        });
        (prisma.employeeVacationBalance.findUnique as any).mockImplementation(async ({ where }: any) => {
            if (where.employeeId_year.year === 2026) {
                return {
                    employeeId: 'emp-1',
                    year: 2026,
                    annualQuotaDays: 30,
                    carriedOverDays: 0,
                    importedUsedDays: 5
                };
            }

            return null;
        });
        (prisma.vacation.findMany as any).mockImplementation(async ({ where }: any) => {
            const endYear = where.startDate.lte.getFullYear();
            if (endYear === 2026) {
                return [
                    {
                        type: 'VACATION',
                        startDate: new Date('2026-08-01'),
                        endDate: new Date('2026-08-10'),
                        status: 'APPROVED'
                    }
                ];
            }

            return [];
        });

        const summary2027 = await getEmployeeVacationBalanceSummary('emp-1', 2027);

        expect(summary2027).toEqual(expect.objectContaining({
            year: 2027,
            carriedOverDays: 15,
            totalEntitledDays: 45,
            availableDays: 45
        }));
    });

    it('materializes missing balances for active employees in the current year rollover', async () => {
        (prisma.employee.findMany as any).mockResolvedValue([
            {
                id: 'emp-1',
                entryDate: new Date('2023-01-01'),
                createdAt: new Date('2023-01-01')
            }
        ]);
        (prisma.employeeVacationBalance.findUnique as any).mockImplementation(async ({ where }: any) => {
            if (where.employeeId_year.year === 2026) {
                return {
                    employeeId: 'emp-1',
                    year: 2026,
                    annualQuotaDays: 30,
                    carriedOverDays: 0,
                    importedUsedDays: 5
                };
            }

            return null;
        });
        (prisma.vacation.findMany as any).mockImplementation(async ({ where }: any) => {
            const year = where.startDate.lte.getFullYear();
            if (year === 2026) {
                return [
                    {
                        type: 'VACATION',
                        startDate: new Date('2026-08-01'),
                        endDate: new Date('2026-08-10'),
                        status: 'APPROVED'
                    }
                ];
            }

            return [];
        });

        const result = await materializeVacationBalancesForYear(2027);

        expect(result).toEqual({
            year: 2027,
            processed: 1,
            created: 1,
            skipped: 0
        });
        expect(prisma.employeeVacationBalance.create).toHaveBeenCalledWith({
            data: {
                employeeId: 'emp-1',
                year: 2027,
                annualQuotaDays: 30,
                carriedOverDays: 15,
                importedUsedDays: 0
            }
        });
    });

    it('skips materialization when the year balance already exists', async () => {
        (prisma.employee.findMany as any).mockResolvedValue([
            {
                id: 'emp-2',
                entryDate: new Date('2024-01-01'),
                createdAt: new Date('2024-01-01')
            }
        ]);
        (prisma.employeeVacationBalance.findUnique as any).mockResolvedValue({
            employeeId: 'emp-2',
            year: 2027,
            annualQuotaDays: 30,
            carriedOverDays: 3,
            importedUsedDays: 1
        });
        (prisma.vacation.findMany as any).mockResolvedValue([]);

        const result = await materializeVacationBalancesForYear(2027);

        expect(result).toEqual({
            year: 2027,
            processed: 1,
            created: 0,
            skipped: 1
        });
        expect(prisma.employeeVacationBalance.create).not.toHaveBeenCalled();
    });
});
