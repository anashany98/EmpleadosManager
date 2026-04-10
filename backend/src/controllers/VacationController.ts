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

            const vacations = await prisma.vacation.findMany({
                where,
                include: { employee: true },
                orderBy: { startDate: 'desc' }
            });
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

            const vacations = await prisma.vacation.findMany({
                where: { employeeId },
                orderBy: { startDate: 'desc' }
            });
            res.json(vacations);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener vacaciones' });
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
                return res.status(400).json({ error: 'Faltan campos requeridos (employeeId, startDate, endDate)' });
            }

            const targetEmployee = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { id: true, companyId: true }
            });

            if (!targetEmployee) {
                return res.status(404).json({ error: 'Empleado no encontrado' });
            }

            if (!canAccessPolicy('vacation.write', user, { employeeId, companyId: targetEmployee.companyId })) {
                return res.status(403).json({ error: 'No autorizado' });
            }

            const start = new Date(startDate);
            const end = new Date(endDate);
            const { requestedDays } = await validateVacationRequest(employeeId, start, end, type);
            const fileUrl = await saveVacationAttachment(employeeId, req.file);

            /* Legacy validation and attachment handling replaced by VacationRequestService
            // 1. Control de Solapamientos
            const overlapping = await prisma.vacation.findFirst({
                where: {
                    employeeId,
                    OR: [
                        { startDate: { lte: end }, endDate: { gte: start } }
                    ]
                }
            });

            if (overlapping) {
                return res.status(400).json({
                    error: 'Ya existe un registro de ausencia que se solapa con estas fechas.'
                });
            }

            // 2. Cálculo de Días Real (Restando Fines de Semana y FESTIVOS)
            const diffDays = HolidayService.getBusinessDaysCount(start, end);

            // Validar cupo solo para vacaciones
            if (type === 'VACATION' || !type) {
                const employee = await prisma.employee.findUnique({
                    where: { id: employeeId },
                    include: { vacations: true }
                });

                if (!employee) return res.status(404).json({ error: 'Empleado no encontrado' });

                const currentYear = start.getFullYear();
                const usedDays = employee.vacations.reduce((acc: number, v: any) => {
                    const vStart = new Date(v.startDate);
                    const vEnd = new Date(v.endDate);
                    if ((v.type === 'VACATION' || !v.type) && vStart.getFullYear() === currentYear && v.status !== 'REJECTED') {
                        // Nota: Excluimos REJECTED del conteo
                        return acc + HolidayService.getBusinessDaysCount(vStart, vEnd);
                    }
                    return acc;
                }, 0);

                const quota = employee.vacationDaysTotal || 30;
                if (usedDays + diffDays > quota) {
                    return res.status(400).json({
                        error: `Excede cupo. Disponibles: ${quota - usedDays}, Solicitados: ${diffDays}.`,
                        insufficientDays: true
                    });
                }
            }

            let fileUrl = null;
            if (req.file) {
                const safeEmployeeId = employeeId.replace(/[^a-zA-Z0-9-]/g, '');
                const { key } = await StorageService.saveBuffer({
                    folder: `vacations/${safeEmployeeId}`,
                    originalName: req.file.originalname,
                    buffer: req.file.buffer,
                    contentType: req.file.mimetype
                });
                fileUrl = key;
            }
            */

            const vacation = await prisma.vacation.create({
                data: {
                    employeeId,
                    startDate: start,
                    endDate: end,
                    type: type || 'VACATION',
                    days: requestedDays,
                    reason: reason || null,
                    fileUrl,
                    status: 'PENDING'
                } as any,
                include: { employee: true } // Include employee for name in notification
            });

            AnomalyService.detectVacation(vacation as any).catch(err => log.error({ err }, 'Anomaly detection failed'));
            await notifyVacationCreated(vacation, process.env.FRONTEND_URL || 'http://localhost:5173');

            /* Legacy notification flow replaced by VacationRequestService
            // NOTIFY ADMINS
            const empName = (vacation as any).employee?.name || 'Un empleado';
            await NotificationService.notifyAdmins(
                'Nueva Solicitud de Vacaciones',
                `${empName} ha solicitado ${diffDays} días de ${type || 'vacaciones'}.`,
                '/vacations'
            );

            // Notify Manager via Email
            if ((vacation as any).employee?.managerId) {
                const manager = await prisma.employee.findUnique({
                    where: { id: (vacation as any).employee.managerId },
                    select: { email: true, name: true }
                });

                if (manager?.email) {
                    const subject = `Nueva Solicitud de Vacaciones: ${empName}`;
                    const html = `
                        <div style="font-family: sans-serif; padding: 20px;">
                            <h2>Nueva Solicitud de Vacaciones</h2>
                            <p>Hola ${manager.name},</p>
                            <p><b>${empName}</b> ha solicitado vacaciones del <b>${vacation.startDate.toLocaleDateString()}</b> al <b>${vacation.endDate.toLocaleDateString()}</b>.</p>
                            <p>Días: ${vacation.days}</p>
                            <p>Motivo: ${vacation.reason || 'Sin motivo especificado'}</p>
                            <br/>
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/vacations" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Revisar Solicitud</a>
                        </div>
                    `;
                    EmailService.sendMail(manager.email, subject, html).catch(err => {
                        log.error({ err }, 'Error sending manager notification email');
                    });
                }
            }
            */

            res.json(vacation);
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode || 400).json({
                    error: error.message,
                    insufficientDays: error.message.includes('Excede cupo')
                });
            }
            log.error({ error }, 'Error creating vacation');
            res.status(500).json({ error: 'Internal server error' });
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
            if (!vacation) return res.status(404).json({ error: 'No encontrado' });
            if (!canAccessPolicy('vacation.write', user, { employeeId: vacation.employeeId, companyId: vacation.employee?.companyId })) {
                return res.status(403).json({ error: 'No autorizado' });
            }

            await prisma.vacation.delete({ where: { id } });
            res.json({ message: 'Vacaciones eliminadas' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar' });
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
            /* Legacy subordinate-based flow intentionally removed after policy unification.
            const whereClause: any = {};

            // Si es admin, filtramos por su compañia
            if (user.role === 'admin') {
                if (user.companyId) {
                    whereClause.employee = { companyId: user.companyId };
                }
            } else {
                // Si no es admin, filtramos por subordinados
                const me = await prisma.employee.findFirst({ where: { email: user.email } });

                if (!me) {
                    // Si no es empleado y no es admin, no puede aprobar nada
                    return ApiResponse.success(res, []);
                }

                // Buscar empleados que reportan a este usuario
                const subordinates = await prisma.employee.findMany({
                    where: { managerId: me.id },
                    select: { id: true }
                });

                if (subordinates.length === 0) {
                    return ApiResponse.success(res, []);
                }

                whereClause.employeeId = { in: subordinates.map(s => s.id) };
            }

            const vacations = await prisma.vacation.findMany({
                where: whereClause,
                include: { employee: true },
                orderBy: { startDate: 'asc' }
            });

            return ApiResponse.success(res, vacations);
            */
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
