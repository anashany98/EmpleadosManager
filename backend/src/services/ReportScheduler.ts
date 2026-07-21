import path from 'path';
import { prisma } from '../lib/prisma';
import { ReportService } from './reports';
import { ExcelService } from './ExcelService';
import { EmailService } from './EmailService';
import { StorageService } from './StorageService';
import { AuditService } from './AuditService';
import { createLogger } from './LoggerService';

const log = createLogger('ReportScheduler');

interface ReportParams {
    companyId?: string;
    startDate?: string;
    endDate?: string;
    department?: string;
    employeeId?: string;
    year?: number;
    month?: number;
}

/**
 * Minimal actor shape required by the scheduler to enforce
 * tenant isolation. Mirrors `AuthUser` but is decoupled to keep
 * the scheduler easily testable.
 */
export interface SchedulerActor {
    id: string;
    role?: string;
    companyId?: string | null;
    employeeId?: string | null;
}

const REPORT_LABELS: Record<string, string> = {
    attendance: 'Asistencia y jornadas',
    attendanceSummary: 'Resumen de asistencia',
    overtime: 'Horas extra',
    vacation: 'Vacaciones',
    costs: 'Coste empresa',
    absences: 'Bajas y ausencias',
    kpis: 'KPIs',
    genderGap: 'Igualdad y diversidad'
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isGlobalAdmin(actor: SchedulerActor | null | undefined): boolean {
    return !!actor && actor.role === 'admin' && !actor.companyId;
}

function parseRecipients(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((r) => String(r).trim()).filter(Boolean);
    } catch {
        // fall through to CSV parse
    }
    return raw.split(',').map((r) => r.trim()).filter(Boolean);
}

function assertValidRecipients(recipients: string[]): void {
    if (recipients.length === 0) {
        throw new Error('Se requiere al menos un destinatario cuando sendEmail es true');
    }
    const invalid = recipients.filter((r) => !EMAIL_REGEX.test(r));
    if (invalid.length > 0) {
        // Censuramos la dirección para no filtrar PII en el error.
        const sample = invalid[0].replace(/(.{2}).+(@.+)/, '$1***$2');
        throw new Error(`Destinatarios inválidos detectados (muestra censurada: ${sample})`);
    }
}

export class ReportScheduler {
    private cronInterval: ReturnType<typeof setInterval> | null = null;

    start(intervalMs = 60 * 60 * 1000) {
        if (this.cronInterval) return;
        log.info({ intervalMs }, 'Starting report scheduler cron');
        this.cronInterval = setInterval(() => {
            // Por defecto, el cron de proceso solo procesa schedules
            // ya filtrados. Si el despliegue tiene admin global
            // exclusivo, el caller puede invocar runPendingSchedules(null).
            this.runPendingSchedules().catch((err) => {
                log.error({ err }, 'Scheduled report run failed');
            });
        }, intervalMs);
    }

    stop() {
        if (this.cronInterval) {
            clearInterval(this.cronInterval);
            this.cronInterval = null;
            log.info('Report scheduler cron stopped');
        }
    }

    /**
     * Ejecuta un schedule ya validado. El caller (ruta o cron)
     * debe haber comprobado el ownership antes.
     */
    async generateReport(
        scheduleId: string,
        actor: SchedulerActor
    ): Promise<{ success: boolean; filePath?: string; error?: string }> {
        const schedule = await prisma.reportSchedule.findUnique({ where: { id: scheduleId } });

        if (!schedule) {
            return { success: false, error: 'Schedule not found' };
        }

        // Doble check de tenant: aunque el caller ya haya validado,
        // nunca confiamos en un schedule "huérfano" para un actor
        // con companyId. Solo los admin globales pueden saltarse la
        // restricción.
        if (!isGlobalAdmin(actor)) {
            if (!actor.companyId || schedule.companyId !== actor.companyId) {
                log.warn({ scheduleId, actorId: actor.id }, 'Cross-tenant report generation attempt blocked');
                return { success: false, error: 'Schedule not found' };
            }
        }

        if (!schedule.isActive) {
            return { success: false, error: 'Schedule is inactive' };
        }

        log.info({ scheduleId, reportType: schedule.reportType, actorId: actor.id }, 'Generating scheduled report');

        try {
            // Forzamos companyId del actor en los params que se pasan
            // a ReportService, para que ningún query pueda "ver" más
            // allá del tenant del actor.
            const params: ReportParams = JSON.parse(schedule.params || '{}');
            if (!isGlobalAdmin(actor)) {
                params.companyId = actor.companyId ?? undefined;
            }
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];

            const REPORT_TYPE_MAP: Record<string, string> = {
                'attendance': 'attendance',
                'attendance-summary': 'attendanceSummary',
                'overtime': 'overtime',
                'vacations': 'vacation',
                'vacation': 'vacation',
                'costs': 'costs',
                'absences-detailed': 'absences',
                'absences': 'absences',
                'kpis': 'kpis',
                'gender-gap': 'genderGap',
                'genderGap': 'genderGap'
            };

            const normalizedType = REPORT_TYPE_MAP[schedule.reportType] || schedule.reportType;
            const label = REPORT_LABELS[normalizedType] || REPORT_LABELS[schedule.reportType] || schedule.reportType;
            const title = `${label} - Programado`;

            let excelBuffer: Buffer | null = null;

            const buildContext = () => ({
                title,
                subtitle: `Generado automáticamente el ${dateStr}`,
                periodLabel: params.year ? `Año ${params.year}` : `${params.startDate || ''} al ${params.endDate || ''}`,
                filters: [
                    params.department ? `Departamento: ${params.department}` : 'Todos los departamentos',
                    params.companyId ? 'Empresa filtrada' : 'Todas las empresas'
                ]
            });

            const toBuffer = (result: any): Buffer => {
                if (Buffer.isBuffer(result)) return result;
                return Buffer.from(result);
            };

            switch (normalizedType) {
                case 'attendance': {
                    const startDate = params.startDate ? new Date(params.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
                    const endDate = params.endDate ? new Date(params.endDate) : now;
                    const data = await ReportService.getAttendanceData(startDate, endDate, params);
                    const rows = (data as any)?.data || data || [];
                    excelBuffer = toBuffer(await ExcelService.generateAttendanceReport(rows, buildContext()));
                    break;
                }
                case 'attendanceSummary': {
                    const startDate = params.startDate ? new Date(params.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
                    const endDate = params.endDate ? new Date(params.endDate) : now;
                    const data = await ReportService.getAttendanceDailySummary(startDate, endDate, params);
                    excelBuffer = toBuffer(await ExcelService.generateAttendanceSummaryReport(data || [], buildContext()));
                    break;
                }
                case 'overtime': {
                    const startDate = params.startDate ? new Date(params.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
                    const endDate = params.endDate ? new Date(params.endDate) : now;
                    const data = await ReportService.getOvertimeData(startDate, endDate, params);
                    const rows = (data as any)?.data || data || [];
                    excelBuffer = toBuffer(await ExcelService.generateOvertimeReport(rows, buildContext()));
                    break;
                }
                case 'vacation': {
                    const result = await ReportService.getVacationData(
                        params.year || now.getFullYear(),
                        params
                    );
                    const rows = (result as any)?.data || result || [];
                    excelBuffer = toBuffer(await ExcelService.generateVacationReport(rows, buildContext()));
                    break;
                }
                case 'costs': {
                    const rows = await ReportService.getCompanyCostData(
                        params.year || now.getFullYear(),
                        params.month,
                        params
                    );
                    excelBuffer = toBuffer(await ExcelService.generateCostReport(rows || [], buildContext()));
                    break;
                }
                case 'absences': {
                    const startDate = params.startDate ? new Date(params.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
                    const endDate = params.endDate ? new Date(params.endDate) : now;
                    const data = await ReportService.getDetailedAbsenceData(startDate, endDate, params);
                    const rows = (data as any)?.data || data || [];
                    excelBuffer = toBuffer(await ExcelService.generateDetailedAbsenceReport(rows, buildContext()));
                    break;
                }
                case 'kpis': {
                    const year = params.year || now.getFullYear();
                    const month = params.month || now.getMonth() + 1;
                    const summary = await ReportService.getKPIMetrics(year, month, params);
                    const deptStats = await ReportService.getAbsenteeismByDepartment(year, month, params);
                    excelBuffer = toBuffer(await ExcelService.generateKPIReport(summary, deptStats || [], buildContext()));
                    break;
                }
                case 'genderGap': {
                    const genderData = await ReportService.getGenderGapData(params);
                    excelBuffer = toBuffer(await ExcelService.generateGenderGapReport(genderData, buildContext()));
                    break;
                }
                default:
                    return { success: false, error: `Unknown report type: ${schedule.reportType}` };
            }

            if (!excelBuffer) {
                return { success: false, error: 'No data to generate report' };
            }

            const filename = `${schedule.reportType}_report_${dateStr}.xlsx`;
            const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

            const { key } = await StorageService.saveBuffer({
                folder: 'reports/scheduled',
                originalName: safeName,
                buffer: excelBuffer,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            if (schedule.sendEmail) {
                const recipients = parseRecipients(schedule.recipients);
                assertValidRecipients(recipients);

                const emailHtml = `
                        <h2>${title}</h2>
                        <p>Se ha generado automáticamente el reporte <strong>${label}</strong>.</p>
                        <p><strong>Fecha:</strong> ${dateStr}</p>
                        ${params.department ? `<p><strong>Departamento:</strong> ${params.department}</p>` : ''}
                        <p>El archivo Excel está adjunto a este correo.</p>
                    `;

                const attachmentBuffer = await StorageService.getBuffer(key);
                const attachments = [{
                    filename: safeName,
                    content: attachmentBuffer,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }];

                for (const recipient of recipients) {
                    try {
                        await EmailService.sendMail(recipient, title, emailHtml, attachments);
                        log.info({ recipient, scheduleId, actorId: actor.id }, 'Scheduled report email sent');
                    } catch (emailErr) {
                        log.error({ emailErr, recipient, scheduleId }, 'Failed to send scheduled report email');
                    }
                }
            }

            const nextRun = this.calculateNextRun(schedule.frequency);
            await prisma.reportSchedule.update({
                where: { id: scheduleId },
                data: { lastRunAt: now, nextRunAt: nextRun }
            });

            // Auditoría: solo registramos ejecuciones exitosas; los
            // rechazos se loguean en `log.warn` arriba.
            await AuditService.log(
                'REPORT_SCHEDULE_RUN',
                'REPORT_SCHEDULE',
                scheduleId,
                {
                    reportType: schedule.reportType,
                    companyId: schedule.companyId,
                    actorId: actor.id,
                    recipients: schedule.sendEmail ? parseRecipients(schedule.recipients).length : 0
                },
                actor.id
            ).catch((err) => log.error({ err }, 'Audit log failed for schedule run'));

            log.info({ scheduleId, key, filename }, 'Scheduled report generated successfully');
            return { success: true, filePath: `/uploads/${key}` };

        } catch (error) {
            log.error({ error, scheduleId }, 'Failed to generate scheduled report');
            return { success: false, error: String(error) };
        }
    }

    calculateNextRun(frequency: string): Date {
        const now = new Date();
        switch (frequency) {
            case 'DAILY':
                return new Date(now.getTime() + 24 * 60 * 60 * 1000);
            case 'WEEKLY':
                return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            case 'MONTHLY':
                return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
            default:
                return new Date(now.getTime() + 24 * 60 * 60 * 1000);
        }
    }

    /**
     * Procesa los schedules pendientes. Si `actor` se pasa, se
     * procesan solo los del tenant del actor (modo scoped). Si se
     * llama con `actor=null`, se asume admin global y se procesan
     * todos (uso exclusivo del cron interno).
     */
    async runPendingSchedules(companyId?: string | null, actor?: SchedulerActor | null) {
        log.info({ companyId, actorId: actor?.id }, 'Checking for pending report schedules...');

        const now = new Date();
        const where: any = {
            isActive: true,
            nextRunAt: { lte: now }
        };
        if (companyId) {
            where.companyId = companyId;
        } else if (actor && !isGlobalAdmin(actor)) {
            where.companyId = actor.companyId ?? '__none__';
        }

        const pendingSchedules = await prisma.reportSchedule.findMany({ where });

        log.info({ count: pendingSchedules.length, companyId }, 'Found pending schedules');

        for (const schedule of pendingSchedules) {
            try {
                // Sintético: para cron global, el actor es un "service"
                // sin companyId. Pasamos un actor derivado del schedule.
                const syntheticActor: SchedulerActor = actor ?? {
                    id: 'system:scheduler',
                    role: 'admin',
                    companyId: schedule.companyId ?? null
                };
                await this.generateReport(schedule.id, syntheticActor);
            } catch (err) {
                log.error({ err, scheduleId: schedule.id }, 'Error running scheduled report');
            }
        }
    }

    async getSchedules(actor: SchedulerActor | null) {
        const where = isGlobalAdmin(actor) ? {} : actor?.companyId ? { companyId: actor.companyId } : { companyId: '__none__' };
        return prisma.reportSchedule.findMany({
            where,
            orderBy: { nextRunAt: 'asc' }
        });
    }

    async createSchedule(
        data: {
            name: string;
            reportType: string;
            params: string;
            frequency: string;
            sendEmail: boolean;
            recipients: string;
            companyId?: string;
        },
        actor: SchedulerActor
    ) {
        // Forzamos companyId del actor (nunca del body)
        const companyId = isGlobalAdmin(actor) ? (data.companyId ?? null) : (actor.companyId ?? null);

        // Si va a enviar email, validamos los destinatarios AHORA
        // (no en cada ejecución) para no propagar schedules inválidos.
        if (data.sendEmail) {
            const recipients = parseRecipients(data.recipients);
            assertValidRecipients(recipients);
        }

        const nextRun = this.calculateNextRun(data.frequency);
        const created = await prisma.reportSchedule.create({
            data: {
                name: data.name,
                reportType: data.reportType,
                params: data.params,
                frequency: data.frequency,
                sendEmail: data.sendEmail,
                recipients: data.recipients,
                companyId,
                nextRunAt: nextRun
            }
        });

        await AuditService.log(
            'REPORT_SCHEDULE_CREATE',
            'REPORT_SCHEDULE',
            created.id,
            {
                reportType: data.reportType,
                frequency: data.frequency,
                companyId,
                sendEmail: data.sendEmail
            },
            actor.id
        ).catch((err) => log.error({ err }, 'Audit log failed for schedule create'));

        return created;
    }

    async toggleSchedule(
        scheduleId: string,
        isActive: boolean,
        actor: SchedulerActor
    ): Promise<{ success: boolean; error?: string }> {
        const schedule = await prisma.reportSchedule.findUnique({ where: { id: scheduleId } });
        if (!schedule) {
            return { success: false, error: 'Schedule not found' };
        }
        if (!isGlobalAdmin(actor) && schedule.companyId !== actor.companyId) {
            log.warn({ scheduleId, actorId: actor.id }, 'Cross-tenant schedule toggle blocked');
            return { success: false, error: 'Schedule not found' };
        }
        const updated = await prisma.reportSchedule.update({
            where: { id: scheduleId },
            data: { isActive }
        });
        await AuditService.log(
            'REPORT_SCHEDULE_TOGGLE',
            'REPORT_SCHEDULE',
            scheduleId,
            { isActive, companyId: schedule.companyId, actorId: actor.id },
            actor.id
        ).catch((err) => log.error({ err }, 'Audit log failed for schedule toggle'));
        return { success: true, schedule: updated } as any;
    }
}

export const reportScheduler = new ReportScheduler();
