import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../services/AuditService';

const prisma = new PrismaClient();

export const EmployeeController = {
    // Obtener todos los empleados
    getAll: async (req: Request, res: Response) => {
        try {
            const employees = await prisma.employee.findMany({
                orderBy: { name: 'asc' }
            });
            res.json(employees);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener empleados' });
        }
    },

    // Importar Empleados desde Excel (Simple: Nombre, DNI, Subcuenta)
    importEmployees: async (req: Request, res: Response) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo' });
        }

        try {
            const XLSX = require('xlsx');
            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet); // Auto-detect headers

            let importedCount = 0;
            let errors = [];

            for (const row of data as any[]) {
                // Heuristica expandida para detectar columnas
                const rawName = row['Nombre'] || row['NOMBRE'] || row['Empleado'] || row['Name'];
                const lastName = row['Apellido'] || row['APELLIDO'] || row['Last Name'];
                const dni = row['DNI'] || row['NIF'] || row['Identificación'];
                const subaccount = row['Subcuenta 465'] || row['Subcuenta'] || row['Cuenta'] || row['465'];

                const email = row['Email'] || row['Correo'] || row['E-mail'];
                const phone = row['Teléfono'] || row['Telefono'] || row['Phone'];
                const address = row['Dirección'] || row['Direccion'] || row['Address'];
                const city = row['Ciudad'] || row['City'];
                const postalCode = row['Código Postal'] || row['Codigo Postal'] || row['Zip'];
                const ssn = row['Seguridad Social'] || row['NSS'] || row['N.S.S.'];
                const iban = row['IBAN'] || row['Cuenta Bancaria'];

                const department = row['Departamento'] || row['Department'];
                const category = row['Categoría'] || row['Categoria'] || row['Category'];
                const contractType = row['Tipo Contrato'] || row['Contrato'];
                const agreementType = row['Convenio'];
                const jobTitle = row['Puesto'] || row['Job Title'];

                const seniorityDateStr = row['Fecha Antigüedad'] || row['Antigüedad'];
                const entryDateStr = row['Fecha Entrada'] || row['Entrada'];

                if (dni && (rawName || lastName)) {
                    try {
                        const name = rawName || `${row['Nombre']} ${lastName}`.trim();
                        const subaccountStr = String(subaccount || '');

                        const employeeData = {
                            name: String(name),
                            firstName: String(rawName || ''),
                            lastName: String(lastName || ''),
                            dni: String(dni),
                            subaccount465: subaccountStr,
                            email: email ? String(email) : null,
                            phone: phone ? String(phone) : null,
                            address: address ? String(address) : null,
                            city: city ? String(city) : null,
                            postalCode: postalCode ? String(postalCode) : null,
                            socialSecurityNumber: ssn ? String(ssn) : null,
                            iban: iban ? String(iban) : null,
                            department: department ? String(department) : null,
                            category: category ? String(category) : null,
                            contractType: contractType ? String(contractType) : null,
                            agreementType: agreementType ? String(agreementType) : null,
                            jobTitle: jobTitle ? String(jobTitle) : null,
                            entryDate: entryDateStr ? new Date(entryDateStr) : (seniorityDateStr ? new Date(seniorityDateStr) : null),
                            active: true
                        };

                        // Intentamos encontrar por DNI
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

            res.json({ message: `Importación completada. ${importedCount} nuevos empleados.`, errors });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error procesando el archivo de empleados' });
        }
    },

    // Obtener un empleado con su histórico
    getById: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const employee = await prisma.employee.findUnique({
                where: { id },
                include: {
                    payrollRows: {
                        where: { status: 'OK' }, // Solo nóminas válidas
                        include: {
                            batch: {
                                select: { year: true, month: true, status: true }
                            }
                        },
                        orderBy: { batch: { createdAt: 'desc' } },
                        take: 12 // Último año
                    }
                }
            });

            if (!employee) {
                return res.status(404).json({ error: 'Empleado no encontrado' });
            }

            res.json(employee);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener el empleado' });
        }
    },

    // Crear un nuevo empleado
    create: async (req: Request, res: Response) => {
        const {
            dni, name, subaccount465, department,
            firstName, lastName, email, phone, address, city, postalCode,
            socialSecurityNumber, iban, companyId, category, contractType,
            agreementType, jobTitle, entryDate, callDate, contractInterruptionDate,
            dniExpiration, birthDate, province, registeredIn,
            drivingLicense, drivingLicenseType, drivingLicenseExpiration,
            emergencyContactName, emergencyContactPhone
        } = req.body;

        try {
            // Validaciones básicas
            const existingDni = await prisma.employee.findUnique({ where: { dni } });
            if (existingDni) {
                return res.status(400).json({ error: 'Ya existe un empleado con ese DNI' });
            }

            const existingSub = await prisma.employee.findUnique({ where: { subaccount465 } });
            if (existingSub) {
                return res.status(400).json({ error: 'Esa subcuenta 465 ya está asignada' });
            }

            const employee = await prisma.employee.create({
                data: {
                    dni,
                    name: name || `${firstName} ${lastName}`,
                    firstName, lastName, email, phone, address, city, postalCode,
                    subaccount465,
                    socialSecurityNumber, iban,
                    companyId: companyId || undefined,
                    department, category,
                    contractType, agreementType, jobTitle,
                    entryDate: entryDate ? new Date(entryDate) : undefined,
                    callDate: callDate ? new Date(callDate) : undefined,
                    contractInterruptionDate: contractInterruptionDate ? new Date(contractInterruptionDate) : undefined,
                    dniExpiration: dniExpiration ? new Date(dniExpiration) : undefined,
                    birthDate: birthDate ? new Date(birthDate) : undefined,
                    province: province || null,
                    registeredIn: registeredIn || null,
                    drivingLicense: drivingLicense === true || drivingLicense === 'true',
                    drivingLicenseType: drivingLicenseType || null,
                    drivingLicenseExpiration: drivingLicenseExpiration ? new Date(drivingLicenseExpiration) : undefined,
                    emergencyContactName: emergencyContactName || null,
                    emergencyContactPhone: emergencyContactPhone || null,
                    active: true
                }
            });

            // Audit
            await AuditService.log('CREATE', 'EMPLOYEE', employee.id, { name: employee.name });

            res.status(201).json(employee);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al crear el empleado' });
        }
    },

    // Actualizar empleado
    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        const {
            name, subaccount465, department, active,
            firstName, lastName, email, phone, address, city, postalCode,
            socialSecurityNumber, iban, companyId, category, contractType,
            agreementType, jobTitle, entryDate, exitDate, callDate, contractInterruptionDate,
            lowDate, lowReason,
            dniExpiration, birthDate, province, registeredIn,
            drivingLicense, drivingLicenseType, drivingLicenseExpiration,
            emergencyContactName, emergencyContactPhone
        } = req.body;

        try {
            const employee = await prisma.employee.update({
                where: { id },
                data: {
                    name, firstName, lastName, email, phone, address, city, postalCode,
                    subaccount465, department, active,
                    socialSecurityNumber, iban,
                    companyId: companyId || undefined,
                    category, contractType,
                    agreementType, jobTitle,
                    entryDate: entryDate ? new Date(entryDate) : undefined,
                    exitDate: exitDate ? new Date(exitDate) : undefined,
                    callDate: callDate ? new Date(callDate) : undefined,
                    contractInterruptionDate: contractInterruptionDate ? new Date(contractInterruptionDate) : undefined,
                    lowDate: lowDate ? new Date(lowDate) : undefined,
                    dniExpiration: dniExpiration ? new Date(dniExpiration) : undefined,
                    birthDate: birthDate ? new Date(birthDate) : undefined,
                    province: province || null,
                    registeredIn: registeredIn || null,
                    drivingLicense: drivingLicense === true || drivingLicense === 'true',
                    drivingLicenseType: drivingLicenseType || null,
                    drivingLicenseExpiration: drivingLicenseExpiration ? new Date(drivingLicenseExpiration) : undefined,
                    emergencyContactName: emergencyContactName || null,
                    emergencyContactPhone: emergencyContactPhone || null,
                    lowReason
                }
            });

            // Audit
            await AuditService.log('UPDATE', 'EMPLOYEE', id, req.body);

            res.json(employee);
        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar el empleado' });
        }
    },

    // Descargar Plantilla Excel
    downloadTemplate: async (req: Request, res: Response) => {
        try {
            const XLSX = require('xlsx');
            const headers = [
                'Nombre', 'Apellido', 'DNI', 'Subcuenta 465', 'Email', 'Teléfono',
                'Dirección', 'Ciudad', 'Código Postal', 'Seguridad Social', 'IBAN',
                'Departamento', 'Categoría', 'Tipo Contrato', 'Convenio', 'Puesto',
                'Fecha Antigüedad', 'Fecha Entrada'
            ];
            const data = [
                {
                    'Nombre': 'Juan', 'Apellido': 'Pérez', 'DNI': '12345678A', 'Subcuenta 465': '465.1.0001',
                    'Email': 'juan@example.com', 'Teléfono': '600123456', 'Dirección': 'Calle Falsa 123',
                    'Ciudad': 'Madrid', 'Código Postal': '28001', 'Seguridad Social': '281234567890',
                    'IBAN': 'ES1234567890123456789012', 'Departamento': 'Ventas', 'Categoría': 'Oficial de 1ª',
                    'Tipo Contrato': 'Indefinido', 'Convenio': 'Comercio', 'Puesto': 'Vendedor',
                    'Fecha Antigüedad': '2020-01-01', 'Fecha Entrada': '2020-01-01'
                }
            ];

            const ws = XLSX.utils.json_to_sheet(data, { header: headers });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Empleados');

            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=plantilla_empleados.xlsx');
            res.send(buffer);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al generar la plantilla' });
        }
    },

    // Eliminar (Soft delete o físico si no tiene dependencias)
    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            // Intentamos borrar. Si falla por FK, lo desactivamos
            try {
                await prisma.employee.delete({ where: { id } });
                res.json({ message: 'Empleado eliminado correctamente' });
            } catch (e) {
                await prisma.employee.update({
                    where: { id },
                    data: { active: false }
                });
                res.json({ message: 'Empleado desactivado (tiene nóminas asociadas)' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar empleado' });
        }
    }
};
