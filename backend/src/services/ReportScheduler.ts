import { prisma } from '../lib/prisma';
import { ReportService } from './reports';
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

export class ReportScheduler {
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
            let data: any;
            let filename: string;

            switch (schedule.reportType) {
                case 'attendance': {
                    data = await ReportService.getAttendanceData(
                        params.startDate ? new Date(params.startDate) : new Date(),
                        params.endDate ? new Date(params.endDate) : new Date(),
                        params
                    );
                    filename = `attendance_report_${new Date().toISOString().split('T')[0]}.xlsx`;
                    break;
                }
                case 'overtime': {
                    data = await ReportService.getOvertimeData(
                        params.startDate ? new Date(params.startDate) : new Date(),
                        params.endDate ? new Date(params.endDate) : new Date(),
                        params
                    );
                    filename = `overtime_report_${new Date().toISOString().split('T')[0]}.xlsx`;
                    break;
                }
                case 'vacation': {
                    data = await ReportService.getVacationData(
                        params.year || new Date().getFullYear(),
                        params
                    );
                    filename = `vacation_report_${new Date().toISOString().split('T')[0]}.xlsx`;
                    break;
                }
                case 'costs': {
                    data = await ReportService.getCompanyCostData(
                        params.year || new Date().getFullYear(),
                        params.month,
                        params
                    );
                    filename = `cost_report_${new Date().toISOString().split('T')[0]}.xlsx`;
                    break;
                }
                case 'absences': {
                    data = await ReportService.getDetailedAbsenceData(
                        params.startDate ? new Date(params.startDate) : new Date(),
                        params.endDate ? new Date(params.endDate) : new Date(),
                        params
                    );
                    filename = `absence_report_${new Date().toISOString().split('T')[0]}.xlsx`;
                    break;
                }
                case 'genderGap': {
                    await ReportService.getGenderGapData(params);
                    filename = `gender_gap_report_${new Date().toISOString().split('T')[0]}.xlsx`;
                    break;
                }
                default:
                    return { success: false, error: `Unknown report type: ${schedule.reportType}` };
            }

            const nextRun = this.calculateNextRun(schedule.frequency);
            await prisma.reportSchedule.update({
                where: { id: scheduleId },
                data: { lastRunAt: new Date(), nextRunAt: nextRun }
            });

            log.info({ scheduleId, filename }, 'Report generated successfully');
            return { success: true, filePath: `/tmp/${filename}` };

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

        log.info(`Found ${pendingSchedules.length} pending schedules`);

        for (const schedule of pendingSchedules) {
            await this.generateReport(schedule.id);
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