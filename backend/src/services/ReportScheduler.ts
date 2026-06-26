import path from 'path';
import { prisma } from '../lib/prisma';
import { ReportService } from './reports';
import { ExcelService } from './ExcelService';
import { EmailService } from './EmailService';
import { StorageService } from './StorageService';
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

export class ReportScheduler {
    private cronInterval: ReturnType<typeof setInterval> | null = null;

    start(intervalMs = 60 * 60 * 1000) {
        if (this.cronInterval) return;
        log.info({ intervalMs }, 'Starting report scheduler cron');
        this.cronInterval = setInterval(() => {
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

    async generateReport(scheduleId: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
        const schedule = await prisma.reportSchedule.findUnique({ where: { id: scheduleId } });

        if (!schedule) {
            return { success: false, error: 'Schedule not found' };
        }

        if (!schedule.isActive) {
            return { success: false, error: 'Schedule is inactive' };
        }

        log.info({ scheduleId, reportType: schedule.reportType }, 'Generating scheduled report');

        try {
            const params: ReportParams = JSON.parse(schedule.params || '{}');
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

            let data: any;
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
                case 'attendance':
                case 'attendanceSummary': {
                    const startDate = params.startDate ? new Date(params.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
                    const endDate = params.endDate ? new Date(params.endDate) : now;
                    data = await ReportService.getAttendanceData(startDate, endDate, params);
                    const rows = data?.data || data || [];
                    excelBuffer = toBuffer(await ExcelService.generateAttendanceReport(rows, buildContext()));
                    break;
                }
                case 'attendanceSummary': {
                    const startDate = params.startDate ? new Date(params.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
                    const endDate = params.endDate ? new Date(params.endDate) : now;
                    data = await ReportService.getAttendanceDailySummary(startDate, endDate, params);
                    excelBuffer = toBuffer(await ExcelService.generateAttendanceSummaryReport(data || [], buildContext()));
                    break;
                }
                case 'overtime': {
                    const startDate = params.startDate ? new Date(params.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
                    const endDate = params.endDate ? new Date(params.endDate) : now;
                    data = await ReportService.getOvertimeData(startDate, endDate, params);
                    const rows = data?.data || data || [];
                    excelBuffer = toBuffer(await ExcelService.generateOvertimeReport(rows, buildContext()));
                    break;
                }
                case 'vacation': {
                    const result = await ReportService.getVacationData(
                        params.year || now.getFullYear(),
                        params
                    );
                    const rows = result?.data || result || [];
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
                    data = await ReportService.getDetailedAbsenceData(startDate, endDate, params);
                    const rows = data?.data || data || [];
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

            if (schedule.sendEmail && schedule.recipients) {
                let recipients: string[] = [];
                try {
                    recipients = JSON.parse(schedule.recipients);
                } catch {
                    recipients = schedule.recipients.split(',').map(r => r.trim()).filter(Boolean);
                }

                if (recipients.length > 0) {
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
                            log.info({ recipient, scheduleId }, 'Scheduled report email sent');
                        } catch (emailErr) {
                            log.error({ emailErr, recipient, scheduleId }, 'Failed to send scheduled report email');
                        }
                    }
                }
            }

            const nextRun = this.calculateNextRun(schedule.frequency);
            await prisma.reportSchedule.update({
                where: { id: scheduleId },
                data: { lastRunAt: now, nextRunAt: nextRun }
            });

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

    async runPendingSchedules() {
        log.info('Checking for pending report schedules...');

        const now = new Date();
        const pendingSchedules = await prisma.reportSchedule.findMany({
            where: {
                isActive: true,
                nextRunAt: { lte: now }
            }
        });

        log.info({ count: pendingSchedules.length }, 'Found pending schedules');

        for (const schedule of pendingSchedules) {
            try {
                await this.generateReport(schedule.id);
            } catch (err) {
                log.error({ err, scheduleId: schedule.id }, 'Error running scheduled report');
            }
        }
    }

    async getSchedules(companyId?: string) {
        return prisma.reportSchedule.findMany({
            where: companyId ? { companyId } : undefined,
            orderBy: { nextRunAt: 'asc' }
        });
    }

    async createSchedule(data: {
        name: string;
        reportType: string;
        params: string;
        frequency: string;
        sendEmail: boolean;
        recipients: string;
        companyId?: string;
    }) {
        const nextRun = this.calculateNextRun(data.frequency);
        return prisma.reportSchedule.create({
            data: {
                ...data,
                nextRunAt: nextRun
            }
        });
    }

    async toggleSchedule(scheduleId: string, isActive: boolean) {
        return prisma.reportSchedule.update({
            where: { id: scheduleId },
            data: { isActive }
        });
    }
}

export const reportScheduler = new ReportScheduler();
