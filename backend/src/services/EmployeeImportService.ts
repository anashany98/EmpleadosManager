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

        const parseDate = (val: any): Date | null => {
            if (!val) return null;
            // Handle Excel serial numbers
            if (typeof val === 'number') {
                const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                return isNaN(date.getTime()) ? null : date;
            }
            // Handle strings
            const date = new Date(val);
            return isNaN(date.getTime()) ? null : date;
        };

        const parseBool = (val: any): boolean => {
            if (!val) return false;
            const str = String(val).toUpperCase();
            return str === 'SI' || str === 'SÍ' || str === 'YES' || str === 'TRUE' || str === '1';
        };

        for (const row of data as any[]) {
            const rawName = row['Nombre'] || row['NOMBRE'] || row['Empleado'] || row['Name'];
            const lastName = row['Apellido'] || row['APELLIDO'] || row['Last Name'];
            const dni = String(row['DNI'] || row['NIF'] || row['Identificación'] || '').trim();
            const subaccount = String(row['Subcuenta 465'] || row['Subcuenta'] || row['Cuenta'] || '').trim();

            if (dni && (rawName || lastName)) {
                // Skip example rows
                if (dni.includes('EJEMPLO') || (rawName && rawName.includes('EJEMPLO'))) {
                    continue;
                }

                try {
                    const name = rawName || `${row['Nombre']} ${lastName}`.trim();

                    // Normalize gender
                    let gender = null;
                    const rawGender = String(row['Género'] || row['GENERO'] || row['Gender'] || '').toUpperCase();
                    if (rawGender.includes('H') || rawGender.includes('MAS') || rawGender.includes('MALE')) gender = 'MALE';
                    else if (rawGender.includes('M') || rawGender.includes('FEM') || rawGender.includes('WOM')) gender = 'FEMALE';
                    else if (rawGender.includes('OTR') || rawGender.includes('OTHER')) gender = 'OTHER';

                    const employeeData: any = {
                        dni,
                        name: String(name),
                        firstName: String(rawName || ''),
                        lastName: String(lastName || ''),
                        subaccount465: subaccount,
                        email: row['Email'] ? String(row['Email']) : null,
                        phone: row['Teléfono'] ? String(row['Teléfono']) : null,
                        address: row['Dirección'] ? String(row['Dirección']) : null,
                        city: row['Ciudad'] ? String(row['Ciudad']) : null,
                        postalCode: row['Código Postal'] ? String(row['Código Postal']) : null,
                        province: row['Provincia'] ? String(row['Provincia']) : null,
                        socialSecurityNumber: row['Seguridad Social'] ? String(row['Seguridad Social']) : null,
                        iban: row['IBAN'] ? String(row['IBAN']) : null,
                        gender,

                        // Dates
                        dniExpiration: parseDate(row['DNI Vencimiento']),
                        birthDate: parseDate(row['Fecha Nacimiento']),
                        entryDate: parseDate(row['Fecha Entrada']),
                        callDate: parseDate(row['Llamada Fijo-Disc']),
                        contractInterruptionDate: parseDate(row['Interrupción Fijo-Disc']),
                        lowDate: parseDate(row['Fecha Baja']),

                        // Employment info
                        department: row['Departamento'] ? String(row['Departamento']) : null,
                        category: row['Categoría'] ? String(row['Categoría']) : null,
                        jobTitle: row['Puesto'] ? String(row['Puesto']) : null,
                        contractType: row['Tipo Contrato'] ? String(row['Tipo Contrato']) : null,
                        agreementType: row['Convenio'] ? String(row['Convenio']) : null,
                        registeredIn: row['Lugar Registro'] ? String(row['Lugar Registro']) : null,
                        lowReason: row['Motivo Baja'] ? String(row['Motivo Baja']) : null,

                        // Driving License
                        drivingLicense: parseBool(row['Carnet Conducir (SI/NO)']),
                        drivingLicenseType: row['Tipo Carnet'] ? String(row['Tipo Carnet']) : null,
                        drivingLicenseExpiration: parseDate(row['Vencimiento Carnet']),

                        // Emergency Contact
                        emergencyContactName: row['Contacto Emergencia Nombre'] ? String(row['Contacto Emergencia Nombre']) : null,
                        emergencyContactPhone: row['Contacto Emergencia Teléfono'] ? String(row['Contacto Emergencia Teléfono']) : null,

                        // Relations
                        companyId: row['Empresa (ID)'] ? String(row['Empresa (ID)']) : undefined,
                        managerId: row['ID Responsable'] ? String(row['ID Responsable']) : null,

                        active: true
                    };

                    const existing = await prisma.employee.findUnique({ where: { dni } });

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
