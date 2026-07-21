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
        expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { active: true, companyId: 'company-1' },
            select: expect.objectContaining({ entryDate: true })
        }));
        expect(prisma.vacation.count).toHaveBeenCalledWith({
            where: {
                status: 'PENDING',
                employee: { companyId: 'company-1' }
            }
        });
    });

    /**
     * MED-009: la métrica "departures" (bajas en los últimos 30
     * días) debe usar `exitDate` (campo canónico escrito al
     * desactivar) y NO `updatedAt` (que se actualiza con
     * CUALQUIER edición). El bug original hacía que un
     * ex-empleado al que se le editaba el teléfono apareciera
     * como baja reciente, falseando la métrica de turnover.
     */
    it('counts departures by exitDate, not by updatedAt', async () => {
        vi.mocked(prisma.employee.count)
            .mockResolvedValueOnce(10 as never) // total
            .mockResolvedValueOnce(8 as never)  // active
            .mockResolvedValueOnce(1 as never)  // newHires (createdAt)
            .mockResolvedValueOnce(2 as never); // departures
        vi.mocked(prisma.employee.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.vacation.count).mockResolvedValue(0 as never);

        await AnalyticsService.getMainKPIs({ companyId: 'company-1' });

        const departuresCall = vi.mocked(prisma.employee.count).mock.calls[3]?.[0] as {
            where: Record<string, unknown>;
        };
        // El campo temporal del filtro debe ser `exitDate`, NO
        // `updatedAt`.
        expect(departuresCall.where).toMatchObject({
            active: false,
            companyId: 'company-1',
            exitDate: expect.any(Object)
        });
        // El bug explícito: `updatedAt` no debe estar presente.
        expect(departuresCall.where).not.toHaveProperty('updatedAt');
    });
});

describe('AnalyticsService.getHeadcountTrend', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * MED-009: la métrica mensual "exits" (bajas en el mes) debe
     * usar `exitDate` por la misma razón que departures.
     */
    it('counts monthly exits by exitDate, not by updatedAt', async () => {
        // getHeadcountTrend(months, filters) — el orden de
        // args es (months, filters), no (filters, months).
        // Para simplificar mockeamos 3 calls (1 mes) y
        // verificamos el último.
        vi.mocked(prisma.employee.count)
            .mockResolvedValueOnce(10 as never) // headcount
            .mockResolvedValueOnce(1 as never)  // newHires (createdAt)
            .mockResolvedValueOnce(1 as never); // exits

        await AnalyticsService.getHeadcountTrend(1, { companyId: 'company-1' });

        const exitsCall = vi.mocked(prisma.employee.count).mock.calls[2]?.[0] as {
            where: Record<string, unknown>;
        };
        expect(exitsCall.where).toMatchObject({
            active: false,
            companyId: 'company-1',
            exitDate: expect.any(Object)
        });
        expect(exitsCall.where).not.toHaveProperty('updatedAt');
    });
});
