import { PrismaClient, PayrollRow } from '@prisma/client';

const prisma = new PrismaClient();

export class AccountingService {
    static async generateEntries(batchId: string, rows: PayrollRow[]) {
        // Generamos un asiento por empleado (opción por defecto)
        // O un asiento global agrupado. Haremos por empleado para mejor trazabilidad 465.

        const entries = [];

        for (const row of rows) {
            // Buscar empleado para saber su subcuenta 465
            // Si no tiene, usar una genérica 465.0.0000 o error
            const employee = row.employeeId ? await prisma.employee.findUnique({ where: { id: row.employeeId } }) : null;
            const cuenta465 = employee?.subaccount465 || '465.0.0000';

            const totalSS = Number(row.ssEmpresa) + Number(row.ssTrabajador);

            const lines = [
                { account: '640.0.0000', concept: `Nómina ${row.rawEmployeeName}`, debe: row.bruto, haber: 0 },
                { account: '642.0.0000', concept: `Seg. Soc. Empresa ${row.rawEmployeeName}`, debe: row.ssEmpresa, haber: 0 },
                { account: '476.0.0000', concept: `Seg. Soc. Total ${row.rawEmployeeName}`, debe: 0, haber: totalSS },
                { account: '475.1.0000', concept: `IRPF ${row.rawEmployeeName}`, debe: 0, haber: row.irpf },
                { account: cuenta465, concept: `Neto ${row.rawEmployeeName}`, debe: 0, haber: row.neto },
            ];

            entries.push({
                batchId,
                employeeId: row.employeeId,
                concept: `Nómina Mensual - ${row.rawEmployeeName}`,
                date: new Date(),
                totalDebe: Number(row.bruto) + Number(row.ssEmpresa),
                totalHaber: totalSS + Number(row.irpf) + Number(row.neto),
                status: 'DRAFT',
                lines: {
                    create: lines.map((l, idx) => ({
                        order: idx + 1,
                        account: l.account,
                        concept: l.concept,
                        debe: l.debe,
                        haber: l.haber
                    }))
                }
            });
        }

        // Bulk insert no soporta nested relations fácilmente en createMany
        // Loop for now
        for (const entryData of entries) {
            await prisma.accountingEntry.create({
                data: entryData
            });
        }
    }
}
