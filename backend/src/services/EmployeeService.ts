import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { AuditService } from './AuditService';
import { createLogger } from './LoggerService';
import { sanitizeText } from '../utils/sanitize';
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
import { buildCompanyEmployeeUpdateData, buildEmployeeCreateData } from './EmployeeWriteService';
import { getPaginationParams, getPrismaPagination, buildPaginationMeta } from '../utils/pagination';
import { AuthenticatedRequest } from '../types/express';

const log = createLogger('EmployeeService');

export class EmployeeService {
    /**
     * Get all employees with pagination and filters
     */
    static async getAll(user: AuthenticatedRequest['user'], query: {
        search?: string;
        status?: string;
        page?: string;
        limit?: string;
    }) {
        const pagination = getPaginationParams({ query } as any);
        // Enforce default pagination: if no page specified, use page 1 with limit 100
        if (!pagination.isPaginationRequested) {
            pagination.isPaginationRequested = true;
            pagination.limit = Math.min(pagination.limit, 100);
            pagination.skip = 0;
        }
        const prismaPagination = getPrismaPagination(pagination);

        const search = (query.search || '').trim();
        const status = query.status || 'active';

        const whereClause: any = {};

        // Company/role filter
        if (user.companyId) {
            whereClause.companyId = user.companyId;
        } else if (user.role !== 'admin') {
            throw new AppError('Usuario sin empresa asignada', 403);
        }

        // Status filter
        if (status === 'inactive') {
            whereClause.active = false;
        } else if (status === 'active' || !status) {
            whereClause.active = true;
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
                ...prismaPagination
            })
        ]);

        const safeEmployees = employees.map((employee) => sanitizeEmployeeListItem(employee));

        return {
            data: safeEmployees,
            meta: buildPaginationMeta(total, pagination)
        };
    }

    /**
     * Get unique departments
     */
    static async getDepartments(user: AuthenticatedRequest['user']) {
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
        return results.map(r => r.department).filter(Boolean).sort();
    }

    /**
     * Get employee hierarchy
     */
    static async getHierarchy(user: AuthenticatedRequest['user']) {
        const whereClause: any = { active: true };
        if (user.companyId) {
            whereClause.companyId = user.companyId;
        } else if (user.role !== 'admin') {
            throw new AppError('Usuario sin empresa asignada', 403);
        }

        return prisma.employee.findMany({
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
    }

    /**
     * Get employee by ID
     */
    static async getById(user: AuthenticatedRequest['user'], id: string) {
        const employee = await prisma.employee.findUnique({
            where: { id },
            include: {
                manager: { select: { id: true, name: true } },
                emergencyContacts: true
            }
        });

        if (!employee) {
            throw new AppError('Empleado no encontrado', 404);
        }

        if (!canReadEmployeeDetail(user, employee)) {
            throw new AppError('No tienes permiso para ver este perfil', 403);
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
            throw new AppError('Empleado no encontrado', 404);
        }

        const serializedEmployee = sanitizeEmployeeDetail(detailedEmployee, includeSensitiveData);

        return { employee: serializedEmployee, includeSensitiveData };
    }

    /**
     * Create a new employee
     */
    static async create(user: AuthenticatedRequest['user'], body: any) {
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

        // Force companyId. Typed explicitly as `string | undefined` because
        // the `let` re-assignment below would otherwise widen the inferred
        // type to `string | null | undefined` and break the Prisma `data`
        // shape (Prisma's `companyId` field is `string?`, i.e. `undefined`,
        // not `null`).
        let effectiveCompanyId: string | undefined = companyId ?? undefined;

        if (user.companyId) {
            if (companyId && companyId !== user.companyId) {
                throw new AppError('No puedes crear empleados para otra empresa', 403);
            }
            effectiveCompanyId = user.companyId;
        } else if (user.role !== 'admin') {
            throw new AppError('Usuario sin empresa asignada', 403);
        }

        const existingDni = await prisma.employee.findUnique({ where: { dni } });
        if (existingDni) {
            throw new AppError('Ya existe un empleado con ese DNI', 400);
        }

        if (subaccount465) {
            const existingSub = await prisma.employee.findUnique({ where: { subaccount465 } });
            if (existingSub) {
                throw new AppError('Esa subcuenta 465 ya está asignada', 400);
            }
        }

        const employee = await prisma.employee.create({
            data: buildEmployeeCreateData(body, effectiveCompanyId)
        });

        await AuditService.log('CREATE', 'EMPLOYEE', employee.id, { name: employee.name }, user.id, employee.id);
        return employee;
    }

    /**
     * Update an employee
     */
    static async update(user: AuthenticatedRequest['user'], id: string, body: any) {
        const target = await prisma.employee.findUnique({
            where: { id },
            select: { id: true, companyId: true }
        });

        if (!target) {
            throw new AppError('Empleado no encontrado', 404);
        }

        const canCompanyEdit = canManageEmployee(user, target);
        const canSelfEdit = canSelfEditEmployee(user, target);

        if (!canCompanyEdit && !canSelfEdit) {
            throw new AppError('No tienes permiso para editar este empleado', 403);
        }

        if (user.companyId && body.companyId && body.companyId !== user.companyId) {
            throw new AppError('No puedes mover empleados a otra empresa', 403);
        }

        // Validate managerId belongs to same company (if provided and user can edit company)
        if (canCompanyEdit && body.managerId !== undefined && body.managerId) {
            const manager = await prisma.employee.findUnique({
                where: { id: body.managerId },
                select: { id: true, companyId: true }
            });
            if (!manager) {
                throw new AppError('El responsable seleccionado no existe', 400);
            }
            if (target.companyId && manager.companyId !== target.companyId) {
                throw new AppError('El responsable debe pertenecer a la misma empresa', 400);
            }
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
            throw new AppError('No hay cambios validos para aplicar', 400);
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

        return { employee: sanitizeEmployeeDetail(employee, includeSensitiveData), includeSensitiveData };
    }

    /**
     * Bulk update employees
     */
    static async bulkUpdate(user: AuthenticatedRequest['user'], employeeIds: string[], action: string, data?: any) {
        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            throw new AppError('Selecciona al menos un empleado', 400);
        }

        if (employeeIds.length > 100) {
            throw new AppError('Máximo 100 empleados por operación', 400);
        }

        // Verify all employees belong to user's company
        if (user.companyId) {
            const targets = await prisma.employee.findMany({
                where: { id: { in: employeeIds }, companyId: user.companyId },
                select: { id: true }
            });
            if (targets.length !== employeeIds.length) {
                throw new AppError('Permiso denegado: algunos empleados no pertenecen a tu empresa', 403);
            }
        } else if (user.role !== 'admin') {
            throw new AppError('Usuario sin empresa', 403);
        }

        const results = await prisma.$transaction(async (tx) => {
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
                // eslint-disable-next-line no-case-declarations
                case 'change_dept': // eslint-disable-line no-case-declarations
                    if (!data?.department || typeof data.department !== 'string') {
                        throw new Error('Departamento no especificado o formato inválido');
                    }
                    // eslint-disable-next-line no-case-declarations
                    const dept = data.department.trim().substring(0, 100);
                    if (dept.length === 0) {
                        throw new Error('Departamento no puede estar vacío');
                    }
                    updateData = { department: dept };
                    logAction = 'BULK_CHANGE_DEPT';
                    logInfo = `Cambio masivo a ${dept}`;
                    break;
                default:
                    throw new Error('Acción no válida');
            }

            await tx.employee.updateMany({
                where: { id: { in: employeeIds } },
                data: updateData
            });

            for (const empId of employeeIds) {
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
            }

            return employeeIds.length;
        });

        return results;
    }

    /**
     * Soft delete an employee (GDPR-compliant).
     *
     * Marks the row as deleted by setting `deletedAt`, deactivating the
     * account, and recording the actor + reason. The row is excluded
     * from default reads through the Prisma extension `withSoftDelete`
     * (see lib/prisma.ts). Data is physically purged by the
     * `purgeSoftDeletedEmployees` job after the configured retention
     * period (PAYROLL_RETENTION_YEARS, default 4).
     */
    static async delete(user: AuthenticatedRequest['user'], id: string, reason?: string) {
        const employee = await prisma.employee.findUnique({
            where: { id },
            select: { name: true, companyId: true, deletedAt: true }
        });

        if (!employee) {
            throw new AppError('Empleado no encontrado', 404);
        }

        if (user.companyId) {
            if (employee.companyId !== user.companyId) throw new AppError('No autorizado', 403);
        } else if (user.role !== 'admin') {
            throw new AppError('No autorizado', 403);
        }

        if (employee.deletedAt) {
            // Idempotent: already soft-deleted
            return null;
        }

        await prisma.employee.update({
            where: { id },
            data: {
                active: false,
                exitDate: new Date(),
                deletedAt: new Date(),
                deletedById: user.id,
                deletionReason: reason || 'Manual deletion'
            }
        });

        // Disable the linked User account to prevent further logins
        await prisma.user.updateMany({
            where: { employeeId: id },
            data: {
                isActive: false,
                sessionVersion: { increment: 1 }
            }
        });

        await AuditService.log('DELETE', 'EMPLOYEE', id, {
            name: employee.name || 'Desconocido',
            info: 'Soft delete (deactivation)',
            reason: reason || 'Manual deletion'
        }, user.id, id);

        return null;
    }

    /**
     * Get field options for filters
     */
    static async getFieldOptions(user: AuthenticatedRequest['user']) {
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

        return {
            departments,
            categories,
            contractTypes,
            jobTitles,
            companies: isGlobalAdmin ? companies : []
        };
    }

    /**
     * Get portability report
     */
    static async getPortabilityReport(user: AuthenticatedRequest['user'], query: { page?: string; limit?: string }) {
        const isGlobalAdmin = !user.companyId && user.role === 'admin';
        const whereClause: any = { active: true };

        if (!isGlobalAdmin && user.companyId) {
            whereClause.companyId = user.companyId;
        }

        const page = Math.max(1, parseInt(query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 50));
        const skip = (page - 1) * limit;

        const [total, employees, companies, assets, vacations, medicalReviews, trainings, documents, payrollRows] = await Promise.all([
            prisma.employee.count({ where: whereClause }),
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
                },
                skip,
                take: limit,
                orderBy: { name: 'asc' }
            }),
            isGlobalAdmin ? prisma.company.findMany() : Promise.resolve([]),
            prisma.asset.findMany({ where: { employeeId: { not: null } } }),
            prisma.vacation.findMany({ where: { startDate: { gte: new Date(new Date().getFullYear() + '-01-01') } } }),
            prisma.medicalReview.findMany(),
            prisma.training.findMany(),
            prisma.document.findMany(),
            prisma.payrollRow.findMany({ where: { batch: { status: 'OK' } }, include: { batch: true } })
        ]);

        return {
            generatedAt: new Date().toISOString(),
            generatedBy: user.email,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            employees: employees.map(emp => ({
                id: emp.id,
                name: `${emp.firstName} ${emp.lastName}`,
                company: emp.company?.name || 'N/A',
                contractType: emp.contractType,
                entryDate: emp.entryDate,
                active: emp.active
            })),
            summary: {
                totalEmployees: total,
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
    }
}

export class EmployeeMedicalService {
    static async getReviews(user: AuthenticatedRequest['user'], employeeId: string) {
        const whereClause: any = { employeeId };
        if (user.companyId) {
            const target = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } });
            if (!target || target.companyId !== user.companyId) {
                if (user.employeeId !== employeeId) throw new AppError('No autorizado', 403);
            }
        } else if (user.role !== 'admin') {
            throw new AppError('Usuario sin empresa', 403);
        }

        return prisma.medicalReview.findMany({
            where: whereClause,
            orderBy: { date: 'desc' }
        });
    }

    static async createReview(user: AuthenticatedRequest['user'], employeeId: string, data: { date: string; result: string; nextReviewDate?: string }) {
        if (user.role !== 'admin') {
            const target = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } });
            if (!target || target.companyId !== user.companyId) throw new AppError('No autorizado', 403);
        }

        return prisma.medicalReview.create({
            data: {
                employeeId,
                date: new Date(data.date),
                result: data.result,
                nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null
            }
        });
    }

    static async deleteReview(user: AuthenticatedRequest['user'], reviewId: string) {
        if (user.companyId) {
            const review = await prisma.medicalReview.findUnique({ where: { id: reviewId }, include: { employee: true } });
            if (!review || review.employee.companyId !== user.companyId) {
                throw new AppError('No autorizado', 403);
            }
        } else if (user.role !== 'admin') {
            throw new AppError('No autorizado', 403);
        }
        await prisma.medicalReview.delete({ where: { id: reviewId } });
    }
}

export class EmployeeTrainingService {
    static async getTrainings(user: AuthenticatedRequest['user'], employeeId: string) {
        if (user.companyId) {
            const target = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } });
            if (!target || target.companyId !== user.companyId) {
                if (user.employeeId !== employeeId) throw new AppError('No autorizado', 403);
            }
        } else if (user.role !== 'admin') {
            throw new AppError('No autorizado', 403);
        }

        return prisma.training.findMany({
            where: { employeeId },
            orderBy: { date: 'desc' }
        });
    }

    static async createTraining(user: AuthenticatedRequest['user'], employeeId: string, data: { name: string; type: string; date: string; hours?: string }) {
        if (user.companyId) {
            const target = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } });
            if (!target || target.companyId !== user.companyId) throw new AppError('No autorizado', 403);
        } else if (user.role !== 'admin') {
            throw new AppError('No autorizado', 403);
        }

        return prisma.training.create({
            data: {
                employeeId,
                name: data.name,
                type: data.type,
                date: new Date(data.date),
                hours: data.hours ? parseInt(data.hours) : null
            }
        });
    }

    static async deleteTraining(user: AuthenticatedRequest['user'], trainingId: string) {
        if (user.companyId) {
            const training = await prisma.training.findUnique({ where: { id: trainingId }, include: { employee: true } });
            if (!training || training.employee.companyId !== user.companyId) {
                throw new AppError('No autorizado', 403);
            }
        } else if (user.role !== 'admin') {
            throw new AppError('No autorizado', 403);
        }
        await prisma.training.delete({ where: { id: trainingId } });
    }
}

export class EmployeeVacationService {
    static async getBalance(user: AuthenticatedRequest['user'], employeeId: string, year?: number) {
        const targetYear = year || new Date().getFullYear();

        const targetEmployee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, companyId: true }
        });

        if (!targetEmployee) {
            throw new AppError('Empleado no encontrado', 404);
        }

        const isGlobalAdmin = !user.companyId && user.role === 'admin';
        if (!isGlobalAdmin && targetEmployee.companyId !== user.companyId) {
            throw new AppError('No tienes acceso a este empleado', 403);
        }

        const { getEmployeeVacationBalanceSummary } = await import('./VacationBalanceService');
        return getEmployeeVacationBalanceSummary(employeeId, targetYear);
    }

    static async updateBalance(user: AuthenticatedRequest['user'], employeeId: string, data: { year?: number; annualQuotaDays?: number; carriedOverDays?: number; importedUsedDays?: number }) {
        const targetEmployee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, companyId: true, entryDate: true, createdAt: true }
        });

        if (!targetEmployee) {
            throw new AppError('Empleado no encontrado', 404);
        }

        const isGlobalAdmin = !user.companyId && user.role === 'admin';
        if (!isGlobalAdmin && targetEmployee.companyId !== user.companyId) {
            throw new AppError('No tienes acceso a este empleado', 403);
        }

        const { upsertEmployeeVacationBalance, getEmployeeVacationBalanceSummary } = await import('./VacationBalanceService');

        await upsertEmployeeVacationBalance(targetEmployee, data.year || new Date().getFullYear(), {
            annualQuotaDays: data.annualQuotaDays,
            carriedOverDays: data.carriedOverDays,
            importedUsedDays: data.importedUsedDays
        });

        return getEmployeeVacationBalanceSummary(employeeId, data.year || new Date().getFullYear());
    }
}

export class EmployeeNotesService {
    static async getPrivateNotes(user: AuthenticatedRequest['user'], employeeId: string) {
        const targetEmployee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, companyId: true, privateNotes: true }
        });

        if (!targetEmployee) {
            throw new AppError('Empleado no encontrado', 404);
        }

        const isGlobalAdmin = !user.companyId && user.role === 'admin';
        if (!isGlobalAdmin && targetEmployee.companyId !== user.companyId) {
            throw new AppError('No tienes acceso a este empleado', 403);
        }

        return { privateNotes: targetEmployee.privateNotes };
    }

    static async updatePrivateNotes(user: AuthenticatedRequest['user'], employeeId: string, note: string) {
        const targetEmployee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, companyId: true, privateNotes: true }
        });

        if (!targetEmployee) {
            throw new AppError('Empleado no encontrado', 404);
        }

        const isGlobalAdmin = !user.companyId && user.role === 'admin';
        if (!isGlobalAdmin && targetEmployee.companyId !== user.companyId) {
            throw new AppError('No tienes acceso a este empleado', 403);
        }

        const previousNote = targetEmployee.privateNotes;

        const sanitizedNote = sanitizeText(note);

        const updated = await prisma.employee.update({
            where: { id: employeeId },
            data: { privateNotes: sanitizedNote },
            select: { id: true, privateNotes: true }
        });

        await prisma.auditLog.create({
            data: {
                action: 'PRIVATE_NOTE_UPDATE',
                entity: 'EMPLOYEE',
                entityId: employeeId,
                userId: user.id,
                targetEmployeeId: employeeId,
                metadata: JSON.stringify({
                    note,
                    previousNote: previousNote || null
                })
            }
        });

        return { privateNotes: updated.privateNotes };
    }

    static async getPrivateNotesHistory(user: AuthenticatedRequest['user'], employeeId: string) {
        const targetEmployee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, companyId: true }
        });

        if (!targetEmployee) {
            throw new AppError('Empleado no encontrado', 404);
        }

        const isGlobalAdmin = !user.companyId && user.role === 'admin';
        if (!isGlobalAdmin && targetEmployee.companyId !== user.companyId) {
            throw new AppError('No tienes acceso a este empleado', 403);
        }

        const history = await prisma.auditLog.findMany({
            where: {
                entity: 'EMPLOYEE',
                entityId: employeeId,
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

        return history.map(entry => {
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
    }
}
