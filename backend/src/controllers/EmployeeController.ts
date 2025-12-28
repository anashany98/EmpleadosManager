import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuditService } from '../services/AuditService';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import path from 'path';
import fs from 'fs';

export const EmployeeController = {
    // Obtener todos los empleados
    getAll: async (req: Request, res: Response) => {
        try {
            const employees = await prisma.employee.findMany({
                orderBy: { name: 'asc' }
            });
            return ApiResponse.success(res, employees);
        } catch (error) {
            throw new AppError('Error al obtener empleados', 500);
        }
    },

    // Obtener jerarquía (para organigrama)
    getHierarchy: async (req: Request, res: Response) => {
        try {
            const employees = await prisma.employee.findMany({
                where: { active: true },
                select: {
                    id: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                    jobTitle: true,
                    department: true,
                    managerId: true,
                }
            });
            return ApiResponse.success(res, employees);
        } catch (error) {
            throw new AppError('Error al obtener jerarquía', 500);
        }
    },

    // Importar Empleados desde Excel (Simple: Nombre, DNI, Subcuenta)
    importEmployees: async (req: Request, res: Response) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo' });
        }

        try {
            // Delegar lógica compleja al servicio
            const { EmployeeImportService } = await import('../services/EmployeeImportService');
            const result = await EmployeeImportService.processFile(req.file.buffer);

            res.json({ message: `Importación completada. ${result.importedCount} empleados procesados.`, errors: result.errors });
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
            emergencyContactName, emergencyContactPhone,
            workingDayType, weeklyHours, gender, managerId
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
                    workingDayType: workingDayType || 'COMPLETE',
                    weeklyHours: weeklyHours ? parseFloat(weeklyHours) : null,
                    gender: gender || null,
                    managerId: managerId || null,
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

    // Actualizar empleado (Soporta PATCH parcial)
    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        const body = req.body;

        try {
            const updateData: any = {};

            // Mapeo de campos directos (String / null)
            const stringFields = [
                'name', 'firstName', 'lastName', 'email', 'phone', 'address', 'city', 'postalCode',
                'subaccount465', 'department', 'socialSecurityNumber', 'iban', 'companyId',
                'category', 'contractType', 'agreementType', 'jobTitle', 'province', 'registeredIn',
                'drivingLicenseType', 'emergencyContactName', 'emergencyContactPhone', 'gender',
                'managerId', 'lowReason', 'workingDayType'
            ];

            stringFields.forEach(field => {
                if (body[field] !== undefined) {
                    updateData[field] = body[field];
                }
            });

            // Mapeo de campos Date
            const dateFields = [
                'entryDate', 'exitDate', 'callDate', 'contractInterruptionDate', 'lowDate',
                'dniExpiration', 'birthDate', 'drivingLicenseExpiration'
            ];

            dateFields.forEach(field => {
                if (body[field] !== undefined) {
                    updateData[field] = body[field] ? new Date(body[field]) : null;
                }
            });

            // Mapeo de campos Boolean
            if (body.active !== undefined) updateData.active = body.active;
            if (body.drivingLicense !== undefined) {
                updateData.drivingLicense = body.drivingLicense === true || body.drivingLicense === 'true';
            }

            // Mapeo de campos Numeric
            if (body.weeklyHours !== undefined) {
                updateData.weeklyHours = body.weeklyHours ? parseFloat(body.weeklyHours) : null;
            }

            const employee = await prisma.employee.update({
                where: { id },
                data: updateData
            });

            // Audit
            await AuditService.log('UPDATE', 'EMPLOYEE', id, body);

            res.json(employee);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al actualizar el empleado' });
        }
    },

    // Descargar Plantilla Excel
    downloadTemplate: async (req: Request, res: Response) => {
        try {
            const XLSX = require('xlsx');

            // Header definition
            const headers = [
                'Nombre', 'Apellido', 'DNI', 'DNI Vencimiento', 'Subcuenta 465',
                'Email', 'Teléfono', 'Dirección', 'Provincia', 'Ciudad', 'Código Postal',
                'Seguridad Social', 'IBAN', 'Fecha Nacimiento', 'Lugar Registro',
                'Empresa (ID)', 'Departamento', 'Categoría', 'Puesto',
                'Tipo Contrato', 'Convenio', 'Fecha Entrada',
                'Llamada Fijo-Disc', 'Interrupción Fijo-Disc', 'Fecha Baja', 'Motivo Baja',
                'Carnet Conducir (SI/NO)', 'Tipo Carnet', 'Vencimiento Carnet',
                'Contacto Emergencia Nombre', 'Contacto Emergencia Teléfono',
                'Género', 'ID Responsable'
            ];

            const exampleData = [
                {
                    'Nombre': 'Juan',
                    'Apellido': 'Pérez García',
                    'DNI': '12345678A',
                    'DNI Vencimiento': '2028-12-31',
                    'Subcuenta 465': '465.1.0001',
                    'Email': 'juan@example.com',
                    'Teléfono': '600123456',
                    'Dirección': 'Calle Principal 123',
                    'Provincia': 'Baleares',
                    'Ciudad': 'Palma',
                    'Código Postal': '07001',
                    'Seguridad Social': '281234567890',
                    'IBAN': 'ES1234567890123456789012',
                    'Fecha Nacimiento': '1985-05-15',
                    'Lugar Registro': 'Palma',
                    'Empresa (ID)': '',
                    'Departamento': 'Ventas',
                    'Categoría': 'Oficial de 1ª',
                    'Puesto': 'Vendedor Senior',
                    'Tipo Contrato': 'Indefinido',
                    'Convenio': 'Comercio',
                    'Fecha Entrada': '2020-01-01',
                    'Llamada Fijo-Disc': '',
                    'Interrupción Fijo-Disc': '',
                    'Fecha Baja': '',
                    'Motivo Baja': '',
                    'Carnet Conducir (SI/NO)': 'SI',
                    'Tipo Carnet': 'B',
                    'Vencimiento Carnet': '2030-01-01',
                    'Contacto Emergencia Nombre': 'María Pérez',
                    'Contacto Emergencia Teléfono': '600987654'
                }
            ];

            const instructions = [
                { 'Campo': 'Instrucciones Generales', 'Descripción': 'Sigue estas reglas para una importación correcta.' },
                { 'Campo': 'Formato Fechas', 'Descripción': 'Usa el formato AAAA-MM-DD (Ej: 2024-05-20)' },
                { 'Campo': 'Valores SI/NO', 'Descripción': 'Para campos booleanos como Carnet de Conducir, usa SI o NO' },
                { 'Campo': 'DNI', 'Descripción': 'Obligatorio. Se usa para detectar si el empleado ya existe.' },
                { 'Campo': 'Subcuenta 465', 'Descripción': 'Obligatorio. Formato 465.X.XXXX' }
            ];

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
            XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Importación');
            const wsIns = XLSX.utils.json_to_sheet(instructions);
            XLSX.utils.book_append_sheet(wb, wsIns, 'INSTRUCCIONES');

            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=plantilla_empleados_avanzada.xlsx');
            res.send(buffer);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al generar la plantilla' });
        }
    },

    // --- PRL & TRAINING ---
    getMedicalReviews: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const reviews = await prisma.medicalReview.findMany({
                where: { employeeId: id },
                orderBy: { date: 'desc' }
            });
            res.json(reviews);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener revisiones médicas' });
        }
    },

    createMedicalReview: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { date, result, nextReviewDate } = req.body;
        try {
            const review = await prisma.medicalReview.create({
                data: {
                    employeeId: id,
                    date: new Date(date),
                    result,
                    nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : null
                }
            });
            res.status(201).json(review);
        } catch (error) {
            res.status(500).json({ error: 'Error al crear la revisión médica' });
        }
    },

    getTrainings: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const trainings = await prisma.training.findMany({
                where: { employeeId: id },
                orderBy: { date: 'desc' }
            });
            res.json(trainings);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener formaciones' });
        }
    },

    createTraining: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { name, type, date, hours } = req.body;
        try {
            const training = await prisma.training.create({
                data: {
                    employeeId: id,
                    name,
                    type,
                    date: new Date(date),
                    hours: hours ? parseInt(hours) : null
                }
            });
            res.status(201).json(training);
        } catch (error) {
            res.status(500).json({ error: 'Error al crear la formación' });
        }
    },

    deleteMedicalReview: async (req: Request, res: Response) => {
        const { reviewId } = req.params;
        try {
            await prisma.medicalReview.delete({ where: { id: reviewId } });
            res.json({ message: 'Revisión eliminada' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar revisión' });
        }
    },

    deleteTraining: async (req: Request, res: Response) => {
        const { trainingId } = req.params;
        try {
            await prisma.training.delete({ where: { id: trainingId } });
            res.json({ message: 'Formación eliminada' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar formación' });
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const documents = await prisma.document.findMany({
                where: { employeeId: id }
            });

            try {
                await prisma.employee.delete({ where: { id } });

                for (const doc of documents) {
                    const filePath = path.join(process.cwd(), doc.fileUrl);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }

                return ApiResponse.success(res, null, 'Empleado y sus documentos eliminados correctamente');
            } catch (e) {
                await prisma.employee.update({
                    where: { id },
                    data: { active: false }
                });
                return ApiResponse.success(res, null, 'Empleado desactivado (tiene registros históricos asociados)');
            }
        } catch (error) {
            throw new AppError('Error al eliminar empleado', 500);
        }
    }
};
