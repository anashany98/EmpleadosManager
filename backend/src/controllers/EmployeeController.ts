import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuditService } from '../services/AuditService';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import * as ExcelJS from 'exceljs';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';
import {
    buildEmployeePortabilityReport,
    buildSelfEmployeeUpdateData,
    canManageEmployee,
    canReadEmployeeDetail,
    canReadEmployeeSensitiveData,
    canSelfEditEmployee,
    sanitizeEmployeeDetail,
    sanitizeEmployeeListItem
} from '../policies/employeeAccess';
import { SELF_EDITABLE_EMPLOYEE_FIELDS } from '../../../shared/authz';
import { buildCompanyEmployeeUpdateData, buildEmployeeCreateData } from '../services/EmployeeWriteService';
import { getPaginationParams, getPrismaPagination, buildPaginationMeta } from '../utils/pagination';

const log = createLogger('EmployeeController');

export const EmployeeController = {
    // Obtener todos los empleados
    getAll: async (req: Request, res: Response) => {
        try {
            const pagination = getPaginationParams(req);
            const prismaPagination = getPrismaPagination(pagination);

            const { user } = req as AuthenticatedRequest;
            const search = (req.query.search as string || '').trim();
            const status = req.query.status as string || 'active';

            const whereClause: any = {};

            // Company/role filter
            if (user.companyId) {
                whereClause.companyId = user.companyId;
            } else if (user.role !== 'admin') {
                throw new AppError('Usuario sin empresa asignada', 403);
            }

            // Status filter - allow 'active', 'inactive', or 'all'
            if (status === 'inactive') {
                whereClause.active = false;
            } else if (status === 'active' || !status) {
                whereClause.active = true;
            }
            // 'all' returns all employees regardless of active status

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
                    ...prismaPagination
                })
            ]);

            const safeEmployees = employees.map((employee) => sanitizeEmployeeListItem(employee));

            if (pagination.isPaginationRequested) {
                return ApiResponse.success(res, {
                    data: safeEmployees,
                    meta: buildPaginationMeta(total, pagination)
                });
            }

            return ApiResponse.success(res, safeEmployees);

         
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

            const { user } = req as AuthenticatedRequest;

            const isGlobalAdmin = !user.companyId && user.role === 'admin';

            if (!isGlobalAdmin && !user.companyId) {
                return ApiResponse.error(res, 'No tienes una empresa asignada para importar empleados', 400);
            }

            const importOptions = {
                forceCompanyId: user.companyId || undefined,
                skipCompanyValidation: isGlobalAdmin
            };

            const { EmployeeImportService } = await import('../services/EmployeeImportService');
            const result = await EmployeeImportService.processFile(req.file.buffer, importOptions);

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
            const employee = await prisma.employee.findUnique({
                where: { id },
                include: {
                    manager: { select: { id: true, name: true } },
                    emergencyContacts: true
                }
            });

            if (!employee) {
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            if (!canReadEmployeeDetail(user, employee)) {
                return ApiResponse.error(res, 'No tienes permiso para ver este perfil', 403);
            }

            const includeSensitiveData = canReadEmployeeSensitiveData(user, employee);
            const detailedEmployee = includeSensitiveData
                ? await prisma.employee.findUnique({
                    where: { id },
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
                })
                : employee;

            if (!detailedEmployee) {
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            const serializedEmployee = sanitizeEmployeeDetail(detailedEmployee, includeSensitiveData);

            if (includeSensitiveData) {
                const userId = (req as AuthenticatedRequest).user?.id;
                await AuditService.log('VIEW_SENSITIVE_DATA', 'EMPLOYEE', id, { info: 'Acceso a ficha detallada' }, userId, id);
            }

            return ApiResponse.success(res, serializedEmployee);
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

            const employee = await prisma.employee.create({
                data: buildEmployeeCreateData(body, effectiveCompanyId)
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
            const target = await prisma.employee.findUnique({
                where: { id },
                select: { id: true, companyId: true }
            });

            if (!target) {
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            const canCompanyEdit = canManageEmployee(user, target);
            const canSelfEdit = canSelfEditEmployee(user, target);

            if (!canCompanyEdit && !canSelfEdit) {
                throw new AppError('No tienes permiso para editar este empleado', 403);
            }

            if (user.companyId && body.companyId && body.companyId !== user.companyId) {
                throw new AppError('No puedes mover empleados a otra empresa', 403);
            }

            let updateData: any = {};

            if (canCompanyEdit) {
                updateData = buildCompanyEmployeeUpdateData(body);
            } else {
                const allowedSelfFields = new Set<string>(SELF_EDITABLE_EMPLOYEE_FIELDS);
                const attemptedForbiddenFields = Object.keys(body).filter((field) => !allowedSelfFields.has(field));

                if (attemptedForbiddenFields.length > 0) {
                    throw new AppError('Solo puedes editar tus datos de contacto y emergencia', 403);
                }

                updateData = buildSelfEmployeeUpdateData(body);
            }

            if (Object.keys(updateData).length === 0) {
                return ApiResponse.error(res, 'No hay cambios validos para aplicar', 400);
            }

            const employee = await prisma.employee.update({
                where: { id },
                data: updateData,
                include: {
                    manager: { select: { id: true, name: true } },
                    emergencyContacts: true
                }
            });

            const includeSensitiveData = canReadEmployeeSensitiveData(user, target);
            await AuditService.log('UPDATE', 'EMPLOYEE', id, {
                fields: Object.keys(updateData),
                selfService: !canCompanyEdit
            }, user.id, id);

            return ApiResponse.success(
                res,
                sanitizeEmployeeDetail(employee, includeSensitiveData),
                'Empleado actualizado correctamente'
            );
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
                            user: { connect: { id: user.id } },
                            targetEmployee: { connect: { id: empId } },
                            metadata: JSON.stringify({ info: logInfo, ...updateData })
                        }
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

            const workbook = new ExcelJS.Workbook();

            // Sheet 1: Plantilla Importación
            const sheet = workbook.addWorksheet('Plantilla Importación');
            sheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));

            // Style header row
            sheet.getRow(1).font = { bold: true };

            // Add example data row
            sheet.addRow(exampleData[0]);

            // Sheet 2: INSTRUCCIONES
            const wsIns = workbook.addWorksheet('INSTRUCCIONES');
            wsIns.columns = [
                { header: 'Campo', key: 'Campo', width: 30 },
                { header: 'Descripción', key: 'Descripción', width: 50 }
            ];
            wsIns.getRow(1).font = { bold: true };
            wsIns.addRow(instructions[0]);

            const excelBuffer = await workbook.xlsx.writeBuffer();

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
                throw new AppError('No autorizado', 403);
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
                throw new AppError('No autorizado', 403);
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
                throw new AppError('No autorizado', 403);
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
                throw new AppError('No autorizado', 403);
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
        try {
            const { user } = req as AuthenticatedRequest;
            const isGlobalAdmin = !user.companyId && user.role === 'admin';
            const whereClause: any = { active: true };

            if (!isGlobalAdmin && user.companyId) {
                whereClause.companyId = user.companyId;
            }

            const [employees, companies, assets, vacations, medicalReviews, trainings, documents, payrollRows] = await Promise.all([
                prisma.employee.findMany({
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
                }),
                isGlobalAdmin ? prisma.company.findMany() : Promise.resolve([]),
                prisma.asset.findMany({ where: { employeeId: { not: null } } }),
                prisma.vacation.findMany({ where: { startDate: { gte: new Date(new Date().getFullYear() + '-01-01') } } }),
                prisma.medicalReview.findMany(),
                prisma.training.findMany(),
                prisma.document.findMany(),
                prisma.payrollRow.findMany({ where: { batch: { status: 'OK' } }, include: { batch: true } })
            ]);

            const reportData = {
                generatedAt: new Date().toISOString(),
                generatedBy: user.email,
                employees: employees.map(emp => ({
                    id: emp.id,
                    name: `${emp.firstName} ${emp.lastName}`,
                    company: emp.company?.name || 'N/A',
                    contractType: emp.contractType,
                    entryDate: emp.entryDate,
                    active: emp.active
                })),
                summary: {
                    totalEmployees: employees.length,
                    activeEmployees: employees.filter(e => e.active).length,
                    totalCompanies: isGlobalAdmin ? companies.length : 1,
                    totalAssets: assets.length,
                    totalVacationsThisYear: vacations.length,
                    totalMedicalReviews: medicalReviews.length,
                    totalTrainings: trainings.length,
                    totalDocuments: documents.length,
                    totalPayrollRows: payrollRows.length
                }
            };

            return res.json(reportData);
        } catch (error: any) {
            log.error({ error }, 'Error generating portability report');
            return ApiResponse.error(res, error.message || 'Error al generar reporte de portabilidad', 500);
        }
    },

    getFieldOptions: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const isGlobalAdmin = !user.companyId && user.role === 'admin';

            const [employees, companies] = await Promise.all([
                prisma.employee.findMany({
                    where: { active: true, ...(user.companyId && !isGlobalAdmin ? { companyId: user.companyId } : {}) },
                    select: {
                        department: true,
                        category: true,
                        contractType: true,
                        jobTitle: true
                    }
                }),
                isGlobalAdmin ? prisma.company.findMany({ select: { id: true, name: true } }) : Promise.resolve([])
            ]);

            const departments = [...new Set(employees.map(e => e.department).filter(Boolean))].sort();
            const categories = [...new Set(employees.map(e => e.category).filter(Boolean))].sort();
            const contractTypes = [...new Set(employees.map(e => e.contractType).filter(Boolean))].sort();
            const jobTitles = [...new Set(employees.map(e => e.jobTitle).filter(Boolean))].sort();

            return ApiResponse.success(res, {
                departments,
                categories,
                contractTypes,
                jobTitles,
                companies: isGlobalAdmin ? companies : []
            });
        } catch (error: any) {
            log.error({ error }, 'Error fetching field options');
            return ApiResponse.error(res, error.message || 'Error al obtener opciones', 500);
        }
    },

    getVacationBalance: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const year = parseInt(req.query.year as string) || new Date().getFullYear();

            if (!user || !id) {
                return ApiResponse.error(res, 'Usuario o empleado no identificado', 401);
            }

            // Tenant isolation
            const targetEmployee = await prisma.employee.findUnique({
                where: { id },
                select: { id: true, companyId: true }
            });

            if (!targetEmployee) {
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            const isGlobalAdmin = !user.companyId && user.role === 'admin';
            if (!isGlobalAdmin && targetEmployee.companyId !== user.companyId) {
                return ApiResponse.error(res, 'No tienes acceso a este empleado', 403);
            }

            const { getEmployeeVacationBalanceSummary } = await import('../services/VacationBalanceService');
            const summary = await getEmployeeVacationBalanceSummary(id, year);

            if (!summary) {
                return ApiResponse.error(res, 'No se pudo calcular el saldo de vacaciones', 404);
            }

            return ApiResponse.success(res, summary);
        } catch (error: any) {
            log.error({ error }, 'Error fetching vacation balance');
            return ApiResponse.error(res, error.message || 'Error al obtener saldo de vacaciones', 500);
        }
    },

    updateVacationBalance: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const { year, annualQuotaDays, carriedOverDays, importedUsedDays } = req.body;

            if (!user || !id) {
                return ApiResponse.error(res, 'Usuario o empleado no identificado', 401);
            }

            // Tenant isolation
            const targetEmployee = await prisma.employee.findUnique({
                where: { id },
                select: { id: true, companyId: true, entryDate: true, createdAt: true }
            });

            if (!targetEmployee) {
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            const isGlobalAdmin = !user.companyId && user.role === 'admin';
            if (!isGlobalAdmin && targetEmployee.companyId !== user.companyId) {
                return ApiResponse.error(res, 'No tienes acceso a este empleado', 403);
            }

            const { upsertEmployeeVacationBalance, getEmployeeVacationBalanceSummary } = await import('../services/VacationBalanceService');

            const result = await upsertEmployeeVacationBalance(targetEmployee, year, {
                annualQuotaDays,
                carriedOverDays,
                importedUsedDays
            });

            const summary = await getEmployeeVacationBalanceSummary(id, year);

            return ApiResponse.success(res, summary, 'Saldo de vacaciones actualizado');
        } catch (error: any) {
            log.error({ error }, 'Error updating vacation balance');
            return ApiResponse.error(res, error.message || 'Error al actualizar saldo de vacaciones', 500);
        }
    },

    updatePrivateNotes: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const { note } = req.body;

            if (!user || !id) {
                return ApiResponse.error(res, 'Usuario o empleado no identificado', 401);
            }

            // Tenant isolation
            const targetEmployee = await prisma.employee.findUnique({
                where: { id },
                select: { id: true, companyId: true, privateNotes: true }
            });

            if (!targetEmployee) {
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            const isGlobalAdmin = !user.companyId && user.role === 'admin';
            if (!isGlobalAdmin && targetEmployee.companyId !== user.companyId) {
                return ApiResponse.error(res, 'No tienes acceso a este empleado', 403);
            }

            const previousNote = targetEmployee.privateNotes;

            const updated = await prisma.employee.update({
                where: { id },
                data: { privateNotes: note },
                select: { id: true, privateNotes: true }
            });

            // Record history in audit log
            await prisma.auditLog.create({
                data: {
                    action: 'PRIVATE_NOTE_UPDATE',
                    entity: 'EMPLOYEE',
                    entityId: id,
                    userId: user.id,
                    targetEmployeeId: id,
                    metadata: JSON.stringify({
                        note,
                        previousNote: previousNote || null
                    })
                }
            });

            return ApiResponse.success(res, { privateNotes: updated.privateNotes }, 'Notas privadas actualizadas');
        } catch (error: any) {
            log.error({ error }, 'Error updating private notes');
            return ApiResponse.error(res, error.message || 'Error al actualizar notas privadas', 500);
        }
    },

    getPrivateNotesHistory: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;

            if (!user || !id) {
                return ApiResponse.error(res, 'Usuario o empleado no identificado', 401);
            }

            // Tenant isolation
            const targetEmployee = await prisma.employee.findUnique({
                where: { id },
                select: { id: true, companyId: true }
            });

            if (!targetEmployee) {
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            const isGlobalAdmin = !user.companyId && user.role === 'admin';
            if (!isGlobalAdmin && targetEmployee.companyId !== user.companyId) {
                return ApiResponse.error(res, 'No tienes acceso a este empleado', 403);
            }

            const history = await prisma.auditLog.findMany({
                where: {
                    entity: 'EMPLOYEE',
                    entityId: id,
                    action: 'PRIVATE_NOTE_UPDATE'
                },
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            email: true,
                            employee: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            });

            const entries = history.map(entry => {
                const metadata = typeof entry.metadata === 'string' ? JSON.parse(entry.metadata) : entry.metadata;
                return {
                    id: entry.id,
                    createdAt: entry.createdAt,
                    note: metadata?.note,
                    previousNote: metadata?.previousNote,
                    authorName: entry.user?.employee
                        ? `${entry.user.employee.firstName} ${entry.user.employee.lastName}`.trim()
                        : entry.user?.email || 'Desconocido'
                };
            });

            return ApiResponse.success(res, entries);
        } catch (error: any) {
            log.error({ error }, 'Error fetching private notes history');
            return ApiResponse.error(res, error.message || 'Error al obtener historial de notas', 500);
        }
    }
};
