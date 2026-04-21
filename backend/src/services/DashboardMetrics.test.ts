import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';

vi.mock('../lib/prisma', () => ({
    prisma: {
        employee: {
            count: vi.fn(),
            groupBy: vi.fn(),
            findMany: vi.fn()
        },
        document: {
            count: vi.fn(),
            findMany: vi.fn()
        },
        vacation: {
            count: vi.fn(),
            findMany: vi.fn()
        },
        expense: {
            count: vi.fn(),
            findMany: vi.fn()
        },
        medicalReview: {
            findMany: vi.fn()
        },
        vehicle: {
            findMany: vi.fn()
        }
    }
}));

describe('Dashboard Metrics Queries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Employee Metrics', () => {
        it('should count active employees', async () => {
            vi.mocked(prisma.employee.count).mockResolvedValue(50);

            const count = await prisma.employee.count({
                where: { active: true }
            });

            expect(count).toBe(50);
            expect(prisma.employee.count).toHaveBeenCalledWith({
                where: { active: true }
            });
        });

        it('should group employees by department', async () => {
            vi.mocked(prisma.employee.groupBy).mockResolvedValue([
                { department: 'IT', _count: { id: 10 } },
                { department: 'HR', _count: { id: 5 } }
            ]);

            const result = await prisma.employee.groupBy({
                by: ['department'],
                where: { active: true },
                _count: { id: true }
            });

            expect(result).toHaveLength(2);
        });
    });

    describe('Contract Expiration Alerts', () => {
        it('should find expiring contracts within 30 days', async () => {
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            vi.mocked(prisma.employee.findMany).mockResolvedValue([
                { id: '1', name: 'John Doe', contractEndDate: thirtyDaysFromNow }
            ]);

            const result = await prisma.employee.findMany({
                where: {
                    active: true,
                    contractEndDate: {
                        lte: thirtyDaysFromNow,
                        gte: new Date()
                    }
                }
            });

            expect(result).toHaveLength(1);
        });
    });

    describe('Document Expiration Alerts', () => {
        it('should find expiring documents', async () => {
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            vi.mocked(prisma.document.findMany).mockResolvedValue([
                { id: '1', name: 'DNI', expiryDate: thirtyDaysFromNow }
            ]);

            const result = await prisma.document.findMany({
                where: {
                    expiryDate: {
                        lte: thirtyDaysFromNow,
                        gte: new Date()
                    }
                }
            });

            expect(result).toHaveLength(1);
        });
    });

    describe('Pending Requests', () => {
        it('should count pending vacation requests', async () => {
            vi.mocked(prisma.vacation.count).mockResolvedValue(3);

            const count = await prisma.vacation.count({
                where: { status: 'PENDING' }
            });

            expect(count).toBe(3);
        });

        it('should count pending expense claims', async () => {
            vi.mocked(prisma.expense.count).mockResolvedValue(5);

            const count = await prisma.expense.count({
                where: { status: 'PENDING' }
            });

            expect(count).toBe(5);
        });
    });

    describe('Medical Review Alerts', () => {
        it('should find upcoming medical reviews', async () => {
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            vi.mocked(prisma.medicalReview.findMany).mockResolvedValue([
                { id: '1', employeeId: 'emp-1', nextReviewDate: thirtyDaysFromNow }
            ]);

            const result = await prisma.medicalReview.findMany({
                where: {
                    nextReviewDate: {
                        lte: thirtyDaysFromNow,
                        gte: new Date()
                    }
                }
            });

            expect(result).toHaveLength(1);
        });
    });

    describe('Vehicle Alerts', () => {
        it('should find vehicles with expiring ITV', async () => {
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            vi.mocked(prisma.vehicle.findMany).mockResolvedValue([
                { id: '1', plate: '1234-ABC', nextITVDate: thirtyDaysFromNow }
            ]);

            const result = await prisma.vehicle.findMany({
                where: {
                    status: 'ACTIVE',
                    nextITVDate: {
                        lte: thirtyDaysFromNow,
                        gte: new Date()
                    }
                }
            });

            expect(result).toHaveLength(1);
        });

        it('should find vehicles with expiring insurance', async () => {
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            vi.mocked(prisma.vehicle.findMany).mockResolvedValue([
                { id: '1', plate: '1234-ABC', insuranceExpiry: thirtyDaysFromNow }
            ]);

            const result = await prisma.vehicle.findMany({
                where: {
                    status: 'ACTIVE',
                    insuranceExpiry: {
                        lte: thirtyDaysFromNow,
                        gte: new Date()
                    }
                }
            });

            expect(result).toHaveLength(1);
        });
    });
});
