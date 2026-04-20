import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { NotificationService } from '../services/NotificationService';
import { AnomalyService } from '../services/AnomalyService';
import { StorageService } from '../services/StorageService';
import { EmailService } from '../services/EmailService';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';
import { canAccessPolicy } from '../../../shared/authz';
import {
    notifyVacationCreated,
    saveVacationAttachment,
    validateVacationRequest
} from '../services/VacationRequestService';
import { getPaginationParams, getPrismaPagination, buildPaginationMeta } from '../utils/pagination';

const log = createLogger('VacationController');

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

            if (pagination.isPaginationRequested) {
                return ApiResponse.success(res, {
                    data: vacations,
                    meta: buildPaginationMeta(total, pagination)
                });
            }

            return ApiResponse.success(res, vacations);
        } catch (error) {
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

            if (pagination.isPaginationRequested) {
                return ApiResponse.success(res, {
                    data: vacations,
                    meta: buildPaginationMeta(total, pagination)
                });
            }

            return ApiResponse.success(res, vacations);
        } catch (error) {
            return ApiResponse.error(res, 'Error al obtener vacaciones', 500);
        }
    },

    // Crear vacaciones
    create: async (req: Request, res: Response) => {
        try {
            let { employeeId, startDate, endDate, type, reason } = req.body;
            const { user } = req as AuthenticatedRequest;

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

            const vacation = await prisma.$transaction(async (tx) => {
                const { requestedDays } = await validateVacationRequest(employeeId, start, end, type, tx);
                const fileUrl = await saveVacationAttachment(employeeId, req.file);

                return tx.vacation.create({
                    data: {
                        employeeId,
                        startDate: start,
                        endDate: end,
                        type: type || 'VACATION',
                        days: requestedDays,
                        reason: reason || null,
                        fileUrl,
                        status: 'PENDING'
                    },
                    include: { employee: true }
                });
            });

            AnomalyService.detectVacation(vacation as any).catch(err => log.error({ err }, 'Anomaly detection failed'));
            const FRONTEND_URL = process.env.FRONTEND_URL;
            if (!FRONTEND_URL) {
                throw new AppError('FRONTEND_URL no configurado', 500);
            }
            await notifyVacationCreated(vacation, FRONTEND_URL);

            return ApiResponse.success(res, vacation, 'Solicitud de vacaciones creada', 201);
        } catch (error) {
            if (error instanceof AppError) {
                return ApiResponse.error(res, error.message, error.statusCode || 400);
            }
            log.error({ error }, 'Error creating vacation');
            return ApiResponse.error(res, 'Error al crear vacaciones', 500);
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

            await prisma.vacation.delete({ where: { id } });

            return ApiResponse.success(res, null, 'Vacaciones eliminadas');
        } catch (error) {
            return ApiResponse.error(res, 'Error al eliminar', 500);
        }
    },

    updateStatus: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { status } = req.body; // PENDING, APPROVED, REJECTED

        if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
            throw new AppError('Estado no válido', 400);
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

            const vacation = await prisma.vacation.update({
                where: { id },
                data: { status },
                include: { employee: true }
            });

            // NOTIFY EMPLOYEE
            if (vacation.employee?.email) {
                const targetUser = await prisma.user.findFirst({ where: { email: vacation.employee.email } });
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
                        <p>Hola ${vacation.employee.name},</p>
                        <p>Tu solicitud de vacaciones del <b>${vacation.startDate.toLocaleDateString()}</b> al <b>${vacation.endDate.toLocaleDateString()}</b> ha sido <b>${statusText.toLowerCase()}</b>.</p>
                        <p>Días totales: ${vacation.days}</p>
                        ${vacation.status === 'REJECTED' ? '<p>Si tienes alguna duda, contacta con tu responsable.</p>' : ''}
                        <br/>
                        <p>Saludos,<br/>Recursos Humanos</p>
                    </div>
                `;

                EmailService.sendMail(vacation.employee.email, subject, html).catch(err => {
                    log.error({ err }, 'Error sending vacation status email');
                });
            }
            return ApiResponse.success(res, vacation, 'Estado de vacaciones actualizado');
        } catch (error) {
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

            return ApiResponse.success(res, vacations);
        } catch (error) {
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

            return ApiResponse.success(res, manageableVacations);
        } catch (error) {
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
                const fs = require('fs');
                const path = require('path');
                const filePath = path.join(process.cwd(), 'uploads', vacation.fileUrl);
                if (!fs.existsSync(filePath)) {
                    throw new AppError('El archivo físico no existe', 404);
                }
                return res.download(filePath);
            }

            const signedUrl = await StorageService.getSignedDownloadUrl(vacation.fileUrl);
            if (!signedUrl) throw new AppError('No se pudo generar URL de descarga', 500);
            return res.redirect(signedUrl);
        } catch (error) {
            if (error instanceof AppError) throw error;
            log.error({ error }, 'Download error');
            throw new AppError('Error al descargar el archivo', 500);
        }
    }
};
