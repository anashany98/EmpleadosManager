import { prisma } from '../lib/prisma';
import { createLogger } from './LoggerService';

const log = createLogger('VacationArchivalService');

export async function archiveOldVacations(yearsOld: number): Promise<{ archived: number; failed: number }> {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - yearsOld);
    cutoffDate.setHours(0, 0, 0, 0);

    log.info({ yearsOld, cutoffDate }, 'Starting vacation archival');

    const oldVacations = await prisma.vacation.findMany({
        where: {
            startDate: { lt: cutoffDate }
        }
    });

    if (oldVacations.length === 0) {
        log.info('No vacations to archive');
        return { archived: 0, failed: 0 };
    }

    let archived = 0;
    let failed = 0;

    for (const vacation of oldVacations) {
        try {
            await prisma.vacationArchive.create({
                data: {
                    employeeId: vacation.employeeId,
                    startDate: vacation.startDate,
                    endDate: vacation.endDate,
                    type: vacation.type,
                    absenceType: vacation.absenceType,
                    days: vacation.days,
                    reason: vacation.reason,
                    fileUrl: vacation.fileUrl,
                    status: vacation.status,
                    rejectionReason: vacation.rejectionReason,
                    createdAt: vacation.createdAt,
                    updatedAt: vacation.updatedAt,
                    archiveReason: `Auto-archived after ${yearsOld} years`
                }
            });

            await prisma.vacation.delete({ where: { id: vacation.id } });
            archived++;
        } catch (error) {
            log.error({ error, vacationId: vacation.id }, 'Failed to archive vacation');
            failed++;
        }
    }

    log.info({ archived, failed }, 'Vacation archival completed');
    return { archived, failed };
}