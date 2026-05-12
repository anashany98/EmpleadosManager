import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { StorageService } from './StorageService';
import { NotificationService } from './NotificationService';
import { EmailService } from './EmailService';
import {
    calculateVacationRequestDays,
    getEmployeeVacationBalanceSummary,
    isVacationType
} from './VacationBalanceService';

export async function validateVacationRequest(employeeId: string, start: Date, end: Date, type?: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
        throw new AppError('La fecha de inicio no puede ser anterior a hoy.', 400);
    }

    // Check for overlapping APPROVED/EXISTING vacations
    const overlapping = await db.vacation.findFirst({
        where: {
            employeeId,
            status: { in: ['APPROVED', 'EXISTING'] },
            OR: [{ startDate: { lte: end }, endDate: { gte: start } }]
        }
    });

    if (overlapping) {
        throw new AppError('Ya existe un registro de ausencia que se solapa con estas fechas.', 400);
    }

    // Check for adjacent date conflicts (new startDate - 1 day = existing endDate, or new endDate + 1 day = existing startDate)
    const oneDayMs = 24 * 60 * 60 * 1000;
    const dayBeforeStart = new Date(start.getTime() - oneDayMs);
    const dayAfterEnd = new Date(end.getTime() + oneDayMs);

    const adjacent = await db.vacation.findFirst({
        where: {
            employeeId,
            status: { in: ['APPROVED', 'EXISTING'] },
            OR: [
                { startDate: { equals: dayAfterEnd } },
                { endDate: { equals: dayBeforeStart } }
            ]
        }
    });

    if (adjacent) {
        const conflictingDates = adjacent.endDate.getTime() === dayBeforeStart.getTime()
            ? `La fecha de inicio es un día después de unas vacaciones existentes (${adjacent.startDate.toLocaleDateString()} - ${adjacent.endDate.toLocaleDateString()}).`
            : `La fecha de fin es un día antes de unas vacaciones existentes (${adjacent.startDate.toLocaleDateString()} - ${adjacent.endDate.toLocaleDateString()}).`;
        throw new AppError(`Conflicto de fechas adyacentes. ${conflictingDates}`, 400);
    }

    const requestedDays = calculateVacationRequestDays(start, end, type);

    if (!isVacationType(type)) {
        return { requestedDays };
    }

    const employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: { id: true }
    });

    if (!employee) {
        throw new AppError('Empleado no encontrado', 404);
    }

    const currentYear = start.getFullYear();
    const balance = await getEmployeeVacationBalanceSummary(employeeId, currentYear, tx);

    if (!balance) {
        throw new AppError('No se pudo calcular el saldo de vacaciones del empleado', 500);
    }

    if (balance.projectedAvailableDays < requestedDays) {
        throw new AppError(`Excede cupo. Disponibles: ${balance.projectedAvailableDays}, Solicitados: ${requestedDays}.`, 400);
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

export async function updateVacationStatus(vacationId: string, status: string, rejectionReason?: string, managerComment?: string, approvedBy?: string) {
    const data: Prisma.VacationUpdateInput = { status };
    if (status === 'REJECTED' && rejectionReason) {
        data.rejectionReason = rejectionReason;
    }
    if (status === 'APPROVED' && managerComment) {
        data.managerComment = managerComment;
    }
    if (approvedBy) {
        data.approvedBy = approvedBy;
        data.approvedAt = new Date();
    }
    const vacation = await prisma.vacation.update({
        where: { id: vacationId },
        data,
        include: { employee: true }
    });
    return vacation;
}

export async function transformVacationWithUrl(vacation: any): Promise<any> {
    if (!vacation) return vacation;
    const result = { ...vacation };
    if (result.fileUrl) {
        result.fileUrl = await StorageService.getUrl(result.fileUrl);
    }
    return result;
}

export async function transformVacationListWithUrl(vacations: any[]): Promise<any[]> {
    return Promise.all(vacations.map(transformVacationWithUrl));
}
