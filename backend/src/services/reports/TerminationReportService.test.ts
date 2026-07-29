import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/prisma', () => ({
    prisma: {
        employmentPeriod: {
            findMany: vi.fn()
        }
    }
}));

vi.mock('../EncryptionService', () => ({
    EncryptionService: {
        decrypt: vi.fn((value: string) => value)
    }
}));

import { prisma } from '../../lib/prisma';
import { TerminationReportService } from './TerminationReportService';

describe('TerminationReportService', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns company-scoped monthly departures with name, DNI, reason and date', async () => {
        vi.mocked(prisma.employmentPeriod.findMany).mockResolvedValue([
            {
                id: 'period-1',
                endDate: new Date('2026-07-15T12:00:00'),
                endReason: 'Fin de obra',
                endType: 'CONTRACT_END',
                employee: {
                    id: 'emp-1',
                    name: 'Ana',
                    firstName: 'Ana',
                    lastName: 'Pérez',
                    dni: '12345678A',
                    department: 'Obras'
                }
            }
        ] as never);

        const rows = await TerminationReportService.getMonthlyTerminations(2026, 7, {
            companyId: 'company-1'
        });

        expect(prisma.employmentPeriod.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    companyId: 'company-1',
                    endDate: {
                        gte: new Date(2026, 6, 1),
                        lte: new Date(2026, 7, 0, 23, 59, 59, 999)
                    }
                })
            })
        );
        expect(rows).toEqual([
            expect.objectContaining({
                employee: 'Ana Pérez',
                dni: '12345678A',
                type: 'CONTRACT_END',
                reason: 'Fin de obra',
                date: new Date('2026-07-15T12:00:00')
            })
        ]);
    });
});
