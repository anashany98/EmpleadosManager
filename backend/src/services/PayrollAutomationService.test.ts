import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PayrollAutomationService } from './PayrollAutomationService';
import { prisma } from '../lib/prisma';
import { ReportService } from './ReportService';

vi.mock('../lib/prisma', () => ({
    prisma: {
        payrollImportBatch: {
            create: vi.fn(),
            update: vi.fn(),
        },
        employee: {
            findMany: vi.fn(),
        },
        payrollRow: {
            createMany: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        }
    },
}));

vi.mock('./ReportService', () => ({
    ReportService: {
        getAttendanceDailySummary: vi.fn(),
    },
}));

vi.mock('./AuditService', () => ({
    AuditService: {
        log: vi.fn(),
    },
}));

describe('PayrollAutomationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate payroll rows correctly from attendance', async () => {
        const year = 2024;
        const month = 1;
        const companyId = 'comp-1';
        const userId = 'user-1';

        // Mock batch creation
        const mockBatch = { id: 'batch-1', year, month, status: 'GENERATING' };
        (prisma.payrollImportBatch.create as any).mockResolvedValue(mockBatch);

        // Mock employees
        const mockEmployees = [
            {
                id: 'emp-1',
                name: 'John Doe',
                weeklyHours: 40,
                monthlyGrossSalary: 2000,
                companyId
            }
        ];
        (prisma.employee.findMany as any).mockResolvedValue(mockEmployees);

        // Mock attendance: 160 hours worked (full month)
        (ReportService.getAttendanceDailySummary as any).mockResolvedValue([
            { totalHours: 160 }
        ]);

        await PayrollAutomationService.generateFromAttendance(year, month, companyId, userId);

        // Verify batch creation
        expect(prisma.payrollImportBatch.create).toHaveBeenCalled();

        // Verify payroll rows creation
        // expectedHours = 40 * 4.33 = 173.2
        // proportion = 160 / 173.2 = 0.9237
        // bruto = 2000 * 0.9237 = 1847.4
        expect(prisma.payrollRow.createMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.arrayContaining([
                expect.objectContaining({
                    employeeId: 'emp-1',
                    bruto: expect.closeTo(1847.57, 1), // 2000 * (160 / (40 * 4.33))
                })
            ])
        }));

        // Verify status update
        expect(prisma.payrollImportBatch.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'batch-1' },
            data: { status: 'VALID' }
        }));
    });

    it('should warn for low attendance', async () => {
        const year = 2024;
        const month = 1;
        const companyId = 'comp-1';
        const userId = 'user-1';

        (prisma.payrollImportBatch.create as any).mockResolvedValue({ id: 'batch-2' });
        (prisma.employee.findMany as any).mockResolvedValue([{ id: 'emp-2', name: 'Jane Doe', weeklyHours: 40, monthlyGrossSalary: 2000 }]);

        // Mock attendance: 50 hours (very low)
        (ReportService.getAttendanceDailySummary as any).mockResolvedValue([{ totalHours: 50 }]);

        await PayrollAutomationService.generateFromAttendance(year, month, companyId, userId);

        expect(prisma.payrollRow.createMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.arrayContaining([
                expect.objectContaining({
                    status: 'WARNING'
                })
            ])
        }));
    });
});
