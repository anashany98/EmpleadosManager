import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { HolidayService } from '../services/HolidayService';
import { NotificationService } from '../services/NotificationService';
import { AnomalyService } from '../services/AnomalyService';
import { StorageService } from '../services/StorageService';
import { EmailService } from '../services/EmailService';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';

const log = createLogger('VacationController');

export const VacationController = {
    // Obtener todas las vacaciones (Global)
    getAll: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            if (!user || user.role !== 'admin') {
                return ApiResponse.error(res, 'No autorizado', 403);
            }
            const vacations = await prisma.vacation.findMany({
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

            const isSelf = user.employeeId && user.employeeId === employeeId;
            const isAdmin = user.role === 'admin';
            let isManager = false;
            if (!isAdmin && !isSelf && user.employeeId) {
                const target = await prisma.employee.findUnique({
                    where: { id: employeeId },
                    select: { managerId: true }
                });
                isManager = !!target && target.managerId === user.employeeId;
            }

            if (!isAdmin && !isSelf && !isManager) {
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

            // Si no viene employeeId, intentamos deducirlo del usuario logueado
            if (!employeeId && user && user.email) {
                const employee = await prisma.employee.findFirst({
                    where: { email: user.email }
                });
                if (employee) {
                    employeeId = employee.id;
                }
            }

            if (!employeeId || !startDate || !endDate) {
                return res.status(400).json({ error: 'Faltan campos requeridos (employeeId, startDate, endDate)' });
            }

            // Access control: admin, self, or manager of employee
            const isSelf = user?.employeeId && user.employeeId === employeeId;
            const isAdmin = user?.role === 'admin';
            let isManager = false;
            if (!isAdmin && !isSelf && user?.employeeId) {
                const target = await prisma.employee.findUnique({
                    where: { id: employeeId },
                    select: { managerId: true }
                });
                isManager = !!target && target.managerId === user.employeeId;
            }
            if (!isAdmin && !isSelf && !isManager) {
                return res.status(403).json({ error: 'No autorizado' });
            }

            const start = new Date(startDate);
            const end = new Date(endDate);

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

            const vacation = await prisma.vacation.create({
                data: {
                    employeeId,
                    startDate: start,
                    endDate: end,
                    type: type || 'VACATION',
                    days: diffDays,
                    reason: reason || null,
                    fileUrl,
                    status: 'PENDING'
                } as any,
                include: { employee: true } // Include employee for name in notification
            });

            AnomalyService.detectVacation(vacation as any).catch(err => log.error({ err }, 'Anomaly detection failed'));

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

            res.json(vacation);
        } catch (error) {
            log.error({ error }, 'Error creating vacation');
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Eliminar
    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const { user } = req as AuthenticatedRequest;
            const vacation = await prisma.vacation.findUnique({ where: { id } });
            if (!vacation) return res.status(404).json({ error: 'No encontrado' });
            const isAdmin = user?.role === 'admin';
            const isOwner = user?.employeeId && user.employeeId === vacation.employeeId;
            if (!isAdmin && !isOwner) {
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
                select: { employeeId: true }
            });
            if (!vacationRecord) throw new AppError('Solicitud no encontrada', 404);

            const isAdmin = user?.role === 'admin';
            let isManager = false;
            if (!isAdmin && user?.employeeId) {
                const target = await prisma.employee.findUnique({
                    where: { id: vacationRecord.employeeId },
                    select: { managerId: true }
                });
                isManager = !!target && target.managerId === user.employeeId;
            }
            if (!isAdmin && !isManager) {
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
        if (!user || !user.email) return ApiResponse.error(res, "Usuario no identificado", 401);

        try {
            // Buscar empleado asociado al email del usuario
            const employee = await prisma.employee.findFirst({
                where: { email: user.email }
            });

            if (!employee) {
                return ApiResponse.success(res, []); // No es empleado, no tiene vacaciones
            }

            const vacations = await prisma.vacation.findMany({
                where: { employeeId: employee.id },
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
        if (!user || !user.email) return ApiResponse.error(res, "Usuario no identificado", 401);

        try {
            let whereClause: any = { status: 'PENDING' };

            // Si no es admin, filtramos por subordinados
            if (user.role !== 'admin') {
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

            // Security Check: Admin, Manager of the employee, or Owner
            const isOwner = user.employeeId === vacation.employeeId;
            const isAdmin = user.role === 'admin';
            let isManager = false;

            if (!isAdmin && !isOwner) {
                // Fetch employee to check managerId if not admin/owner
                const target = await prisma.employee.findUnique({
                    where: { id: vacation.employeeId },
                    select: { managerId: true }
                });
                isManager = !!target && !!user.employeeId && target.managerId === user.employeeId;
            }

            if (!isAdmin && !isOwner && !isManager) {
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
