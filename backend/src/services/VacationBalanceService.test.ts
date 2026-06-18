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

    // ------------------------------------------------------------------
    // Additional edge cases (added in Sprint 2)
    // ------------------------------------------------------------------

    it('calculateNaturalDaysCount returns 0 when end is before start', () => {
        expect(calculateNaturalDaysCount(new Date('2026-06-05'), new Date('2026-06-01'))).toBe(0);
    });

    it('calculateProratedAnnualVacationDays returns 0 for a date in the next year', () => {
        // Jan 1 of the following year is beyond the year range.
        expect(calculateProratedAnnualVacationDays(new Date('2027-01-01'), 2026)).toBe(0);
    });

    it('calculateProratedAnnualVacationDays: entry mid-year is proportional to days remaining', () => {
        // Entry on July 1 in a 365-day year with quota 30:
        // remaining days = July 1 .. Dec 31 = 184 days
        // prorated = 30 * 184 / 365 ≈ 15.12
        const proration = calculateProratedAnnualVacationDays(new Date('2026-07-01'), 2026);
        expect(proration).toBeGreaterThan(14);
        expect(proration).toBeLessThan(16);
    });

    it('prorates with custom annual quota (e.g. part-time worker)', () => {
        expect(calculateProratedAnnualVacationDays(new Date('2026-01-01'), 2026, 22)).toBe(22);
        const midYear = calculateProratedAnnualVacationDays(new Date('2026-07-01'), 2026, 22);
        expect(midYear).toBeGreaterThan(10);
        expect(midYear).toBeLessThan(12);
    });

    it('summary: approved vacations reduce availableDays but pending ones are projected', async () => {
        (prisma.employee.findUnique as any).mockResolvedValue({
            id: 'emp-3',
            entryDate: new Date('2026-01-01'),
            createdAt: new Date('2026-01-01')
        });
        (prisma.employeeVacationBalance.findUnique as any).mockResolvedValue({
            employeeId: 'emp-3',
            year: 2026,
            annualQuotaDays: 30,
            carriedOverDays: 0,
            importedUsedDays: 0
        });
        (prisma.vacation.findMany as any).mockResolvedValue([
            { type: 'VACATION', startDate: new Date('2026-08-01'), endDate: new Date('2026-08-05'), status: 'APPROVED' },
            { type: 'VACATION', startDate: new Date('2026-12-20'), endDate: new Date('2026-12-25'), status: 'PENDING' }
        ]);

        const summary = await getEmployeeVacationBalanceSummary('emp-3', 2026);

        expect(summary.totalEntitledDays).toBe(30);
        // 5 days approved -> availableDays = 25
        expect(summary.availableDays).toBe(25);
        // 6 days pending -> projectedAvailableDays = 19
        expect(summary.projectedAvailableDays).toBe(19);
        expect(summary.pendingDays).toBe(6);
        expect(summary.approvedUsedDays).toBe(5);
    });

    it('summary: importedUsedDays is subtracted from availableDays (legacy imports)', async () => {
        (prisma.employee.findUnique as any).mockResolvedValue({
            id: 'emp-4',
            entryDate: new Date('2026-01-01'),
            createdAt: new Date('2026-01-01')
        });
        (prisma.employeeVacationBalance.findUnique as any).mockResolvedValue({
            employeeId: 'emp-4',
            year: 2026,
            annualQuotaDays: 30,
            carriedOverDays: 0,
            importedUsedDays: 10 // 10 days already used before migration
        });
        (prisma.vacation.findMany as any).mockResolvedValue([]);

        const summary = await getEmployeeVacationBalanceSummary('emp-4', 2026);
        expect(summary.availableDays).toBe(20);
        expect(summary.totalEntitledDays).toBe(30);
    });

    it('summary: carry-over from previous year is added to current year total', async () => {
        (prisma.employee.findUnique as any).mockResolvedValue({
            id: 'emp-5',
            entryDate: new Date('2026-01-01'),
            createdAt: new Date('2026-01-01')
        });
        (prisma.employeeVacationBalance.findUnique as any).mockImplementation(async ({ where }: any) => {
            if (where.employeeId_year.year === 2026) {
                return {
                    employeeId: 'emp-5',
                    year: 2026,
                    annualQuotaDays: 30,
                    carriedOverDays: 0,
                    importedUsedDays: 20 // used all 30, only 10 left
                };
            }
            return null;
        });
        (prisma.vacation.findMany as any).mockResolvedValue([]);

        // 2027 -> 10 days carry over from 2026
        const summary = await getEmployeeVacationBalanceSummary('emp-5', 2027);
        expect(summary.year).toBe(2027);
        expect(summary.carriedOverDays).toBe(10);
        expect(summary.totalEntitledDays).toBe(40); // 30 quota + 10 carry
        expect(summary.availableDays).toBe(40);
    });

    it('summary: PENDING vacations do not reduce availableDays (only projected)', async () => {
        (prisma.employee.findUnique as any).mockResolvedValue({
            id: 'emp-6',
            entryDate: new Date('2026-01-01'),
            createdAt: new Date('2026-01-01')
        });
        (prisma.employeeVacationBalance.findUnique as any).mockResolvedValue({
            employeeId: 'emp-6',
            year: 2026,
            annualQuotaDays: 30,
            carriedOverDays: 0,
            importedUsedDays: 0
        });
        (prisma.vacation.findMany as any).mockResolvedValue([
            { type: 'VACATION', startDate: new Date('2026-07-01'), endDate: new Date('2026-07-15'), status: 'PENDING' }
        ]);

        const summary = await getEmployeeVacationBalanceSummary('emp-6', 2026);
        // No APPROVED, so availableDays stays at 30
        expect(summary.availableDays).toBe(30);
        // 15 days pending -> projectedAvailableDays = 15
        expect(summary.projectedAvailableDays).toBe(15);
        expect(summary.pendingDays).toBe(15);
    });

    it('summary: REJECTED vacations are ignored entirely', async () => {
        (prisma.employee.findUnique as any).mockResolvedValue({
            id: 'emp-7',
            entryDate: new Date('2026-01-01'),
            createdAt: new Date('2026-01-01')
        });
        (prisma.employeeVacationBalance.findUnique as any).mockResolvedValue({
            employeeId: 'emp-7',
            year: 2026,
            annualQuotaDays: 30,
            carriedOverDays: 0,
            importedUsedDays: 0
        });
        (prisma.vacation.findMany as any).mockResolvedValue([
            { type: 'VACATION', startDate: new Date('2026-08-01'), endDate: new Date('2026-08-10'), status: 'REJECTED' }
        ]);

        const summary = await getEmployeeVacationBalanceSummary('emp-7', 2026);
        expect(summary.availableDays).toBe(30);
        expect(summary.approvedUsedDays).toBe(0);
        expect(summary.pendingDays).toBe(0);
    });

    it('summary: non-vacation types (e.g. MATERNITY) do not reduce the balance', async () => {
        (prisma.employee.findUnique as any).mockResolvedValue({
            id: 'emp-8',
            entryDate: new Date('2026-01-01'),
            createdAt: new Date('2026-01-01')
        });
        (prisma.employeeVacationBalance.findUnique as any).mockResolvedValue({
            employeeId: 'emp-8',
            year: 2026,
            annualQuotaDays: 30,
            carriedOverDays: 0,
            importedUsedDays: 0
        });
        // MATERNITY is in VACATION_TYPES_FOR_BALANCE (maternity leave IS a
        // vacation-like entitlement in Spain), so it should reduce the
        // balance. We use MEDICAL_LEAVE here instead, which is NOT.
        (prisma.vacation.findMany as any).mockResolvedValue([
            { type: 'MEDICAL_LEAVE', startDate: new Date('2026-09-01'), endDate: new Date('2026-09-15'), status: 'APPROVED' }
        ]);

        const summary = await getEmployeeVacationBalanceSummary('emp-8', 2026);
        expect(summary.availableDays).toBe(30);
        expect(summary.approvedUsedDays).toBe(0);
    });

    it('materializeVacationBalancesForYear: skips employees with no entryDate AND no createdAt', async () => {
        (prisma.employee.findMany as any).mockResolvedValue([
            {
                id: 'emp-noentry',
                entryDate: null,
                createdAt: null
            }
        ]);
        (prisma.employeeVacationBalance.findUnique as any).mockResolvedValue(null);
        (prisma.vacation.findMany as any).mockResolvedValue([]);

        const result = await materializeVacationBalancesForYear(2027);

        // Should still create a balance with the default quota (no proration)
        expect(result.created).toBe(1);
        expect(prisma.employeeVacationBalance.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    employeeId: 'emp-noentry',
                    year: 2027,
                    annualQuotaDays: 30
                })
            })
        );
    });
});
