import { prisma } from '../lib/prisma';
import { ReportService } from './ReportService';
import { AuditService } from './AuditService';

export class PayrollAutomationService {
    /**
     * Generates a payroll batch automatically based on attendance data.
     */
    static async generateFromAttendance(year: number, month: number, companyId: string, createdById: string) {
        // 1. Define date range
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);

        // 2. Clear existing batch for this period or create new
        const batch = await prisma.payrollImportBatch.create({
            data: {
                year,
                month,
                sourceFilename: `AUTO_KIOSK_${month}_${year}`,
                status: 'GENERATING',
                createdById
            }
        });

        // 3. Get all active employees for the company
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

        const payrollRows = [];

        for (const employee of employees) {
            // Get attendance summary for this employee
            const summaries = await ReportService.getAttendanceDailySummary(start, end, { employeeId: employee.id });
            const totalHoursWorked = summaries.reduce((sum, s) => sum + s.totalHours, 0);

            // Calculation Logic
            // Expected hours: weeklyHours * 4.33 (avg weeks in month) or default 160
            const expectedHours = (employee.weeklyHours ? employee.weeklyHours * 4.33 : 160) || 160;
            const monthlySalary = Number(employee.monthlyGrossSalary) || (Number(employee.annualGrossSalary) / 12) || 0;

            // Proportional calculation
            const proportion = totalHoursWorked > 0 ? (totalHoursWorked / expectedHours) : 0;
            const bruto = monthlySalary * (proportion > 1.1 ? 1.1 : proportion); // Cap at 110% to prevent extreme outliers

            // Simple tax estimation (Spain standard approximate)
            const ssTrabajador = bruto * 0.0635;
            const irpf = bruto * 0.15;
            const neto = bruto - ssTrabajador - irpf;
            const ssEmpresa = bruto * 0.236;

            payrollRows.push({
                batchId: batch.id,
                employeeId: employee.id,
                rawEmployeeName: employee.name,
                bruto: bruto,
                neto: neto,
                ssEmpresa: ssEmpresa,
                ssTrabajador: ssTrabajador,
                irpf: irpf,
                status: proportion < 0.8 ? 'WARNING' : 'VALID' // Warn if worked less than 80%
            });
        }

        // 4. Save rows
        await prisma.payrollRow.createMany({
            data: payrollRows as any
        });

        // 5. Update batch status
        await prisma.payrollImportBatch.update({
            where: { id: batch.id },
            data: { status: 'VALID' }
        });

        await AuditService.log('GENERATE_AUTO_PAYROLL', 'PAYROLL_BATCH', batch.id, {
            employeeCount: employees.length,
            year,
            month
        }, createdById);

        return batch;
    }
}
