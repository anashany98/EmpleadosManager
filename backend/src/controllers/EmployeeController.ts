import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuditService } from '../services/AuditService';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import * as XLSX from 'xlsx';
import { EncryptionService } from '../services/EncryptionService';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';

const log = createLogger('EmployeeController');

export const EmployeeController = {
    // Obtener todos los empleados
    getAll: async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const skip = (page - 1) * limit;

            const isPaginationRequested = req.query.page !== undefined;
            const effectiveLimit = isPaginationRequested ? limit : 500;

            const { user } = req as AuthenticatedRequest;
            const search = (req.query.search as string || '').trim();
            const whereClause: any = { active: true };

            if (user.companyId) {
                whereClause.companyId = user.companyId;
            } else if (user.role !== 'admin') {
                throw new AppError('Usuario sin empresa asignada', 403);
            }

            if (search) {
                whereClause.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { dni: { contains: search, mode: 'insensitive' } }
                ];
            }

            const [total, employees] = await Promise.all([
                prisma.employee.count({ where: whereClause }),
                prisma.employee.findMany({
                    where: whereClause,
                    orderBy: { name: 'asc' },
                    skip: isPaginationRequested ? skip : undefined,
                    take: effectiveLimit
                })
            ]);

            const decryptedEmployees = employees.map(emp => ({
                ...emp,
                socialSecurityNumber: EncryptionService.decrypt(emp.socialSecurityNumber),
                iban: EncryptionService.decrypt(emp.iban)
            }));

            if (isPaginationRequested) {
                return ApiResponse.success(res, {
                    data: decryptedEmployees,
                    meta: {
                        total,
                        page,
                        limit: effectiveLimit,
                        totalPages: Math.ceil(total / effectiveLimit)
                    }
                });
            }

            return ApiResponse.success(res, decryptedEmployees);

        } catch (error: any) {
            log.error({ error }, 'Error fetching employees');
            return ApiResponse.error(res, error.message || 'Error al obtener empleados', error.statusCode || 500);
        }
    },

    getDepartments: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const whereClause: any = { active: true, department: { not: null } };
            if (user.companyId) {
                whereClause.companyId = user.companyId;
            } else if (user.role !== 'admin') {
                throw new AppError('Usuario sin empresa asignada', 403);
            }

            const results = await prisma.employee.findMany({
                where: whereClause,
                select: { department: true },
                distinct: ['department']
            });
            const departments = results.map(r => r.department).filter(Boolean).sort();
            return ApiResponse.success(res, departments);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al obtener departamentos', error.statusCode || 500);
        }
    },

    getHierarchy: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const whereClause: any = { active: true };
            if (user.companyId) {
                whereClause.companyId = user.companyId;
            } else if (user.role !== 'admin') {
                throw new AppError('Usuario sin empresa asignada', 403);
            }

            const employees = await prisma.employee.findMany({
                where: whereClause,
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
            log.error({ error }, 'Error fetching hierarchy');
            return ApiResponse.error(res, error.message || 'Error al obtener jerarquía', error.statusCode || 500);
        }
    },

    importEmployees: async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return ApiResponse.error(res, 'No se ha subido ningún archivo', 400);
            }

            // Note: Import Service likely needs update to support companyId injection context
            // For now, we assume logic is inside or it needs refactor.
            // Leaving as is but warning: Import might default improperly if not handled.
            const { EmployeeImportService } = await import('../services/EmployeeImportService');
            const result = await EmployeeImportService.processFile(req.file.buffer);

            const userId = (req as AuthenticatedRequest).user?.id;
            await AuditService.log('IMPORT', 'EMPLOYEE', 'MULTIPLE', { count: result.importedCount }, userId);

            return ApiResponse.success(res, result, `Importación completada. ${result.importedCount} empleados procesados.`);
        } catch (error: any) {
            log.error({ error }, 'Error importing employees');
            return ApiResponse.error(res, error.message || 'Error procesando el archivo de empleados', error.statusCode || 500);
        }
    },

    getById: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { user } = req as AuthenticatedRequest;

        try {
            const whereClause: any = { id };
            if (user.companyId) {
                whereClause.companyId = user.companyId;
            } else if (user.role !== 'admin') {
                throw new AppError('Usuario sin empresa asignada', 403);
            }

            // If user is accessing their own profile (e.g. Employee Portal), allow even if company Logic fails?
            // Actually, if I am an employee, I belong to the company, so filtering by companyId should still find ME.
            // Exception: If I am an "Admin" role but restricted to a company?
            // "Employee" role finding themselves: matching companyId + id works.

            const employee = await prisma.employee.findFirst({
                where: whereClause,
                include: {
                    payrollRows: {
                        where: { status: 'OK' },
                        include: {
                            batch: {
                                select: { year: true, month: true, status: true }
                            }
                        },
                        orderBy: { batch: { createdAt: 'desc' } },
                        take: 12
                    },
                    manager: { select: { id: true, name: true } },
                    emergencyContacts: true
                }
            });

            if (!employee) {
                // Determine if 404 or 403
                // If it exists but different company -> 404 (hide existence)
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            // Additional Check: If role is 'employee' (not HR/Admin), can I see ANY employee of my company?
            // Usually Regular Employees can only see themselves or limited info.
            // But this endpoint returns FULL info (Salary, SSN).
            // So: If not Admin/HR, MUST be SELF.
            if (user.role === 'employee' && user.employeeId !== id) {
                return ApiResponse.error(res, 'No tienes permiso para ver este perfil completo', 403);
            }
            // HR/Admin of same company -> Allowed by companyId filter above.

            employee.socialSecurityNumber = EncryptionService.decrypt(employee.socialSecurityNumber);
            employee.iban = EncryptionService.decrypt(employee.iban);

            const userId = (req as AuthenticatedRequest).user?.id;
            await AuditService.log('VIEW_SENSITIVE_DATA', 'EMPLOYEE', id, { info: 'Acceso a ficha detallada' }, userId, id);

            return ApiResponse.success(res, employee);
        } catch (error: any) {
            log.error({ error }, 'Error getting employee by id');
            return ApiResponse.error(res, error.message || 'Error al obtener el empleado', error.statusCode || 500);
        }
    },

    create: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const body = req.body;

            const {
                dni, name, subaccount465, department,
                firstName, lastName, email, phone, address, city, postalCode,
                socialSecurityNumber, iban, companyId, category, contractType,
                agreementType, jobTitle, entryDate, callDate, contractInterruptionDate,
                dniExpiration, birthDate, province, registeredIn,
                drivingLicense, drivingLicenseType, drivingLicenseExpiration,
                emergencyContacts,
                workingDayType, weeklyHours, gender, managerId, privateNotes,
                annualGrossSalary, monthlyGrossSalary, country
            } = body;

            // Force companyId
            let effectiveCompanyId = companyId;

            if (user.companyId) {
                // If user has company, force it
                if (companyId && companyId !== user.companyId) {
                    throw new AppError('No puedes crear empleados para otra empresa', 403);
                }
                effectiveCompanyId = user.companyId;
            } else if (user.role !== 'admin') {
                throw new AppError('Usuario sin empresa asignada', 403);
            }

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

            let contactsCreate = undefined;
            if (emergencyContacts && Array.isArray(emergencyContacts) && emergencyContacts.length > 0) {
                const contactsToSave = emergencyContacts.slice(0, 5);
                contactsCreate = {
                    create: contactsToSave.map((c: any) => ({
                        name: c.name,
                        phone: c.phone,
                        relationship: c.relationship
                    }))
                };
            }

            const employee = await prisma.employee.create({
                data: {
                    dni,
                    name: name || `${firstName} ${lastName}`,
                    firstName, lastName, email, phone, address, city, postalCode,
                    subaccount465: subaccount465 || null,
                    socialSecurityNumber: EncryptionService.encrypt(socialSecurityNumber),
                    iban: EncryptionService.encrypt(iban),
                    companyId: effectiveCompanyId,
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
                    emergencyContacts: contactsCreate,
                    workingDayType: workingDayType || 'COMPLETE',
                    weeklyHours: weeklyHours ? parseFloat(weeklyHours) : null,
                    gender: gender || null,
                    managerId: managerId || null,
                    privateNotes: privateNotes || null,
                    annualGrossSalary: annualGrossSalary ? parseFloat(annualGrossSalary) : 0,
                    monthlyGrossSalary: monthlyGrossSalary ? parseFloat(monthlyGrossSalary) : 0,
                    country: country || 'España',
                    active: true
                }
            });

            await AuditService.log('CREATE', 'EMPLOYEE', employee.id, { name: employee.name }, user.id, employee.id);
            return ApiResponse.success(res, employee, 'Empleado creado correctamente', 201);
        } catch (error: any) {
            log.error({ error }, 'Error creating employee');
            return ApiResponse.error(res, error.message || 'Error al criar el empleado', error.statusCode || 500);
        }
    },

    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        const body = req.body;
        const { user } = req as AuthenticatedRequest;

        try {
            // Security Check for Update
            // Security Check for Update
            if (user.companyId) {
                // User is restricted to a company (Admin or Manager/Employee)
                const target = await prisma.employee.findUnique({ where: { id }, select: { companyId: true } });
                if (!target || target.companyId !== user.companyId) {
                    // Exception: Self update?
                    if (user.employeeId !== id && user.role !== 'admin') {
                        // Admin of company CAN update employees of company
                        // Employee/Manager CAN update themselves?
                        if (user.employeeId !== id) throw new AppError('No tienes permiso para editar este empleado', 403);
                    }
                    if (user.role === 'admin' && target?.companyId !== user.companyId) {
                        throw new AppError('No autorizado para editar empleados de otra empresa', 403);
                    }
                }
                // Prevent changing companyId
                if (body.companyId && body.companyId !== user.companyId) {
                    throw new AppError('No puedes mover empleados a otra empresa', 403);
                }
            } else if (user.role !== 'admin') {
                throw new AppError('Usuario sin empresa', 403);
            }

            const updateData: any = {};
            const stringFields = [
                'name', 'firstName', 'lastName', 'email', 'phone', 'address', 'city', 'postalCode',
                'subaccount465', 'department', 'socialSecurityNumber', 'iban', 'companyId',
                'category', 'contractType', 'agreementType', 'jobTitle', 'province', 'registeredIn',
                'drivingLicenseType', 'gender',
                'managerId', 'lowReason', 'workingDayType', 'privateNotes', 'country'
            ];

            stringFields.forEach(field => {
                if (body[field] !== undefined) {
                    updateData[field] = body[field];
                }
            });

            const dateFields = [
                'entryDate', 'exitDate', 'callDate', 'contractInterruptionDate', 'lowDate',
                'dniExpiration', 'birthDate', 'drivingLicenseExpiration'
            ];

            dateFields.forEach(field => {
                if (body[field] !== undefined) {
                    updateData[field] = body[field] ? new Date(body[field]) : null;
                }
            });

            if (body.active !== undefined) updateData.active = body.active;
            if (body.drivingLicense !== undefined) {
                updateData.drivingLicense = body.drivingLicense === true || body.drivingLicense === 'true';
            }

            if (body.weeklyHours !== undefined) {
                updateData.weeklyHours = body.weeklyHours ? parseFloat(body.weeklyHours) : null;
            }
            if (body.annualGrossSalary !== undefined) {
                updateData.annualGrossSalary = body.annualGrossSalary ? parseFloat(body.annualGrossSalary) : 0;
            }
            if (body.monthlyGrossSalary !== undefined) {
                updateData.monthlyGrossSalary = body.monthlyGrossSalary ? parseFloat(body.monthlyGrossSalary) : 0;
            }

            if (updateData.socialSecurityNumber) {
                updateData.socialSecurityNumber = EncryptionService.encrypt(updateData.socialSecurityNumber);
            }
            if (updateData.iban) {
                updateData.iban = EncryptionService.encrypt(updateData.iban);
            }

            if (body.emergencyContacts && Array.isArray(body.emergencyContacts)) {
                const contactsToSave = body.emergencyContacts.slice(0, 5);
                updateData.emergencyContacts = {
                    deleteMany: {},
                    create: contactsToSave.map((c: any) => ({
                        name: c.name,
                        phone: c.phone,
                        relationship: c.relationship
                    }))
                };
            }

            const employee = await prisma.employee.update({
                where: { id },
                data: updateData
            });

            await AuditService.log('UPDATE', 'EMPLOYEE', id, body, user.id, id);
            return ApiResponse.success(res, employee, 'Empleado actualizado correctamente');
        } catch (error: any) {
            log.error({ error }, 'Error updating employee');
            return ApiResponse.error(res, error.message || 'Error al actualizar el empleado', error.statusCode || 500);
        }
    },

    bulkUpdate: async (req: Request, res: Response) => {
        const { employeeIds, action, data } = req.body;
        const { user } = req as AuthenticatedRequest;

        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return ApiResponse.error(res, 'Selecciona al menos un empleado', 400);
        }

        try {
            const results = await prisma.$transaction(async (tx) => {
                let updatedCount = 0;

                for (const empId of employeeIds) {
                    // Security Check per Item
                    if (user.companyId) {
                        const target = await tx.employee.findUnique({ where: { id: empId }, select: { companyId: true } });
                        if (!target || target.companyId !== user.companyId) {
                            throw new Error(`Permiso denegado para empleado ${empId} (Empresa Incorrecta)`);
                        }
                    } else if (user.role !== 'admin') {
                        throw new AppError('Usuario sin empresa', 403);
                    }

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
                            updateData = { active: false, exitDate: new Date() };
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

                    await tx.employee.update({
                        where: { id: empId },
                        data: updateData
                    });

                    await tx.auditLog.create({
                        data: {
                            action: logAction,
                            entity: 'EMPLOYEE',
                            entityId: empId,
                            userId: user.id,
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
            log.error({ error }, 'Bulk update error');
            return ApiResponse.error(res, error.message || 'Error en la actualización masiva', error.statusCode || 500);
        }
    },

    downloadTemplate: async (req: Request, res: Response) => {
        try {
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
                    'Nombre': 'EJEMPLO: Juan',
                    'DNI': 'EJEMPLO: 12345678A',
                    'Empresa (ID)': '(Opcional)',
                }
            ];

            const instructions = [
                { 'Campo': 'Instrucciones Generales', 'Descripción': 'Sigue estas reglas para una importación correcta.' }
            ];

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
            const wscols = headers.map(() => ({ wch: 20 }));
            ws['!cols'] = wscols;

            XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Importación');
            const wsIns = XLSX.utils.json_to_sheet(instructions);
            XLSX.utils.book_append_sheet(wb, wsIns, 'INSTRUCCIONES');

            const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=plantilla_empleados.xlsx');
            return res.send(Buffer.from(excelBuffer));
        } catch (error: any) {
            log.error({ error }, 'Error generating Excel template');
            return ApiResponse.error(res, error.message || 'Error al generar la plantilla', 500);
        }
    },

    getMedicalReviews: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { user } = req as AuthenticatedRequest;
        try {
            // Security Check
            const whereClause: any = { employeeId: id };
            if (user.companyId) {
                const target = await prisma.employee.findUnique({ where: { id }, select: { companyId: true } });
                if (!target || target.companyId !== user.companyId) {
                    if (user.employeeId !== id) throw new AppError('No autorizado', 403);
                }
            } else if (user.role !== 'admin') {
                throw new AppError('Usuario sin empresa', 403);
            }

            const reviews = await prisma.medicalReview.findMany({
                where: whereClause,
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
        const { user } = req as AuthenticatedRequest;
        try {
            if (user.role !== 'admin') {
                const target = await prisma.employee.findUnique({ where: { id }, select: { companyId: true } });
                if (!target || target.companyId !== user.companyId) throw new AppError('No autorizado', 403);
            }

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
        const { user } = req as AuthenticatedRequest;
        try {
            if (user.companyId) {
                const target = await prisma.employee.findUnique({ where: { id }, select: { companyId: true } });
                if (!target || target.companyId !== user.companyId) {
                    if (user.employeeId !== id) throw new AppError('No autorizado', 403);
                }
            } else if (user.role !== 'admin') {
                throw new AppError('No autorizado', 403);
            }

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
        const { user } = req as AuthenticatedRequest;
        try {
            if (user.companyId) {
                const target = await prisma.employee.findUnique({ where: { id }, select: { companyId: true } });
                if (!target || target.companyId !== user.companyId) throw new AppError('No autorizado', 403);
            } else if (user.role !== 'admin') {
                const target = await prisma.employee.findUnique({ where: { id }, select: { companyId: true } });
                if (!target || target.companyId !== user.companyId) throw new AppError('No autorizado', 403);
            }

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
        const { user } = req as AuthenticatedRequest;
        try {
            if (user.companyId) {
                const review = await prisma.medicalReview.findUnique({ where: { id: reviewId }, include: { employee: true } });
                if (!review || review.employee.companyId !== user.companyId) {
                    throw new AppError('No autorizado', 403);
                }
            } else if (user.role !== 'admin') {
                // Non-admins shouldn't be deleting reviews anyway, but if they could:
                const review = await prisma.medicalReview.findUnique({ where: { id: reviewId }, include: { employee: true } });
                if (!review || review.employee.companyId !== user.companyId) { // Fixed: using user.companyId for standard employees/managers
                    throw new AppError('No autorizado', 403);
                }
            }
            await prisma.medicalReview.delete({ where: { id: reviewId } });
            return ApiResponse.success(res, null, 'Revisión eliminada');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al eliminar revisión', error.statusCode || 500);
        }
    },

    deleteTraining: async (req: Request, res: Response) => {
        const { trainingId } = req.params;
        const { user } = req as AuthenticatedRequest;
        try {
            if (user.companyId) {
                const training = await prisma.training.findUnique({ where: { id: trainingId }, include: { employee: true } });
                if (!training || training.employee.companyId !== user.companyId) {
                    throw new AppError('No autorizado', 403);
                }
            } else if (user.role !== 'admin') {
                // Non-admins shouldn't be deleting trainings anyway
                const training = await prisma.training.findUnique({ where: { id: trainingId }, include: { employee: true } });
                if (!training || training.employee.companyId !== user.companyId) {
                    throw new AppError('No autorizado', 403);
                }
            }
            await prisma.training.delete({ where: { id: trainingId } });
            return ApiResponse.success(res, null, 'Formación eliminada');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al eliminar formación', error.statusCode || 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { user } = req as AuthenticatedRequest;
        try {
            const employee = await prisma.employee.findUnique({ where: { id }, select: { name: true, companyId: true } });

            if (user.companyId) {
                if (employee?.companyId !== user.companyId) throw new AppError('No autorizado', 403);
            } else if (user.role !== 'admin') {
                if (employee?.companyId !== user.companyId) throw new AppError('No autorizado', 403);
            }

            await prisma.employee.update({
                where: { id },
                data: {
                    active: false,
                    exitDate: new Date()
                }
            });

            await AuditService.log('DELETE', 'EMPLOYEE', id, {
                name: employee?.name || 'Desconocido',
                info: 'Soft delete (deactivation)'
            }, user.id, id);

            return ApiResponse.success(res, null, 'Empleado desactivado correctamente');
        } catch (error: any) {
            log.error({ error }, 'Error deactivating employee');
            return ApiResponse.error(res, error.message || 'Error al dar de baja al empleado', error.statusCode || 500);
        }
    },

    getPortabilityReport: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { user } = req as AuthenticatedRequest;

        try {
            const whereClause: any = { id };
            if (user.companyId) {
                whereClause.companyId = user.companyId;
            } else if (user.role !== 'admin') {
                throw new AppError('Usuario sin empresa asignada', 403);
            }

            const employee = await prisma.employee.findFirst({
                where: whereClause,
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

            if (user.role === 'employee' && user.employeeId !== id) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }

            const reportData = {
                ...employee,
                socialSecurityNumber: EncryptionService.decrypt(employee.socialSecurityNumber),
                iban: EncryptionService.decrypt(employee.iban),
                _metadata: {
                    reportGeneratedAt: new Date(),
                    generatedBy: user.id || 'system',
                    legalBasis: 'RGPD - Derecho de Acceso / Portabilidad'
                }
            };

            await AuditService.log('RGPD_PORTABILITY_REPORT', 'EMPLOYEE', id, { info: 'Generación de reporte de portabilidad' }, user.id, id);

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=portabilidad_${employee.lastName}_${employee.firstName}.json`);
            return res.json(reportData);
        } catch (error: any) {
            log.error({ error }, 'Error generating portability report');
            return ApiResponse.error(res, error.message || 'Error al generar reporte de portabilidad', 500);
        }
    }
};
