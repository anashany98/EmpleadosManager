import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { HolidayService } from './HolidayService';
import { StorageService } from './StorageService';
import { NotificationService } from './NotificationService';
import { EmailService } from './EmailService';

export async function validateVacationRequest(employeeId: string, start: Date, end: Date, type?: string) {
    const overlapping = await prisma.vacation.findFirst({
        where: {
            employeeId,
            OR: [{ startDate: { lte: end }, endDate: { gte: start } }]
        }
    });

    if (overlapping) {
        throw new AppError('Ya existe un registro de ausencia que se solapa con estas fechas.', 400);
    }

    const requestedDays = HolidayService.getBusinessDaysCount(start, end);

    if (type !== 'VACATION' && type) {
        return { requestedDays };
    }

    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { vacations: true }
    });

    if (!employee) {
        throw new AppError('Empleado no encontrado', 404);
    }

    const currentYear = start.getFullYear();
    const usedDays = employee.vacations.reduce((accumulator: number, vacation: any) => {
        const vacationStart = new Date(vacation.startDate);
        const vacationEnd = new Date(vacation.endDate);
        if ((vacation.type === 'VACATION' || !vacation.type) && vacationStart.getFullYear() === currentYear && vacation.status !== 'REJECTED') {
            return accumulator + HolidayService.getBusinessDaysCount(vacationStart, vacationEnd);
        }
        return accumulator;
    }, 0);

    const quota = employee.vacationDaysTotal || 30;
    if (usedDays + requestedDays > quota) {
        throw new AppError(`Excede cupo. Disponibles: ${quota - usedDays}, Solicitados: ${requestedDays}.`, 400);
    }

    return { requestedDays };
}

export async function saveVacationAttachment(employeeId: string, file?: Express.Multer.File | undefined) {
    if (!file) {
        return null;
    }

    const safeEmployeeId = employeeId.replace(/[^a-zA-Z0-9-]/g, '');
    const { key } = await StorageService.saveBuffer({
        folder: `vacations/${safeEmployeeId}`,
        originalName: file.originalname,
        buffer: file.buffer,
        contentType: file.mimetype
    });

    return key;
}

export async function notifyVacationCreated(vacation: any, frontendUrl: string) {
    const employeeName = vacation.employee?.name || 'Un empleado';
    await NotificationService.notifyAdmins(
        'Nueva Solicitud de Vacaciones',
        `${employeeName} ha solicitado ${vacation.days} días de ${vacation.type || 'vacaciones'}.`,
        '/vacations'
    );

    if (!vacation.employee?.managerId) {
        return;
    }

    const manager = await prisma.employee.findUnique({
        where: { id: vacation.employee.managerId },
        select: { email: true, name: true }
    });

    if (!manager?.email) {
        return;
    }

    const subject = `Nueva Solicitud de Vacaciones: ${employeeName}`;
    const html = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2>Nueva Solicitud de Vacaciones</h2>
            <p>Hola ${manager.name},</p>
            <p><b>${employeeName}</b> ha solicitado vacaciones del <b>${vacation.startDate.toLocaleDateString()}</b> al <b>${vacation.endDate.toLocaleDateString()}</b>.</p>
            <p>Días: ${vacation.days}</p>
            <p>Motivo: ${vacation.reason || 'Sin motivo especificado'}</p>
            <br/>
            <a href="${frontendUrl}/vacations" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Revisar Solicitud</a>
        </div>
    `;

    EmailService.sendMail(manager.email, subject, html).catch(() => undefined);
}
