import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { HolidayService } from './HolidayService';

vi.mock('../lib/prisma', () => ({
    prisma: {
        calendarEvent: { findMany: vi.fn() }
    }
}));

describe('HolidayService - calendario empresarial', () => {
    beforeEach(() => vi.clearAllMocks());

    it('descuenta festivos configurados para la empresa y eventos públicos', async () => {
        vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([
            {
                startDate: new Date('2026-07-22T00:00:00.000Z'),
                endDate: new Date('2026-07-22T23:59:59.000Z')
            }
        ] as any);

        const days = await HolidayService.getBusinessDaysCountForCompany(
            new Date('2026-07-20T00:00:00.000Z'),
            new Date('2026-07-24T00:00:00.000Z'),
            'company-1'
        );

        expect(days).toBe(4);
        expect(prisma.calendarEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                type: 'HOLIDAY',
                OR: [{ companyId: 'company-1' }, { companyId: null, isPublic: true }]
            })
        }));
    });

    it('cuenta un festivo de varios días una sola vez por fecha', async () => {
        vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([
            {
                startDate: new Date('2026-07-23T00:00:00.000Z'),
                endDate: new Date('2026-07-24T23:59:59.000Z')
            },
            {
                startDate: new Date('2026-07-24T00:00:00.000Z'),
                endDate: new Date('2026-07-24T23:59:59.000Z')
            }
        ] as any);

        await expect(HolidayService.getBusinessDaysCountForCompany(
            new Date('2026-07-20T00:00:00.000Z'),
            new Date('2026-07-26T00:00:00.000Z'),
            'company-1'
        )).resolves.toBe(3);
    });
});
