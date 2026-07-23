import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/prisma', () => ({
    prisma: {
        employee: {
            count: vi.fn(),
            findMany: vi.fn()
        },
        employeeVacationBalance: {
            findMany: vi.fn()
        },
        vacation: {
            count: vi.fn(),
            findMany: vi.fn()
        }
    }
}));

vi.mock('../../../services/CacheService', () => ({
    CacheService: {
        wrap: vi.fn(async (_key, fn) => fn()),
        invalidateByPrefix: vi.fn()
    }
}));

import { prisma } from '../../../lib/prisma';
import { VacationReportService } from '../../../services/reports/VacationReportService';

describe('VacationReportService — separación vacaciones / resto de ausencias', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getVacationData SOLO incluye ausencias de tipo VACATION', async () => {
        // Capturamos el `where` que se pasa a prisma.employee.findMany
        // para verificar el filtro de la query anidada de vacations.
        vi.mocked(prisma.employee.count).mockResolvedValue(1);
        vi.mocked(prisma.employee.findMany).mockImplementation(async (args: any) => {
            return [{
                id: 'emp-1',
                name: 'Ana',
                department: 'IT',
                vacationDaysTotal: 30,
                vacations: []
            }] as any;
        });
        vi.mocked(prisma.employeeVacationBalance.findMany).mockResolvedValue([]);

        await VacationReportService.getVacationData(2026, {});

        const employeeCall = vi.mocked(prisma.employee.findMany).mock.calls[0]?.[0] as any;
        const vacWhere = employeeCall?.include?.vacations?.where;
        expect(vacWhere).toBeDefined();
        expect(vacWhere.type).toBe('VACATION');
        // No debe usar la constante amplia VACATION_TYPES_FOR_BALANCE
        // (que incluye maternity/paternity).
        expect(vacWhere.type).not.toEqual({ in: expect.arrayContaining(['MATERNITY']) });
    });

    it('getDetailedAbsenceData EXCLUYE las vacaciones', async () => {
        vi.mocked(prisma.vacation.count).mockResolvedValue(0);
        vi.mocked(prisma.vacation.findMany).mockImplementation(async (args: any) => {
            return [];
        });

        await VacationReportService.getDetailedAbsenceData(
            new Date('2026-01-01'),
            new Date('2026-12-31'),
            {}
        );

        const vacCall = vi.mocked(prisma.vacation.findMany).mock.calls[0]?.[0] as any;
        expect(vacCall).toBeDefined();
        expect(vacCall.where.type).toEqual({ not: 'VACATION' });
    });

    it('getDetailedAbsenceData mantiene los filtros de fecha y empresa', async () => {
        vi.mocked(prisma.vacation.count).mockResolvedValue(0);
        vi.mocked(prisma.vacation.findMany).mockResolvedValue([]);

        const start = new Date('2026-01-01');
        const end = new Date('2026-06-30');
        await VacationReportService.getDetailedAbsenceData(start, end, {
            companyId: 'company-1',
            department: 'IT'
        });

        const vacCall = vi.mocked(prisma.vacation.findMany).mock.calls[0]?.[0] as any;
        expect(vacCall.where.startDate).toEqual({ lte: end });
        expect(vacCall.where.endDate).toEqual({ gte: start });
        expect(vacCall.where.employee).toEqual({ companyId: 'company-1', department: 'IT' });
    });
});
