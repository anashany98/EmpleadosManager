import { Job } from 'bullmq';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { AuditService } from './AuditService';
import { queueService, QUEUES } from './QueueService';
import { createLogger } from './LoggerService';
import {
    PayrollRulesService,
    getRulesForDate,
    ruleSetToDecimals,
    roundToCents,
    type PayrollRuleSet
} from './PayrollRulesService';

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
     *
     * Reglas de cálculo (HIGH-009 cerrado):
     *
     *   - Todos los importes monetarios se manipulan como
     *     `Prisma.Decimal` desde el string del salario hasta el
     *     redondeo final. NO hay `Number()` ni `parseFloat()` en
     *     medio.
     *   - Las horas trabajadas se mantienen como `Prisma.Decimal`
     *     (no como `number`) para que la división horas / esperadas
     *     tampoco pase por binary64.
     *   - Las tasas (SS, IRPF) se cargan de la regla versionada
     *     correspondiente a la fecha del periodo de nómina. La
     *     versión usada se persiste en `PayrollRow.ruleSetVersion`
     *     para reproducibilidad histórica.
     *   - El IRPF por empleado del control de gestoría (el que RRHH
     *     configura y se recuerda mes a mes en `PayrollControlRecord`)
     *     prevalece sobre el tipo global cuando existe y es > 0; si no
     *     hay período de control o el empleado no tiene IRPF asignado,
     *     se usa la tasa global de la regla versionada.
     *   - El redondeo se aplica al resultado final de cada
     *     magnitud, con banker's rounding al céntimo.
     */
    static async processPayrollGenerationJob(job: Job): Promise<{ batchId: string; employeeCount: number; ruleSetVersion: string }> {
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

        // Regla activa para el periodo de nómina.
        const rule: PayrollRuleSet = getRulesForDate(start);
        const rates = ruleSetToDecimals(rule);

        // IRPF por empleado desde el control de gestoría del mismo periodo.
        // Si no existe período de control (o el empleado no tiene registro),
        // se cae a la tasa global de la regla versionada.
        const controlPeriod = await prisma.payrollControlPeriod.findUnique({
            where: { companyId_year_month: { companyId, year, month } },
            select: { records: { select: { employeeId: true, irpf: true } } }
        });
        const irpfByEmployee = new Map<string, Prisma.Decimal>(
            (controlPeriod?.records || []).map((record) => [
                record.employeeId,
                record.irpf ? new Prisma.Decimal(record.irpf) : new Prisma.Decimal(0)
            ])
        );

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

            // totalHoursWorked como Prisma.Decimal (no number) para
            // que la división por expectedHours tampoco pase por
            // binary64.
            let totalHoursWorked = new Prisma.Decimal(0);
            for (const day in byDay) {
                const dayEntries = byDay[day];
                let lastIn: Date | null = null;
                dayEntries.forEach((e) => {
                    if (e.type === 'IN' || e.type === 'BREAK_END' || e.type === 'LUNCH_END') {
                        lastIn = e.timestamp;
                    } else if ((e.type === 'OUT' || e.type === 'BREAK_START' || e.type === 'LUNCH_START') && lastIn) {
                        const hours = new Prisma.Decimal(e.timestamp.getTime() - lastIn.getTime())
                            .dividedBy(new Prisma.Decimal(1000 * 60 * 60));
                        totalHoursWorked = totalHoursWorked.plus(hours);
                        lastIn = null;
                    }
                });
            }

            // expectedHours como Decimal.
            const weeklyHours = employee.weeklyHours
                ? new Prisma.Decimal(employee.weeklyHours).times(new Prisma.Decimal('4.33'))
                : new Prisma.Decimal(160);
            const expectedHours = weeklyHours.greaterThan(0) ? weeklyHours : new Prisma.Decimal(160);

            // Salario mensual como Decimal desde el string del
            // campo de BD. Prisma entrega los Decimal como objetos
            // Decimal, no number — pero la propiedad `toFixed()` nos
            // da una representación exacta para reconstruir uno
            // nuevo y evitar el round-trip por Number.
            const monthlySalarySource = employee.monthlyGrossSalary ?? employee.annualGrossSalary ?? new Prisma.Decimal(0);
            const monthlySalary = monthlySalarySource instanceof Prisma.Decimal
                ? monthlySalarySource
                : new Prisma.Decimal(monthlySalarySource);
            const monthlySalaryDecimal = (employee.annualGrossSalary && !employee.monthlyGrossSalary)
                ? monthlySalary.dividedBy(new Prisma.Decimal(12))
                : monthlySalary;

            // proportion = totalHoursWorked / expectedHours (Decimal).
            // proportion se limita a rates.maxProportion (1.1) si lo
            // supera.
            const proportion = totalHoursWorked.greaterThan(0)
                ? totalHoursWorked.dividedBy(expectedHours)
                : new Prisma.Decimal(0);
            const salaryFactor = proportion.greaterThan(rates.maxProportion)
                ? rates.maxProportion
                : proportion;

            // bruto en Decimal (sin redondeo intermedio).
            const bruto = monthlySalaryDecimal.times(salaryFactor);

            // Tasas como Decimal — todo en Decimal hasta el final.
            const ssTrabajador = bruto.times(rates.ssWorkerRate);
            // IRPF del control de gestoría si el empleado lo tiene asignado; si no, el global.
            const employeeIrpfRate = irpfByEmployee.get(employee.id);
            const effectiveIrpfRate = employeeIrpfRate && employeeIrpfRate.greaterThan(0) ? employeeIrpfRate : rates.irpfRate;
            const irpf = bruto.times(effectiveIrpfRate);
            const ssEmpresa = bruto.times(rates.ssCompanyRate);

            // Redondeo al céntimo (banker's rounding) en cada línea
            // ANTES de combinarlas. Esto es la práctica contable
            // estándar: cada magnitud se redondea al céntimo y la
            // suma/resta se hace sobre los valores ya redondeados.
            // Si redondeáramos solo al final, el neto no coincidiría
            // con la suma de las líneas (drift de 1-2 céntimos por
            // nómina). Ver HIGH-009.
            const brutoRounded = roundToCents(bruto);
            const ssTrabajadorRounded = roundToCents(ssTrabajador);
            const irpfRounded = roundToCents(irpf);
            const ssEmpresaRounded = roundToCents(ssEmpresa);
            const netoRounded = brutoRounded.minus(ssTrabajadorRounded).minus(irpfRounded);

            // Proporción como string para la nota de validación (es
            // un ratio, no moneda: 4 decimales bastan).
            const proportionStr = proportion.toDecimalPlaces(4).toString();

            payrollRows.push({
                batchId,
                employeeId: employee.id,
                rawEmployeeName: employee.name,
                bruto: brutoRounded,
                neto: netoRounded,
                ssEmpresa: ssEmpresaRounded,
                ssTrabajador: ssTrabajadorRounded,
                irpf: irpfRounded,
                ruleSetVersion: rule.version,
                status: proportion.lessThan(rates.minProportionForNoWarning) ? 'WARNING' : 'VALID',
                validationNotes: proportion.lessThan(rates.minProportionForNoWarning)
                    ? `Horas trabajadas (${totalHoursWorked.toFixed(2)}) inferiores a lo esperado (${expectedHours.toFixed(2)}) (proporción ${proportionStr})`
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
            month,
            ruleSetVersion: rule.version
        }, createdById);

        log.info({ batchId, employeeCount: employees.length, ruleSetVersion: rule.version }, 'Payroll generation job completed');

        return { batchId, employeeCount: employees.length, ruleSetVersion: rule.version };
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

// Re-export para tests y callers.
export { PayrollRulesService };
