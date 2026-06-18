import { Job } from 'bullmq';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { AuditService } from './AuditService';
import { queueService, QUEUES } from './QueueService';
import { createLogger } from './LoggerService';

const log = createLogger('PayrollAutomationService');

interface EnqueueResult {
    jobId: string;
    batchId: string;
}

export class PayrollAutomationService {
    /**
     * Enqueue a payroll-generation job. Returns immediately with the
     * batch and job IDs so the HTTP request is not blocked by the
     * (potentially long) calculation. The actual work happens in
     * `processPayrollGenerationJob` registered as a BullMQ worker.
     */
    static async enqueuePayrollGeneration(
        year: number,
        month: number,
        companyId: string,
        createdById: string
    ): Promise<EnqueueResult> {
        // Pre-create the batch so the caller can poll its status.
        const batch = await prisma.payrollImportBatch.create({
            data: {
                year,
                month,
                sourceFilename: `AUTO_KIOSK_${month}_${year}`,
                status: 'GENERATING',
                createdById
            }
        });

        const job = await queueService.addJob(QUEUES.PAYROLL_GENERATION, 'generate', {
            batchId: batch.id,
            year,
            month,
            companyId,
            createdById
        }, {
            attempts: 2,
            // Generous timeout: jobs run as background work and may take
            // minutes for large companies.
            timeout: 10 * 60 * 1000
        });

        log.info({ batchId: batch.id, jobId: job.id, year, month, companyId }, 'Payroll generation job enqueued');

        return { jobId: job.id ?? '', batchId: batch.id };
    }

    /**
     * BullMQ worker processor. Performs the actual attendance → payroll
     * calculation. Runs off the HTTP request path so event loop is
     * not blocked.
     */
    static async processPayrollGenerationJob(job: Job): Promise<{ batchId: string; employeeCount: number }> {
        const { batchId, year, month, companyId, createdById } = job.data as {
            batchId: string;
            year: number;
            month: number;
            companyId: string;
            createdById: string;
        };

        log.info({ batchId, jobId: job.id, year, month, companyId }, 'Payroll generation job started');

        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);

        const employees = await prisma.employee.findMany({
            where: {
                companyId,
                OR: [
                    { exitDate: null },
                    { exitDate: { gte: start } }
                ],
                entryDate: { lte: end }
            }
        });

        const employeeIds = employees.map((e) => e.id);
        const allEntries = await prisma.timeEntry.findMany({
            where: {
                employeeId: { in: employeeIds },
                timestamp: { gte: start, lte: end }
            },
            orderBy: { employeeId: 'asc', timestamp: 'asc' }
        });

        const entriesByEmployee = new Map<string, typeof allEntries>();
        for (const entry of allEntries) {
            const list = entriesByEmployee.get(entry.employeeId) || [];
            list.push(entry);
            entriesByEmployee.set(entry.employeeId, list);
        }

        const payrollRows: Prisma.PayrollRowCreateManyInput[] = [];

        for (const employee of employees) {
            const entries = entriesByEmployee.get(employee.id) || [];

            const byDay: Record<string, typeof entries> = {};
            entries.forEach((e) => {
                const day = e.timestamp.toISOString().split('T')[0];
                if (!byDay[day]) byDay[day] = [];
                byDay[day].push(e);
            });

            let totalHoursWorked = 0;
            for (const day in byDay) {
                const dayEntries = byDay[day];
                let lastIn: Date | null = null;
                dayEntries.forEach((e) => {
                    if (e.type === 'IN' || e.type === 'BREAK_END' || e.type === 'LUNCH_END') {
                        lastIn = e.timestamp;
                    } else if ((e.type === 'OUT' || e.type === 'BREAK_START' || e.type === 'LUNCH_START') && lastIn) {
                        totalHoursWorked += (e.timestamp.getTime() - lastIn.getTime()) / (1000 * 60 * 60);
                        lastIn = null;
                    }
                });
            }

            const expectedHours = (employee.weeklyHours ? employee.weeklyHours * 4.33 : 160) || 160;
            const monthlySalary = Number(employee.monthlyGrossSalary) || (Number(employee.annualGrossSalary) / 12) || 0;
            const proportion = totalHoursWorked > 0 ? totalHoursWorked / expectedHours : 0;
            const salaryFactor = proportion > 1.1 ? 1.1 : proportion;
            const bruto = new Prisma.Decimal(monthlySalary * salaryFactor);

            const SS_WORKER_RATE = 0.0635;
            const IRPF_RATE = 0.15;
            const SS_COMPANY_RATE = 0.236;

            const ssTrabajador = bruto.mul(SS_WORKER_RATE);
            const irpf = bruto.mul(IRPF_RATE);
            const neto = bruto.sub(ssTrabajador).sub(irpf);
            const ssEmpresa = bruto.mul(SS_COMPANY_RATE);

            payrollRows.push({
                batchId,
                employeeId: employee.id,
                rawEmployeeName: employee.name,
                bruto,
                neto,
                ssEmpresa,
                ssTrabajador,
                irpf,
                status: proportion < 0.8 ? 'WARNING' : 'VALID',
                validationNotes: proportion < 0.8
                    ? `Horas trabajadas (${totalHoursWorked.toFixed(1)}) inferiores a lo esperado (${expectedHours.toFixed(1)})`
                    : null
            });
        }

        if (payrollRows.length > 0) {
            await prisma.payrollRow.createMany({ data: payrollRows });
        }

        await prisma.payrollImportBatch.update({
            where: { id: batchId },
            data: { status: 'VALID' }
        });

        await AuditService.log('GENERATE_AUTO_PAYROLL', 'PAYROLL_BATCH', batchId, {
            employeeCount: employees.length,
            year,
            month
        }, createdById);

        log.info({ batchId, employeeCount: employees.length }, 'Payroll generation job completed');

        return { batchId, employeeCount: employees.length };
    }

    /**
     * Legacy synchronous entrypoint retained for the test suite. In
     * production HTTP handlers must use `enqueuePayrollGeneration` and
     * poll the batch status separately. This method now delegates to
     * the worker processor using the same in-process Prisma client so
     * behaviour is identical (and tests do not need Redis).
     */
    static async generateFromAttendance(year: number, month: number, companyId: string, createdById: string) {
        // Create batch (mirrors enqueue)
        const batch = await prisma.payrollImportBatch.create({
            data: {
                year,
                month,
                sourceFilename: `AUTO_KIOSK_${month}_${year}`,
                status: 'GENERATING',
                createdById
            }
        });
        // Process synchronously (test path). In production, callers should
        // use enqueuePayrollGeneration.
        await PayrollAutomationService.processPayrollGenerationJob({
            data: { batchId: batch.id, year, month, companyId, createdById }
        } as Job);
        return batch;
    }
}
