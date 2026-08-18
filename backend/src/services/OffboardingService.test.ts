import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = {
    employee: {
        findUnique: vi.fn(),
        update: vi.fn()
    },
    employmentPeriod: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn()
    },
    employeeVacationBalance: { upsert: vi.fn() },
    user: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() }
};

vi.mock('../lib/prisma', () => ({
    prisma: {
        $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    }
}));

vi.mock('./InventoryService', () => ({
    InventoryService: { returnAsset: vi.fn() }
}));

import { OffboardingService } from './OffboardingService';

describe('OffboardingService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        tx.employee.findUnique.mockResolvedValue({
            id: 'emp-1',
            active: true,
            companyId: 'company-1',
            entryDate: new Date('2024-01-01'),
            createdAt: new Date('2024-01-01')
        });
        tx.employmentPeriod.findFirst.mockResolvedValue({ id: 'period-1' });
    });

    it('records a dismissal and resets the employee vacation balance', async () => {
        await OffboardingService.completeOffboarding('emp-1', {
            exitDate: '2026-07-15',
            reason: 'DESPIDO',
            returnAssets: [],
            userId: 'user-1'
        });

        expect(tx.employmentPeriod.update).toHaveBeenCalledWith({
            where: { id: 'period-1' },
            data: expect.objectContaining({
                endType: 'DISMISSAL',
                endReason: 'Despido',
                endedById: 'user-1'
            })
        });
        expect(tx.employee.update).toHaveBeenCalledWith({
            where: { id: 'emp-1' },
            data: expect.objectContaining({
                active: false,
                lowReason: 'Despido',
                vacationDaysTotal: 0
            })
        });
        expect(tx.employeeVacationBalance.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    employeeId_year: {
                        employeeId: 'emp-1',
                        year: 2026
                    }
                },
                update: {
                    annualQuotaDays: 0,
                    carriedOverDays: 0,
                    importedUsedDays: 0,
                    advancedDays: 0
                }
            })
        );
        expect(tx.user.updateMany).toHaveBeenCalledWith({
            where: { employeeId: 'emp-1' },
            data: { isActive: false, sessionVersion: { increment: 1 } }
        });
    });
});
