import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

type DbClient = Prisma.TransactionClient | typeof prisma;

function dateKey(date: Date): string {
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0')
    ].join('-');
}

function startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export const HolidayService = {
    /**
     * Cuenta lunes-viernes sin asumir ningún festivo fijo.
     * Útil en cálculos puros y como compatibilidad para históricos.
     */
    getBusinessDaysCount(start: Date, end: Date, holidayKeys: ReadonlySet<string> = new Set()) {
        let count = 0;
        const current = startOfUtcDay(start);
        const targetEnd = startOfUtcDay(end);
        while (current <= targetEnd) {
            const weekday = current.getUTCDay();
            if (weekday !== 0 && weekday !== 6 && !holidayKeys.has(dateKey(current))) count++;
            current.setUTCDate(current.getUTCDate() + 1);
        }
        return count;
    },

    /**
     * Fuente única de festivos: eventos HOLIDAY del calendario de la empresa
     * más los eventos públicos. Soporta festivos de varios días.
     */
    async getBusinessDaysCountForCompany(
        start: Date,
        end: Date,
        companyId: string,
        db: DbClient = prisma
    ): Promise<number> {
        const events = await db.calendarEvent.findMany({
            where: {
                type: 'HOLIDAY',
                startDate: { lte: end },
                endDate: { gte: start },
                OR: [{ companyId }, { companyId: null, isPublic: true }]
            },
            select: { startDate: true, endDate: true }
        });

        const holidayKeys = new Set<string>();
        for (const event of events) {
            const current = startOfUtcDay(event.startDate < start ? start : event.startDate);
            const eventEnd = startOfUtcDay(event.endDate > end ? end : event.endDate);
            while (current <= eventEnd) {
                holidayKeys.add(dateKey(current));
                current.setUTCDate(current.getUTCDate() + 1);
            }
        }
        return this.getBusinessDaysCount(start, end, holidayKeys);
    }
};
