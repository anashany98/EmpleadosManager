import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { NotificationService } from '../services/NotificationService';
import { AnomalyService } from '../services/AnomalyService';
import { StorageService } from '../services/StorageService';
import { EmailService } from '../services/EmailService';
import { CacheService } from '../services/CacheService';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';
import { AbsenceType } from '@prisma/client';
import { serveLocalUploadFile } from '../utils/fileDownload';
import { canAccessPolicy } from '../../../shared/authz';
import {
    notifyVacationCreated,
    saveVacationAttachment,
    validateVacationRequest,
    validateVacationRequestForUpdate,
    updateVacationStatus,
    transformVacationWithUrl,
    transformVacationListWithUrl
} from '../services/VacationRequestService';
import { getPaginationParams, getPrismaPagination, buildPaginationMeta } from '../utils/pagination';
import fs from 'fs';
import path from 'path';

const log = createLogger('VacationController');

function normalizedAbsenceType(type?: string | null): AbsenceType {
    const aliases: Record<string, AbsenceType> = {
        SICK_LEAVE: AbsenceType.SICK,
        BAJA_MEDICA: AbsenceType.SICK,
        MATERNIDAD: AbsenceType.MATERNITY,
        PATERNIDAD: AbsenceType.PATERNITY,
        LACTANCIA: AbsenceType.LACTATION,
        MEDICAL_HOURS: AbsenceType.MEDICAL_APPOINTMENT,
        PERSONAL: AbsenceType.OTHER,
        PERSONAL_DAY: AbsenceType.OTHER,
        OTROS: AbsenceType.OTHER,
        TELETRABAJO: AbsenceType.OTHER,
        PERMISO_SINDICAL: AbsenceType.OTHER,
        BIRTH: AbsenceType.OTHER
    };
    if (!type) return AbsenceType.VACATION;
    return aliases[type] || (Object.values(AbsenceType).includes(type as AbsenceType) ? type as AbsenceType : AbsenceType.OTHER);
}

function invalidateVacationBalanceCache(employeeId: string, year: number): void {
    // Invalidate current year and adjacent years (for carried-over balances)
    const yearsToInvalidate = [year - 1, year, year + 1];
    
    for (const y of yearsToInvalidate) {
        const cacheKey = `vacation:balance:${employeeId}:${y}`;
        CacheService.del(cacheKey);
        log.info({ cacheKey }, 'Vacation balance cache invalidated');
    }
}

export const VacationController = {
    // Obtener todas las vacaciones (Global)
    getAll: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            if (!user || !canAccessPolicy('vacation.manage', user, { companyId: user.companyId })) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }
            const where: any = {};
            if (user.companyId) {
                where.employee = { companyId: user.companyId };
            }

            const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
            if (startDate) {
                where.startDate = { ...where.startDate, gte: new Date(startDate) };
            }
            if (endDate) {
                where.endDate = { ...where.endDate, lte: new Date(endDate) };
            }

            const pagination = getPaginationParams(req);
            const prismaPagination = getPrismaPagination(pagination);

            const [total, vacations] = await Promise.all([
                prisma.vacation.count({ where }),
                prisma.vacation.findMany({
                    where,
                    include: { employee: true },
                    orderBy: { startDate: 'desc' },
                    ...prismaPagination
                })
            ]);

            const vacationsWithUrl = await transformVacationListWithUrl(vacations);

            if (pagination.isPaginationRequested) {
                return ApiResponse.paginated(res, vacationsWithUrl, buildPaginationMeta(total, pagination));
            }

            return ApiResponse.success(res, vacationsWithUrl);
        } catch {
            throw new AppError('Error al obtener vacaciones', 500);
        }
    },

    // Obtener vacaciones de un empleado
    getByEmployee: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        try {
            const { user } = req as AuthenticatedRequest;
            if (!user) return ApiResponse.error(res, 'No autorizado', 403);

            const target = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { id: true, companyId: true }
            });

            if (!target) {
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            if (!canAccessPolicy('vacation.read', user, { employeeId, companyId: target.companyId })) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }

            const pagination = getPaginationParams(req);
            const prismaPagination = getPrismaPagination(pagination);
            const where = { employeeId };

            const [total, vacations] = await Promise.all([
                prisma.vacation.count({ where }),
                prisma.vacation.findMany({
                    where,
                    orderBy: { startDate: 'desc' },
                    ...prismaPagination
                })
            ]);

            const vacationsWithUrl = await transformVacationListWithUrl(vacations);

            if (pagination.isPaginationRequested) {
                return ApiResponse.paginated(res, vacationsWithUrl, buildPaginationMeta(total, pagination));
            }

            return ApiResponse.success(res, vacationsWithUrl);
        } catch {
            return ApiResponse.error(res, 'Error al obtener vacaciones', 500);
        }
    },

    // Crear vacaciones
    create: async (req: Request, res: Response) => {
        try {
            const { employeeId: bodyEmployeeId, startDate, endDate, type, reason, notes } = req.body as { employeeId?: string; startDate: string; endDate: string; type?: string; reason?: string; notes?: string };
            let employeeId = bodyEmployeeId || (req as AuthenticatedRequest).user?.employeeId;
            const { user } = req as AuthenticatedRequest;

            log.info({ body: req.body, employeeId, startDate, endDate, type, userId: user?.id }, 'VacationController.create called');

            if (!employeeId && user?.employeeId) {
                employeeId = user.employeeId;
            }

            if (!employeeId || !startDate || !endDate) {
                return ApiResponse.error(res, 'Faltan campos requeridos (employeeId, startDate, endDate)', 400);
            }

            const targetEmployee = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { id: true, companyId: true }
            });

            if (!targetEmployee) {
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            if (!canAccessPolicy('vacation.write', user, { employeeId, companyId: targetEmployee.companyId })) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }

            const start = new Date(startDate);
            const end = new Date(endDate);
            const selectedType = type || 'VACATION';
            const typeConfig = await prisma.absenceTypeConfig.findUnique({ where: { code: selectedType } });
            if (!typeConfig?.isActive) {
                return ApiResponse.error(res, 'El tipo de ausencia seleccionado no existe o está desactivado', 400);
            }
            if (typeConfig.requiresAttachment && !req.file) {
                return ApiResponse.error(res, 'Este tipo de ausencia requiere un documento adjunto', 422);
            }
            const canManage = canAccessPolicy('vacation.manage', user, { employeeId, companyId: targetEmployee.companyId });
            const requestedStatus = (req.body as any).status;
            const vacationStatus = requestedStatus === 'APPROVED' && canManage
                ? 'APPROVED'
                : typeConfig.requiresApproval
                    ? 'PENDING'
                    : 'APPROVED';

            const vacation = await prisma.$transaction(async (tx) => {
                const { requestedDays } = await validateVacationRequest(
                    employeeId,
                    start,
                    end,
                    selectedType,
                    tx,
                    typeConfig,
                    targetEmployee.companyId || undefined
                );
                const fileUrl = await saveVacationAttachment(employeeId, req.file);

                return tx.vacation.create({
                    data: {
                        employeeId,
                        startDate: start,
                        endDate: end,
                        type: selectedType,
                        absenceType: normalizedAbsenceType(selectedType),
                        days: requestedDays,
                        reason: reason || notes || null,
                        fileUrl,
                        status: vacationStatus
                    },
                    include: { employee: true }
                });
            });

            AnomalyService.detectVacation(vacation as any).catch(err => log.error({ err }, 'Anomaly detection failed'));

            const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
            notifyVacationCreated(vacation, FRONTEND_URL).catch(err => log.error({ err }, 'Vacation notification failed'));

            invalidateVacationBalanceCache(vacation.employeeId, new Date(vacation.startDate).getFullYear());

            const vacationWithUrl = await transformVacationWithUrl(vacation);
            return ApiResponse.success(res, vacationWithUrl, 'Solicitud de vacaciones creada', 201);
        } catch (error: any) {
            if (error instanceof AppError) {
                return ApiResponse.error(res, error.message, error.statusCode || 400);
            }
            log.error({ error }, 'Error creating vacation');
            return ApiResponse.error(res, 'Error al crear vacaciones', 500);
        }
    },

    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const current = await prisma.vacation.findUnique({
                where: { id },
                include: { employee: { select: { companyId: true } } }
            });
            if (!current) return ApiResponse.error(res, 'Ausencia no encontrada', 404);

            const start = req.body.startDate ? new Date(req.body.startDate) : current.startDate;
            const end = req.body.endDate ? new Date(req.body.endDate) : current.endDate;
            const type = req.body.type || current.type;
            const typeConfig = await prisma.absenceTypeConfig.findUnique({ where: { code: type } });
            if (!typeConfig?.isActive) {
                return ApiResponse.error(res, 'El tipo de ausencia seleccionado no existe o está desactivado', 400);
            }
            if (typeConfig.requiresAttachment && !req.file && !current.fileUrl) {
                return ApiResponse.error(res, 'Este tipo de ausencia requiere un documento adjunto', 422);
            }
            const reason = req.body.reason !== undefined
                ? req.body.reason
                : req.body.notes !== undefined
                    ? req.body.notes
                    : current.reason;

            const updated = await prisma.$transaction(async (tx) => {
                if (current.status === 'APPROVED' || current.status === 'EXISTING') {
                    const overlap = await tx.vacation.findFirst({
                        where: {
                            id: { not: id },
                            employeeId: current.employeeId,
                            status: { in: ['APPROVED', 'EXISTING'] },
                            startDate: { lte: end },
                            endDate: { gte: start }
                        }
                    });
                    if (overlap) throw new AppError('La modificación se solapa con otra ausencia aprobada.', 409);
                }

                const { requestedDays } = await validateVacationRequestForUpdate(
                    current.employeeId,
                    start,
                    end,
                    type,
                    id,
                    tx,
                    typeConfig,
                    current.employee.companyId || undefined
                );
                const replacementFileUrl = req.file
                    ? await saveVacationAttachment(current.employeeId, req.file)
                    : current.fileUrl;
                const result = await tx.vacation.update({
                    where: { id },
                    data: {
                        startDate: start,
                        endDate: end,
                        type,
                        absenceType: normalizedAbsenceType(type),
                        reason: reason || null,
                        days: requestedDays,
                        fileUrl: replacementFileUrl
                    },
                    include: { employee: true }
                });
                await tx.auditLog.create({
                    data: {
                        action: 'UPDATE_ABSENCE',
                        entity: 'VACATION',
                        entityId: id,
                        userId: (req as AuthenticatedRequest).user?.id,
                        targetEmployeeId: current.employeeId,
                        metadata: JSON.stringify({
                            previous: { startDate: current.startDate, endDate: current.endDate, type: current.type, reason: current.reason },
                            next: { startDate: start, endDate: end, type, reason }
                        })
                    }
                });
                return result;
            });

            invalidateVacationBalanceCache(current.employeeId, current.startDate.getFullYear());
            invalidateVacationBalanceCache(current.employeeId, start.getFullYear());
            return ApiResponse.success(res, await transformVacationWithUrl(updated), 'Ausencia actualizada');
        } catch (error: any) {
            if (error instanceof AppError) return ApiResponse.error(res, error.message, error.statusCode || 400);
            log.error({ error }, 'Error updating absence');
            return ApiResponse.error(res, 'Error al actualizar la ausencia', 500);
        }
    },

    // Eliminar
    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const { user } = req as AuthenticatedRequest;
            const vacation = await prisma.vacation.findUnique({
                where: { id },
                include: { employee: { select: { companyId: true } } }
            });
            if (!vacation) return ApiResponse.error(res, 'No encontrado', 404);
            if (!canAccessPolicy('vacation.write', user, { employeeId: vacation.employeeId, companyId: vacation.employee?.companyId })) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }

            const employeeId = vacation.employeeId;
            const year = new Date(vacation.startDate).getFullYear();
            await prisma.vacation.delete({ where: { id } });

            invalidateVacationBalanceCache(employeeId, year);

            return ApiResponse.success(res, null, 'Vacaciones eliminadas');
        } catch {
            return ApiResponse.error(res, 'Error al eliminar', 500);
        }
    },

    updateStatus: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { status, rejectionReason, managerComment } = req.body as { status: string; rejectionReason?: string; managerComment?: string };

        if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
            throw new AppError('Estado no válido', 400);
        }

        if (status === 'REJECTED' && !rejectionReason) {
            throw new AppError('El motivo de rechazo es requerido', 400);
        }

        try {
            const { user } = req as AuthenticatedRequest;
            const vacationRecord = await prisma.vacation.findUnique({
                where: { id },
                include: { employee: true }
            });
            if (!vacationRecord) throw new AppError('Solicitud no encontrada', 404);

            if (!canAccessPolicy('vacation.manage', user, { employeeId: vacationRecord.employeeId, companyId: vacationRecord.employee.companyId })) {
                throw new AppError('No autorizado', 403);
            }

            const approvedBy = (status === 'APPROVED' || status === 'REJECTED') ? user.id : undefined;
            const vacation = await updateVacationStatus(id, status, rejectionReason, managerComment, approvedBy);

            if (!vacation) {
                throw new AppError('Solicitud no encontrada tras la actualización', 404);
            }

            // NOTIFY EMPLOYEE
            const vacationEmployee = vacation.employee;
            if (vacationEmployee?.email) {
                const employee = vacationEmployee;
                const targetUser = await prisma.user.findFirst({ where: { email: employee.email! } });
                const statusText = status === 'APPROVED' ? 'APROBADA' : 'RECHAZADA';
                const typeText = status === 'APPROVED' ? 'SUCCESS' : 'ERROR';

                if (targetUser) {
                    await NotificationService.create({
                        userId: targetUser.id,
                        title: `Solicitud de Vacaciones ${statusText}`,
                        message: `Tu solicitud ha sido ${statusText.toLowerCase()}.`,
                        type: typeText,
                        link: '/vacations'
                    });
                }

                // Send Email Notification
                const subject = `Solicitud de Vacaciones ${statusText}`;
                const html = `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h2>Estado de Vacaciones: ${statusText}</h2>
                        <p>Hola ${employee.name},</p>
                        <p>Tu solicitud de vacaciones del <b>${vacation.startDate.toLocaleDateString()}</b> al <b>${vacation.endDate.toLocaleDateString()}</b> ha sido <b>${statusText.toLowerCase()}</b>.</p>
                        <p>Días totales: ${vacation.days}</p>
                        ${vacation.status === 'REJECTED' ? '<p>Si tienes alguna duda, contacta con tu responsable.</p>' : ''}
                        <br/>
                        <p>Saludos,<br/>Recursos Humanos</p>
                    </div>
                `;

                EmailService.sendMail(employee.email!, subject, html).catch(err => {
                    log.error({ err }, 'Error sending vacation status email');
                });
            }

            invalidateVacationBalanceCache(vacation.employeeId, new Date(vacation.startDate).getFullYear());
            const vacationWithUrl = await transformVacationWithUrl(vacation);
            return ApiResponse.success(res, vacationWithUrl, 'Estado de vacaciones actualizado');
        } catch {
            throw new AppError('Error al actualizar el estado de las vacaciones', 500);
        }
    },

    // Obtener mis vacaciones (basado en el usuario logueado)
    getMyVacations: async (req: Request, res: Response) => {
        const { user } = req as AuthenticatedRequest;
        if (!user || !user.employeeId) return ApiResponse.error(res, "Usuario no identificado", 401);

        try {
            const vacations = await prisma.vacation.findMany({
                where: { employeeId: user.employeeId },
                orderBy: { startDate: 'desc' },
                include: { employee: true }
            });

            const vacationsWithUrl = await transformVacationListWithUrl(vacations);
            return ApiResponse.success(res, vacationsWithUrl);
        } catch (error: any) {
            log.error({ error }, 'Error getting my vacations');
            return ApiResponse.error(res, 'Error al obtener mis vacaciones', 500);
        }
    },

    // Obtener vacaciones para aprobar (Jefes o Admins)
    getManageableVacations: async (req: Request, res: Response) => {
        const { user } = req as AuthenticatedRequest;
        if (!user) return ApiResponse.error(res, "Usuario no identificado", 401);

        try {
            if (!canAccessPolicy('vacation.manage', user, { companyId: user.companyId })) {
                return ApiResponse.success(res, []);
            }

            const manageableVacations = await prisma.vacation.findMany({
                where: {
                    status: 'PENDING',
                    ...(user.companyId ? { employee: { companyId: user.companyId } } : {})
                },
                include: { employee: true },
                orderBy: { startDate: 'asc' }
            });

            const vacationsWithUrl = await transformVacationListWithUrl(manageableVacations);
            return ApiResponse.success(res, vacationsWithUrl);
        } catch (error: any) {
            log.error({ error }, 'Error getting pending vacations');
            return ApiResponse.error(res, 'Error al obtener solicitudes pendientes', 500);
        }
    },

    downloadAttachment: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { user } = req as AuthenticatedRequest;

        try {
            const vacation = await prisma.vacation.findUnique({
                where: { id },
                include: { employee: true }
            }) as any;

            if (!vacation || !vacation.fileUrl) throw new AppError('Adjunto no encontrado', 404);

            if (!canAccessPolicy('vacation.read', user, { employeeId: vacation.employeeId, companyId: vacation.employee?.companyId })) {
                throw new AppError('No tiene permisos para descargar este archivo', 403);
            }

            if (StorageService.provider === 'local') {
                // MED-007/barrido: helper compartido que valida
                // contención de path, sanitiza el nombre de
                // descarga y maneja errores de stream.
                return serveLocalUploadFile(res, vacation.fileUrl);
            }

            const signedUrl = await StorageService.getSignedDownloadUrl(vacation.fileUrl);
            if (!signedUrl) throw new AppError('No se pudo generar URL de descarga', 500);
            return res.redirect(signedUrl);
        } catch (error: any) {
            if (error instanceof AppError) throw error;
            log.error({ error }, 'Download error');
            throw new AppError('Error al descargar el archivo', 500);
        }
    }
};
