import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuditService } from '../services/AuditService';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { EncryptionService } from '../services/EncryptionService';

export const EmployeeController = {
    // Obtener todos los empleados
    getAll: async (req: Request, res: Response) => {
        try {
            const employees = await prisma.employee.findMany({
                where: { active: true },
                orderBy: { name: 'asc' }
            });

            // Decrypt sensitive data
            const decryptedEmployees = employees.map(emp => ({
                ...emp,
                socialSecurityNumber: EncryptionService.decrypt(emp.socialSecurityNumber),
                iban: EncryptionService.decrypt(emp.iban)
            }));

            return ApiResponse.success(res, decryptedEmployees);
        } catch (error: any) {
            console.error('Error fetching employees:', error);
            return ApiResponse.error(res, error.message || 'Error al obtener empleados', 500);
        }
    },

    getDepartments: async (req: Request, res: Response) => {
        try {
            const results = await prisma.employee.findMany({
                where: { active: true, department: { not: null } },
                select: { department: true },
                distinct: ['department']
            });
            const departments = results.map(r => r.department).filter(Boolean).sort();
            return ApiResponse.success(res, departments);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al obtener departamentos', 500);
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
        } catch (error: any) {
            console.error('Error fetching hierarchy:', error);
            return ApiResponse.error(res, error.message || 'Error al obtener jerarquía', 500);
        }
    },

    // Importar Empleados desde Excel (Simple: Nombre, DNI, Subcuenta)
    importEmployees: async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return ApiResponse.error(res, 'No se ha subido ningún archivo', 400);
            }

            // Delegar lógica compleja al servicio
            const { EmployeeImportService } = await import('../services/EmployeeImportService');
            const result = await EmployeeImportService.processFile(req.file.buffer);

            const userId = (req as any).user?.id;
            await AuditService.log('IMPORT', 'EMPLOYEE', 'MULTIPLE', { count: result.importedCount }, userId);

            return ApiResponse.success(res, result, `Importación completada. ${result.importedCount} empleados procesados.`);
        } catch (error: any) {
            console.error(error);
            return ApiResponse.error(res, error.message || 'Error procesando el archivo de empleados', 500);
        }
    },

    // Obtener un empleado con su histórico
    getById: async (req: Request, res: Response) => {
        const { id } = req.params;
        const user = (req as any).user;

        // Security Check: Admin or Self
        if (user.role !== 'admin' && user.employeeId !== id) {
            return ApiResponse.error(res, 'No tienes permiso para ver este perfil', 403);
        }

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
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            // Decrypt sensitive data
            employee.socialSecurityNumber = EncryptionService.decrypt(employee.socialSecurityNumber);
            employee.iban = EncryptionService.decrypt(employee.iban);

            // Audit access to sensitive data
            const userId = (req as any).user?.id;
            await AuditService.log('VIEW_SENSITIVE_DATA', 'EMPLOYEE', id, { info: 'Acceso a ficha detallada' }, userId, id);

            return ApiResponse.success(res, employee);
        } catch (error: any) {
            console.error(error);
            return ApiResponse.error(res, error.message || 'Error al obtener el empleado', 500);
        }
    },

    // Crear un nuevo empleado
    create: async (req: Request, res: Response) => {
        try {
            const {
                dni, name, subaccount465, department,
                firstName, lastName, email, phone, address, city, postalCode,
                socialSecurityNumber, iban, companyId, category, contractType,
                agreementType, jobTitle, entryDate, callDate, contractInterruptionDate,
                dniExpiration, birthDate, province, registeredIn,
                drivingLicense, drivingLicenseType, drivingLicenseExpiration,
                emergencyContactName, emergencyContactPhone,
                workingDayType, weeklyHours, gender, managerId, privateNotes
            } = req.body;

            const userId = (req as any).user?.id;

            // Validaciones básicas
            const existingDni = await prisma.employee.findUnique({ where: { dni } });
            if (existingDni) {
                return ApiResponse.error(res, 'Ya existe un empleado con ese DNI', 400);
            }

            if (subaccount465) {
                const existingSub = await prisma.employee.findUnique({ where: { subaccount465 } });
                if (existingSub) {
                    return ApiResponse.error(res, 'Esa subcuenta 465 ya está asignada', 400);
                }
            }

            const employee = await prisma.employee.create({
                data: {
                    dni,
                    name: name || `${firstName} ${lastName}`,
                    firstName, lastName, email, phone, address, city, postalCode,
                    subaccount465: subaccount465 || null,
                    socialSecurityNumber: EncryptionService.encrypt(socialSecurityNumber),
                    iban: EncryptionService.encrypt(iban),
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
                    privateNotes: privateNotes || null,
                    active: true
                }
            });

            // Audit
            await AuditService.log('CREATE', 'EMPLOYEE', employee.id, { name: employee.name }, userId, employee.id);

            return ApiResponse.success(res, employee, 'Empleado creado correctamente', 201);
        } catch (error: any) {
            console.error(error);
            return ApiResponse.error(res, error.message || 'Error al crear el empleado', 500);
        }
    },

    // Actualizar empleado (Soporta PATCH parcial)
    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        const body = req.body;
        const userId = (req as any).user?.id;

        try {
            const updateData: any = {};

            // Mapeo de campos directos (String / null)
            const stringFields = [
                'name', 'firstName', 'lastName', 'email', 'phone', 'address', 'city', 'postalCode',
                'subaccount465', 'department', 'socialSecurityNumber', 'iban', 'companyId',
                'category', 'contractType', 'agreementType', 'jobTitle', 'province', 'registeredIn',
                'drivingLicenseType', 'emergencyContactName', 'emergencyContactPhone', 'gender',
                'managerId', 'lowReason', 'workingDayType', 'privateNotes'
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

            // Encrypt sensitive fields if they are being updated
            if (updateData.socialSecurityNumber) {
                updateData.socialSecurityNumber = EncryptionService.encrypt(updateData.socialSecurityNumber);
            }
            if (updateData.iban) {
                updateData.iban = EncryptionService.encrypt(updateData.iban);
            }

            const employee = await prisma.employee.update({
                where: { id },
                data: updateData
            });

            // Audit
            await AuditService.log('UPDATE', 'EMPLOYEE', id, body, userId, id);

            return ApiResponse.success(res, employee, 'Empleado actualizado correctamente');
        } catch (error: any) {
            console.error(error);
            return ApiResponse.error(res, error.message || 'Error al actualizar el empleado', 500);
        }
    },

    // Bulk Updates (Actions en lote)
    bulkUpdate: async (req: Request, res: Response) => {
        const { employeeIds, action, data } = req.body;
        const userId = (req as any).user?.id;

        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return ApiResponse.error(res, 'Selecciona al menos un empleado', 400);
        }

        try {
            const results = await prisma.$transaction(async (tx) => {
                let updatedCount = 0;

                for (const empId of employeeIds) {
                    let updateData: any = {};
                    let logAction = '';
                    let logInfo = '';

                    switch (action) {
                        case 'activate':
                            updateData = { active: true, exitDate: null };
                            logAction = 'BULK_ACTIVATE';
                            logInfo = 'Activación masiva';
                            break;
                        case 'deactivate':
                            updateData = { active: false, exitDate: new Date() };
                            logAction = 'BULK_DEACTIVATE';
                            logInfo = 'Baja masiva';
                            break;
                        case 'delete':
                            updateData = { active: false, exitDate: new Date() }; // Soft delete
                            logAction = 'BULK_DELETE';
                            logInfo = 'Eliminación masiva (Soft)';
                            break;
                        case 'change_dept':
                            if (!data.department) throw new Error('Departamento no especificado');
                            updateData = { department: data.department };
                            logAction = 'BULK_CHANGE_DEPT';
                            logInfo = `Cambio masivo a ${data.department}`;
                            break;
                        default:
                            throw new Error('Acción no válida');
                    }

                    // Perform update
                    await tx.employee.update({
                        where: { id: empId },
                        data: updateData
                    });

                    // Create Individual Audit Log
                    await tx.auditLog.create({
                        data: {
                            action: logAction,
                            entity: 'EMPLOYEE',
                            entityId: empId,
                            userId: userId,
                            targetEmployee: { connect: { id: empId } },
                            metadata: JSON.stringify({ info: logInfo, ...updateData })
                        } as any
                    });

                    updatedCount++;
                }
                return updatedCount;
            });

            return ApiResponse.success(res, { count: results }, `${results} empleados actualizados correctamente`);
        } catch (error: any) {
            console.error('Bulk update error:', error);
            return ApiResponse.error(res, error.message || 'Error en la actualización masiva', 500);
        }
    },

    downloadTemplate: async (req: Request, res: Response) => {
        try {
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
                // Row 1: Clear hints/examples
                {
                    'Nombre': 'EJEMPLO: Juan',
                    'Apellido': 'EJEMPLO: Pérez García',
                    'DNI': 'EJEMPLO: 12345678A',
                    'DNI Vencimiento': 'EJEMPLO: 2028-12-31',
                    'Subcuenta 465': 'EJEMPLO: 465.1.0001',
                    'Email': 'juan@ejemplo.com',
                    'Teléfono': '600000000',
                    'Dirección': 'Calle Falsa 123',
                    'Provincia': 'Baleares',
                    'Ciudad': 'Palma',
                    'Código Postal': '07001',
                    'Seguridad Social': '281234567890',
                    'IBAN': 'ES00...',
                    'Fecha Nacimiento': '1990-01-01',
                    'Lugar Registro': 'Palma',
                    'Empresa (ID)': '(Opcional)',
                    'Departamento': 'RRHH',
                    'Categoría': 'Oficial',
                    'Puesto': 'Administrativo',
                    'Tipo Contrato': 'Indefinido',
                    'Convenio': 'Comercio',
                    'Fecha Entrada': '2024-01-01',
                    'Carnet Conducir (SI/NO)': 'SI',
                    'Género': 'HOMBRE'
                },
                // Row 2: Actual clean example
                {
                    'Nombre': 'Maria',
                    'Apellido': 'Lopez',
                    'DNI': '87654321B',
                    'Subcuenta 465': '465.1.0002',
                    'DNI Vencimiento': '2027-05-20',
                    'Fecha Entrada': '2023-06-15',
                    'Carnet Conducir (SI/NO)': 'NO'
                }
            ];

            const instructions = [
                { 'Campo': 'Instrucciones Generales', 'Descripción': 'Sigue estas reglas para una importación correcta.' },
                { 'Campo': 'IMPORTANTE', 'Descripción': 'No borres las cabeceras de la fila 1.' },
                { 'Campo': 'CAMPOS EJEMPLO', 'Descripción': 'Las filas que empiezan con "EJEMPLO:" serán ignoradas por el sistema.' },
                { 'Campo': 'Formato Fechas', 'Descripción': 'Usa el formato AAAA-MM-DD (Ej: 2024-05-20)' },
                { 'Campo': 'Valores SI/NO', 'Descripción': 'Para campos booleanos como Carnet de Conducir, usa SI o NO' },
                { 'Campo': 'DNI / Subcuenta', 'Descripción': 'Son obligatorios para dar de alta al empleado.' }
            ];

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });

            // Set some column widths for better readability
            const wscols = headers.map(() => ({ wch: 20 }));
            ws['!cols'] = wscols;

            XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Importación');
            const wsIns = XLSX.utils.json_to_sheet(instructions);
            XLSX.utils.book_append_sheet(wb, wsIns, 'INSTRUCCIONES');

            // Write to buffer using a more compatible mode
            const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=plantilla_empleados.xlsx');
            return res.send(Buffer.from(excelBuffer));
        } catch (error: any) {
            console.error('Error generating Excel template:', error);
            return ApiResponse.error(res, error.message || 'Error al generar la plantilla', 500);
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
            return ApiResponse.success(res, reviews);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al obtener revisiones médicas', 500);
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
            return ApiResponse.success(res, review, 'Revisión médica creada correctamente', 201);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al crear la revisión médica', 500);
        }
    },

    getTrainings: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const trainings = await prisma.training.findMany({
                where: { employeeId: id },
                orderBy: { date: 'desc' }
            });
            return ApiResponse.success(res, trainings);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al obtener formaciones', 500);
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
            return ApiResponse.success(res, training, 'Formación creada correctamente', 201);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al crear la formación', 500);
        }
    },

    deleteMedicalReview: async (req: Request, res: Response) => {
        const { reviewId } = req.params;
        try {
            await prisma.medicalReview.delete({ where: { id: reviewId } });
            return ApiResponse.success(res, null, 'Revisión eliminada');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al eliminar revisión', 500);
        }
    },

    deleteTraining: async (req: Request, res: Response) => {
        const { trainingId } = req.params;
        try {
            await prisma.training.delete({ where: { id: trainingId } });
            return ApiResponse.success(res, null, 'Formación eliminada');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al eliminar formación', 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        const userId = (req as any).user?.id;
        try {
            // Fetch name before deleting for audit
            const employee = await prisma.employee.findUnique({ where: { id }, select: { name: true } });

            // Soft delete: just set active to false
            await prisma.employee.update({
                where: { id },
                data: {
                    active: false,
                    exitDate: new Date() // Set exit date today if not set
                }
            });

            // Audit
            await AuditService.log('DELETE', 'EMPLOYEE', id, {
                name: employee?.name || 'Desconocido',
                info: 'Soft delete (deactivation)'
            }, userId, id);

            return ApiResponse.success(res, null, 'Empleado desactivado correctamente');
        } catch (error: any) {
            console.error('Error deactivating employee:', error);
            return ApiResponse.error(res, error.message || 'Error al dar de baja al empleado', 500);
        }
    },

    // Generar reporte de portabilidad (RGPD)
    getPortabilityReport: async (req: Request, res: Response) => {
        const { id } = req.params;
        const userId = (req as any).user?.id;

        try {
            const employee = await prisma.employee.findUnique({
                where: { id },
                include: {
                    company: true,
                    assets: true,
                    vacations: true,
                    medicalReviews: true,
                    trainings: true,
                    documents: true,
                    payrollRows: {
                        include: { batch: true }
                    }
                }
            });

            if (!employee) {
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            // Decrypt sensitive data for the report
            const reportData = {
                ...employee,
                socialSecurityNumber: EncryptionService.decrypt(employee.socialSecurityNumber),
                iban: EncryptionService.decrypt(employee.iban),
                _metadata: {
                    reportGeneratedAt: new Date(),
                    generatedBy: userId,
                    legalBasis: 'RGPD - Derecho de Acceso / Portabilidad'
                }
            };

            // Audit the report generation
            await AuditService.log('RGPD_PORTABILITY_REPORT', 'EMPLOYEE', id, { info: 'Generación de reporte de portabilidad' }, userId, id);

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=portabilidad_${employee.lastName}_${employee.firstName}.json`);
            return res.json(reportData);
        } catch (error: any) {
            console.error('Error generating portability report:', error);
            return ApiResponse.error(res, error.message || 'Error al generar reporte de portabilidad', 500);
        }
    }
};
