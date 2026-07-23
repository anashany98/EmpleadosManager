import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
    prisma: {
        medicalReview: {
            findMany: vi.fn()
        },
        training: {
            findMany: vi.fn()
        }
    }
}));

vi.mock('../CacheService', () => ({
    CacheService: {
        wrap: vi.fn(async (_key, fn) => fn())
    }
}));

import { prisma } from '../../lib/prisma';
import { PRLReportService } from './PRLReportService';

describe('PRLReportService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getMedicalReviewsReport', () => {
        it('returns empty summary and empty distributions when no rows', async () => {
            (prisma.medicalReview.findMany as any).mockResolvedValue([]);

            const result = await PRLReportService.getMedicalReviewsReport({});

            expect(result.rows).toEqual([]);
            expect(result.summary.totalReviews).toBe(0);
            expect(result.summary.uniqueEmployees).toBe(0);
            expect(result.summary.declinedCount).toBe(0);
            expect(result.distributionByResult).toEqual({});
        });

        it('aggregates declined vs result and marks expired when nextReviewDate is in the past', async () => {
            const past = new Date();
            past.setDate(past.getDate() - 30);
            const future = new Date();
            future.setDate(future.getDate() + 60);

            (prisma.medicalReview.findMany as any).mockResolvedValue([
                {
                    id: 'r1',
                    employeeId: 'e1',
                    date: new Date(),
                    result: 'APTO',
                    nextReviewDate: future,
                    declined: false,
                    declineReason: null,
                    employee: { id: 'e1', name: 'Juan', firstName: 'Juan', lastName: 'Pérez', dni: '111', department: 'Obra', jobTitle: 'Peón', companyId: 'c1', company: { id: 'c1', name: 'Acme' } }
                },
                {
                    id: 'r2',
                    employeeId: 'e2',
                    date: new Date(),
                    result: null,
                    nextReviewDate: past,
                    declined: true,
                    declineReason: 'Causa religiosa',
                    employee: { id: 'e2', name: 'Ana', firstName: 'Ana', lastName: 'Gómez', dni: '222', department: 'Oficina', jobTitle: 'Admin', companyId: 'c1', company: { id: 'c1', name: 'Acme' } }
                }
            ]);

            const result = await PRLReportService.getMedicalReviewsReport({});

            expect(result.summary.totalReviews).toBe(2);
            expect(result.summary.declinedCount).toBe(1);
            expect(result.summary.aptoCount).toBe(1);
            expect(result.summary.expiredCount).toBe(1);
            expect(result.summary.uniqueEmployees).toBe(2);
            expect(result.distributionByResult.RENUNCIA).toBe(1);
            expect(result.distributionByResult.APTO).toBe(1);
            expect(result.distributionByDepartment['Obra']).toBe(1);
            expect(result.distributionByDepartment['Oficina']).toBe(1);
            // Sanity: declined row has result null in normalized output
            const declinedRow = result.rows.find((r) => r.id === 'r2');
            expect(declinedRow?.declined).toBe(true);
            expect(declinedRow?.expired).toBe(true);
            expect(declinedRow?.declineReason).toBe('Causa religiosa');
        });
    });

    describe('getTrainingsReport', () => {
        it('aggregates hours and counts per type', async () => {
            (prisma.training.findMany as any).mockResolvedValue([
                {
                    id: 't1', employeeId: 'e1', type: 'PRL', name: 'PRL 20h', date: new Date(), hours: 20,
                    employee: { id: 'e1', name: 'Juan', firstName: 'Juan', lastName: 'Pérez', dni: '111', department: 'Obra', jobTitle: 'Peón', companyId: 'c1', company: { id: 'c1', name: 'Acme' } }
                },
                {
                    id: 't2', employeeId: 'e1', type: 'PRL', name: 'PRL 20h', date: new Date(), hours: 20,
                    employee: { id: 'e1', name: 'Juan', firstName: 'Juan', lastName: 'Pérez', dni: '111', department: 'Obra', jobTitle: 'Peón', companyId: 'c1', company: { id: 'c1', name: 'Acme' } }
                },
                {
                    id: 't3', employeeId: 'e2', type: 'TECNICA', name: 'Carretillero', date: new Date(), hours: 8,
                    employee: { id: 'e2', name: 'Ana', firstName: 'Ana', lastName: 'Gómez', dni: '222', department: 'Oficina', jobTitle: 'Admin', companyId: 'c1', company: { id: 'c1', name: 'Acme' } }
                }
            ]);

            const result = await PRLReportService.getTrainingsReport({});

            expect(result.summary.totalTrainings).toBe(3);
            expect(result.summary.totalHours).toBe(48);
            expect(result.summary.uniqueEmployees).toBe(2);
            expect(result.summary.averageHoursPerEmployee).toBe(24);
            expect(result.summary.uniqueCourses).toBe(2);
            expect(result.distributionByType.PRL).toBe(2);
            expect(result.distributionByType.TECNICA).toBe(1);
            expect(result.hoursByType.PRL).toBe(40);
            expect(result.hoursByType.TECNICA).toBe(8);
            expect(result.distributionByCourse['PRL 20h'].count).toBe(2);
            expect(result.distributionByCourse['PRL 20h'].hours).toBe(40);
        });

        it('handles no trainings gracefully', async () => {
            (prisma.training.findMany as any).mockResolvedValue([]);
            const result = await PRLReportService.getTrainingsReport({});
            expect(result.rows).toEqual([]);
            expect(result.summary.totalTrainings).toBe(0);
            expect(result.summary.totalHours).toBe(0);
        });
    });
});
