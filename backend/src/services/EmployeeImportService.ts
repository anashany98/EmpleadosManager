import { prisma } from '../lib/prisma';
import { AuditService } from './AuditService';
import XLSX from 'xlsx';

export const EmployeeImportService = {
    processFile: async (buffer: Buffer) => {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        let importedCount = 0;
        let errors: string[] = [];

        for (const row of data as any[]) {
            const rawName = row['Nombre'] || row['NOMBRE'] || row['Empleado'] || row['Name'];
            const lastName = row['Apellido'] || row['APELLIDO'] || row['Last Name'];
            const dni = row['DNI'] || row['NIF'] || row['Identificación'];
            const subaccount = row['Subcuenta 465'] || row['Subcuenta'] || row['Cuenta'];

            if (dni && (rawName || lastName)) {
                try {
                    const name = rawName || `${row['Nombre']} ${lastName}`.trim();

                    const employeeData: any = {
                        name: String(name),
                        firstName: String(rawName || ''),
                        lastName: String(lastName || ''),
                        dni: String(dni),
                        subaccount465: String(subaccount || ''),
                        email: row['Email'] ? String(row['Email']) : null,
                        // ... Mapping common fields ...
                        companyId: row['Empresa (ID)'] ? String(row['Empresa (ID)']) : undefined,
                        active: true
                    };

                    const existing = await prisma.employee.findUnique({ where: { dni: String(dni) } });

                    if (existing) {
                        await prisma.employee.update({
                            where: { id: existing.id },
                            data: employeeData
                        });
                        await AuditService.log('UPDATE', 'EMPLOYEE', existing.id, { info: 'Import Bulk Update', name });
                    } else {
                        const created = await prisma.employee.create({
                            data: employeeData
                        });
                        await AuditService.log('CREATE', 'EMPLOYEE', created.id, { info: 'Import Bulk Create', name });
                    }
                    importedCount++;
                } catch (e) {
                    errors.push(`Error importando ${dni}: ${e}`);
                }
            }
        }

        return { importedCount, errors };
    }
};
