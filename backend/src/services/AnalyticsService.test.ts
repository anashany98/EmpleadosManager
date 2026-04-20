import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { AnalyticsService } from './AnalyticsService';

vi.mock('../lib/prisma', () => ({
    prisma: {
        employee: {
            count: vi.fn(),
            findMany: vi.fn()
        },
        vacation: {
            count: vi.fn()
        }
    }
}));

vi.mock('./LoggerService', () => ({
    createLogger: () => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    })
}));

describe('AnalyticsService.getMainKPIs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.employee.count)
            .mockResolvedValueOnce(10 as never)
            .mockResolvedValueOnce(8 as never)
            .mockResolvedValueOnce(1 as never)
            .mockResolvedValueOnce(1 as never);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([
            { entryDate: new Date('2020-01-01') }
        ] as never);
        vi.mocked(prisma.vacation.count).mockResolvedValue(2 as never);
    });

    it('applies company filters consistently across KPI queries', async () => {
        await AnalyticsService.getMainKPIs({ companyId: 'company-1' });

        expect(vi.mocked(prisma.employee.count).mock.calls[0]?.[0]).toEqual({
            where: { companyId: 'company-1' }
        });
        expect(vi.mocked(prisma.employee.count).mock.calls[1]?.[0]).toEqual({
            where: { active: true, companyId: 'company-1' }
        });
        expect(vi.mocked(prisma.employee.count).mock.calls[2]?.[0]).toEqual({
            where: {
                companyId: 'company-1',
                createdAt: expect.any(Object)
            }
        });
        expect(prisma.employee.findMany).toHaveBeenCalledWith({
            where: { active: true, companyId: 'company-1' },
            select: { entryDate: true }
        });
        expect(prisma.vacation.count).toHaveBeenCalledWith({
            where: {
                status: 'PENDING',
                employee: { companyId: 'company-1' }
            }
        });
    });
});
