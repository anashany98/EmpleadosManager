import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PayrollAutomationService } from './PayrollAutomationService';
import { prisma } from '../lib/prisma';

vi.mock('../lib/prisma', () => ({
    prisma: {
        payrollImportBatch: {
            create: vi.fn(),
            update: vi.fn(),
        },
        employee: {
            findMany: vi.fn(),
        },
        timeEntry: {
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

vi.mock('./AuditService', () => ({
    AuditService: {
        log: vi.fn(),
    },
}));

// Mock the queue service so tests don't need a live Redis.
const mockAddJob = vi.fn().mockResolvedValue({ id: 'job-1' });
vi.mock('./QueueService', () => ({
    queueService: {
        addJob: (...args: unknown[]) => mockAddJob(...args)
    },
    QUEUES: {
        INGESTION: 'ingestion-queue',
        OCR: 'ocr-queue',
        PAYROLL_GENERATION: 'payroll-generation-queue'
    }
}));

describe('PayrollAutomationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAddJob.mockResolvedValue({ id: 'job-1' });
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

        // Mock time entries: 160 hours worked (full month)
        const entries: any[] = [];
        for (let day = 1; day <= 20; day++) {
            const date = new Date(year, month - 1, day, 8, 0, 0);
            const outDate = new Date(year, month - 1, day, 16, 0, 0);
            entries.push(
                { employeeId: 'emp-1', type: 'IN', timestamp: date },
                { employeeId: 'emp-1', type: 'OUT', timestamp: outDate }
            );
        }
        (prisma.timeEntry.findMany as any).mockResolvedValue(entries);

        await PayrollAutomationService.generateFromAttendance(year, month, companyId, userId);

        // Verify batch creation
        expect(prisma.payrollImportBatch.create).toHaveBeenCalled();

        const createManyInput = vi.mocked(prisma.payrollRow.createMany).mock.calls[0]?.[0];
        const createdRow = createManyInput?.data?.[0];

        expect(createdRow.employeeId).toBe('emp-1');
        expect(Number(createdRow.bruto)).toBeCloseTo(1847.57, 1);

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

        const entries: any[] = [];
        for (let day = 1; day <= 6; day++) {
            const date = new Date(year, month - 1, day, 8, 0, 0);
            const outDate = new Date(year, month - 1, day, 16, 0, 0);
            entries.push(
                { employeeId: 'emp-2', type: 'IN', timestamp: date },
                { employeeId: 'emp-2', type: 'OUT', timestamp: outDate }
            );
        }
        entries.push(
            { employeeId: 'emp-2', type: 'IN', timestamp: new Date(year, month - 1, 7, 8, 0, 0) },
            { employeeId: 'emp-2', type: 'OUT', timestamp: new Date(year, month - 1, 7, 10, 0, 0) }
        );
        (prisma.timeEntry.findMany as any).mockResolvedValue(entries);

        await PayrollAutomationService.generateFromAttendance(year, month, companyId, userId);

        expect(prisma.payrollRow.createMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.arrayContaining([
                expect.objectContaining({
                    status: 'WARNING'
                })
            ])
        }));
    });

    it('should use Decimal precision for financial calculations', async () => {
        // HIGH-009: las tasas se cargan de PayrollRulesService
        // (versionadas por fecha), no de constantes hardcoded.
        // Usamos 2023 → regla 2020-01-01 (ssWorker=0.0635).
        const year = 2023;
        const month = 1;
        const companyId = 'comp-1';
        const userId = 'user-1';

        (prisma.payrollImportBatch.create as any).mockResolvedValue({ id: 'batch-3' });
        (prisma.employee.findMany as any).mockResolvedValue([{
            id: 'emp-3',
            name: 'Decimal Test',
            weeklyHours: 40,
            monthlyGrossSalary: 1500.75,
            companyId
        }]);

        const entries: any[] = [];
        for (let day = 1; day <= 20; day++) {
            const date = new Date(year, month - 1, day, 8, 0, 0);
            const outDate = new Date(year, month - 1, day, 16, 0, 0);
            entries.push(
                { employeeId: 'emp-3', type: 'IN', timestamp: date },
                { employeeId: 'emp-3', type: 'OUT', timestamp: outDate }
            );
        }
        (prisma.timeEntry.findMany as any).mockResolvedValue(entries);

        await PayrollAutomationService.generateFromAttendance(year, month, companyId, userId);

        const createManyInput = vi.mocked(prisma.payrollRow.createMany).mock.calls[0]?.[0];
        const createdRow = createManyInput?.data?.[0];

        expect(createdRow.bruto).toBeDefined();
        const expectedProportion = 160 / (40 * 4.33);
        const expectedBruto = 1500.75 * expectedProportion;
        expect(Number(createdRow.bruto)).toBeCloseTo(expectedBruto, 1);

        // Regla 2020-01-01: ssWorker=0.0635 (lo que se usaba antes
        // como constante hardcoded).
        expect(Number(createdRow.ssTrabajador)).toBeCloseTo(expectedBruto * 0.0635, 2);
        expect(Number(createdRow.irpf)).toBeCloseTo(expectedBruto * 0.15, 2);

        const expectedNeto = expectedBruto - (expectedBruto * 0.0635) - (expectedBruto * 0.15);
        expect(Number(createdRow.neto)).toBeCloseTo(expectedNeto, 2);

        // La regla usada debe quedar registrada para reproducibilidad.
        expect(createdRow.ruleSetVersion).toBe('2020-01-01');
    });

    // ------------------------------------------------------------------
    // Additional coverage for the BullMQ path added in Sprint 1.
    // ------------------------------------------------------------------

    it('enqueuePayrollGeneration: pre-creates batch in GENERATING status and enqueues a job', async () => {
        const year = 2024;
        const month = 3;
        const companyId = 'comp-2';
        const userId = 'user-2';

        const mockBatch = { id: 'batch-99', year, month, status: 'GENERATING' };
        (prisma.payrollImportBatch.create as any).mockResolvedValue(mockBatch);

        const result = await PayrollAutomationService.enqueuePayrollGeneration(year, month, companyId, userId);

        expect(prisma.payrollImportBatch.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    year,
                    month,
                    status: 'GENERATING',
                    createdById: userId,
                    sourceFilename: 'AUTO_KIOSK_3_2024'
                })
            })
        );
        expect(mockAddJob).toHaveBeenCalledWith(
            'payroll-generation-queue',
            'generate',
            expect.objectContaining({
                batchId: 'batch-99',
                year,
                month,
                companyId,
                createdById: userId
            }),
            expect.objectContaining({
                attempts: 2,
                timeout: 10 * 60 * 1000
            })
        );
        expect(result.batchId).toBe('batch-99');
        expect(result.jobId).toBe('job-1');
    });

    it('enqueuePayrollGeneration: propagates batch-create errors (does not enqueue orphan job)', async () => {
        (prisma.payrollImportBatch.create as any).mockRejectedValue(new Error('DB write failed'));

        await expect(
            PayrollAutomationService.enqueuePayrollGeneration(2024, 1, 'comp-x', 'user-x')
        ).rejects.toThrow('DB write failed');

        expect(mockAddJob).not.toHaveBeenCalled();
    });

    it('processPayrollGenerationJob: creates a batch row per employee with all required fields', async () => {
        const year = 2024;
        const month = 4;
        const companyId = 'comp-3';
        const userId = 'user-3';

        (prisma.employee.findMany as any).mockResolvedValue([
            { id: 'emp-a', name: 'Alice', weeklyHours: 40, monthlyGrossSalary: 3000, companyId },
            { id: 'emp-b', name: 'Bob', weeklyHours: 40, monthlyGrossSalary: 2500, companyId }
        ]);

        // Alice: 200 hours (over 110% cap). Bob: 100 hours (under 80% warning).
        const entries: any[] = [];
        for (let day = 1; day <= 25; day++) {
            entries.push(
                { employeeId: 'emp-a', type: 'IN', timestamp: new Date(year, month - 1, day, 8, 0, 0) },
                { employeeId: 'emp-a', type: 'OUT', timestamp: new Date(year, month - 1, day, 16, 0, 0) }
            );
        }
        for (let day = 1; day <= 12; day++) {
            entries.push(
                { employeeId: 'emp-b', type: 'IN', timestamp: new Date(year, month - 1, day, 8, 0, 0) },
                { employeeId: 'emp-b', type: 'OUT', timestamp: new Date(year, month - 1, day, 16, 0, 0) }
            );
        }
        (prisma.timeEntry.findMany as any).mockResolvedValue(entries);

        // Mock the BullMQ Job argument shape used internally
        const mockJob = {
            data: { batchId: 'batch-pj', year, month, companyId, createdById: userId }
        } as any;

        const result = await PayrollAutomationService.processPayrollGenerationJob(mockJob);

        expect(result.batchId).toBe('batch-pj');
        expect(result.employeeCount).toBe(2);

        // Verify the rows
        const createManyCall = vi.mocked(prisma.payrollRow.createMany).mock.calls[0]?.[0];
        const rows = createManyCall?.data as any[];
        expect(rows).toHaveLength(2);

        // Alice: salary capped at 110% of monthlyGrossSalary
        const aliceRow = rows.find((r) => r.employeeId === 'emp-a');
        expect(aliceRow.status).toBe('VALID'); // over 80%
        // 200h / 173.2h = 1.155, capped at 1.1 -> 3000 * 1.1 = 3300
        expect(Number(aliceRow.bruto)).toBeCloseTo(3300, 0);

        // Bob: under 80% -> WARNING
        const bobRow = rows.find((r) => r.employeeId === 'emp-b');
        expect(bobRow.status).toBe('WARNING');
        expect(bobRow.validationNotes).toMatch(/inferiores/);

        // Verify the batch is marked VALID at the end
        expect(prisma.payrollImportBatch.update).toHaveBeenCalledWith({
            where: { id: 'batch-pj' },
            data: { status: 'VALID' }
        });
    });

    it('processPayrollGenerationJob: returns zero rows when no employees in the company', async () => {
        (prisma.employee.findMany as any).mockResolvedValue([]);
        (prisma.timeEntry.findMany as any).mockResolvedValue([]);

        const result = await PayrollAutomationService.processPayrollGenerationJob({
            data: { batchId: 'batch-empty', year: 2024, month: 5, companyId: 'comp-empty', createdById: 'u' }
        } as any);

        expect(result.employeeCount).toBe(0);
        expect(prisma.payrollRow.createMany).not.toHaveBeenCalled();
        expect(prisma.payrollImportBatch.update).toHaveBeenCalledWith({
            where: { id: 'batch-empty' },
            data: { status: 'VALID' }
        });
    });

    it('processPayrollGenerationJob: handles zero hours worked (proportion 0, status WARNING)', async () => {
        (prisma.employee.findMany as any).mockResolvedValue([
            { id: 'emp-no', name: 'No Hours', weeklyHours: 40, monthlyGrossSalary: 2000, companyId: 'c' }
        ]);
        (prisma.timeEntry.findMany as any).mockResolvedValue([]);

        await PayrollAutomationService.processPayrollGenerationJob({
            data: { batchId: 'batch-no', year: 2024, month: 6, companyId: 'c', createdById: 'u' }
        } as any);

        const rows = (vi.mocked(prisma.payrollRow.createMany).mock.calls[0]?.[0]?.data as any[]) || [];
        const row = rows[0];
        expect(row.employeeId).toBe('emp-no');
        // proportion = 0, so bruto = 0
        expect(Number(row.bruto)).toBe(0);
        // bajo 80% horas -> WARNING
        expect(row.status).toBe('WARNING');
    });
});
