import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = {
    employee: { updateMany: vi.fn() },
    user: { updateMany: vi.fn() },
    employeeVacationBalance: { upsert: vi.fn() },
    employmentPeriod: {
        updateMany: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn()
    },
    auditLog: { create: vi.fn() }
};

vi.mock('../lib/prisma', () => ({
    prisma: {
        employee: {
            findMany: vi.fn()
        },
        $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    }
}));

vi.mock('./AuditService', () => ({
    AuditService: { log: vi.fn() }
}));

vi.mock('./LoggerService', () => ({
    createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() })
}));

import { prisma } from '../lib/prisma';
import { EmployeeService } from './EmployeeService';

describe('EmployeeService employee deactivation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.employee.findMany).mockResolvedValue([
            {
                id: 'emp-1',
                companyId: 'company-1',
                entryDate: new Date('2024-01-01'),
                createdAt: new Date('2024-01-01')
            }
        ] as never);
        tx.employmentPeriod.updateMany.mockResolvedValue({ count: 1 });
    });

    it('records the termination, blocks access and leaves vacation balance at zero', async () => {
        await EmployeeService.bulkUpdate(
            { id: 'user-1', role: 'admin', companyId: 'company-1', email: 'rrhh@example.com' } as never,
            ['emp-1'],
            'deactivate',
            {
                terminationType: 'DISMISSAL',
                reason: 'Despido disciplinario',
                date: '2026-07-15'
            }
        );

        expect(tx.employee.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ['emp-1'] } },
            data: expect.objectContaining({
                active: false,
                lowReason: 'Despido disciplinario',
                vacationDaysTotal: 0
            })
        });
        expect(tx.user.updateMany).toHaveBeenCalledWith({
            where: { employeeId: { in: ['emp-1'] } },
            data: { isActive: false, sessionVersion: { increment: 1 } }
        });
        expect(tx.employeeVacationBalance.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: {
                    annualQuotaDays: 0,
                    carriedOverDays: 0,
                    importedUsedDays: 0,
                    advancedDays: 0
                }
            })
        );
        expect(tx.employmentPeriod.updateMany).toHaveBeenCalledWith({
            where: { employeeId: 'emp-1', endDate: null },
            data: expect.objectContaining({
                endType: 'DISMISSAL',
                endReason: 'Despido disciplinario',
                endedById: 'user-1'
            })
        });
    });
});
