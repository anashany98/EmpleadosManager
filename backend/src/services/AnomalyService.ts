import { prisma } from '../lib/prisma';

type Reason = { code: string; message: string; score: number };

const toMinutes = (date: Date) => date.getHours() * 60 + date.getMinutes();

const median = (values: number[]) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

const distanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const toRad = (v: number) => v * Math.PI / 180;
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const dPhi = toRad(lat2 - lat1);
    const dLambda = toRad(lon2 - lon1);
    const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const upsertAnomaly = async (entityType: string, entityId: string, employeeId: string | null, reasons: Reason[]) => {
    if (reasons.length === 0) return;
    const score = Math.min(100, reasons.reduce((sum, r) => sum + r.score, 0));
    const payload = {
        entityType,
        entityId,
        employeeId: employeeId || undefined,
        score,
        reasons: JSON.stringify(reasons),
        status: 'OPEN'
    };

    await prisma.anomalyEvent.upsert({
        where: { entityType_entityId: { entityType, entityId } },
        update: payload,
        create: payload
    });
};

export const AnomalyService = {
    async detectTimeEntry(entry: any) {
        try {
            const reasons: Reason[] = [];

            const entryDate = new Date(entry.timestamp);
            const minutes = toMinutes(entryDate);
            const dayOfWeek = entryDate.getDay();

            if (entryDate.getHours() < 5 || entryDate.getHours() > 22) {
                reasons.push({
                    code: 'OFF_HOURS',
                    message: 'Fichaje fuera del horario habitual (05:00-22:00).',
                    score: 20
                });
            }

            const lastEntry = await prisma.timeEntry.findFirst({
                where: {
                    employeeId: entry.employeeId,
                    id: { not: entry.id }
                },
                orderBy: { timestamp: 'desc' }
            });

            if (lastEntry && lastEntry.type === entry.type) {
                const diffMinutes = Math.abs((new Date(entry.timestamp).getTime() - new Date(lastEntry.timestamp).getTime()) / 60000);
                if (diffMinutes < 30) {
                    reasons.push({
                        code: 'DUPLICATE_ENTRY',
                        message: 'Fichaje repetido con el mismo tipo en menos de 30 minutos.',
                        score: 15
                    });
                }
            }

            if (entry.type === 'IN') {
                const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
                const history = await prisma.timeEntry.findMany({
                    where: {
                        employeeId: entry.employeeId,
                        type: 'IN',
                        timestamp: { gte: since }
                    },
                    orderBy: { timestamp: 'desc' },
                    take: 30
                });

                const sameWeekday = history
                    .filter(h => new Date(h.timestamp).getDay() === dayOfWeek)
                    .map(h => toMinutes(new Date(h.timestamp)));

                if (sameWeekday.length >= 5) {
                    const med = median(sameWeekday);
                    const diff = Math.abs(minutes - med);
                    if (diff > 120) {
                        reasons.push({
                            code: 'OUT_OF_PATTERN',
                            message: 'Fichaje de entrada fuera del patrón habitual (+/- 2h).',
                            score: 20
                        });
                    }
                }
            }

            const hasCoords = Number.isFinite(entry.latitude) && Number.isFinite(entry.longitude);
            if (hasCoords) {
                const employee = await prisma.employee.findUnique({
                    where: { id: entry.employeeId },
                    include: { company: true }
                });
                if (employee?.company?.officeLatitude && employee?.company?.officeLongitude) {
                    const distance = distanceInMeters(
                        entry.latitude as number,
                        entry.longitude as number,
                        employee.company.officeLatitude,
                        employee.company.officeLongitude
                    );
                    const radius = employee.company.allowedRadius || 100;
                    if (distance > radius) {
                        reasons.push({
                            code: 'GEOFENCE',
                            message: `Fichaje fuera del radio permitido (${Math.round(distance)}m > ${radius}m).`,
                            score: 25
                        });
                    }
                }
            }

            await upsertAnomaly('TIME_ENTRY', entry.id, entry.employeeId, reasons);
        } catch (error) {
            console.error('[Anomaly] detectTimeEntry error:', error);
        }
    },

    async detectExpense(expense: any) {
        try {
            const reasons: Reason[] = [];
            const expDate = new Date(expense.date);

            if (expDate.getDay() === 0 || expDate.getDay() === 6) {
                reasons.push({
                    code: 'WEEKEND_EXPENSE',
                    message: 'Gasto registrado en fin de semana.',
                    score: 10
                });
            }

            const dayStart = new Date(expDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(expDate);
            dayEnd.setHours(23, 59, 59, 999);

            const duplicate = await prisma.expense.findFirst({
                where: {
                    employeeId: expense.employeeId,
                    amount: expense.amount,
                    date: { gte: dayStart, lte: dayEnd },
                    id: { not: expense.id }
                }
            });
            if (duplicate) {
                reasons.push({
                    code: 'DUPLICATE_EXPENSE',
                    message: 'Posible gasto duplicado (mismo importe y día).',
                    score: 20
                });
            }

            const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const stats = await prisma.expense.aggregate({
                where: {
                    employeeId: expense.employeeId,
                    category: expense.category,
                    date: { gte: since },
                    id: { not: expense.id }
                },
                _avg: { amount: true },
                _count: true
            });

            const avg = stats._avg.amount || 0;
            const count = stats._count || 0;
            const threshold = count >= 3 ? Math.max(100, avg * 2) : 500;

            if (expense.amount >= threshold) {
                reasons.push({
                    code: 'AMOUNT_OUTLIER',
                    message: `Importe elevado para la categoría (>= ${threshold.toFixed(2)}).`,
                    score: 25
                });
            }

            await upsertAnomaly('EXPENSE', expense.id, expense.employeeId, reasons);
        } catch (error) {
            console.error('[Anomaly] detectExpense error:', error);
        }
    },

    async detectVacation(vacation: any) {
        try {
            const reasons: Reason[] = [];
            const start = new Date(vacation.startDate);

            if (start.getDay() === 1 || start.getDay() === 5) {
                const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
                const countPattern = await prisma.vacation.count({
                    where: {
                        employeeId: vacation.employeeId,
                        startDate: { gte: since },
                        id: { not: vacation.id }
                    }
                });
                if (countPattern >= 2) {
                    reasons.push({
                        code: 'PATTERN_MF',
                        message: 'Ausencias recurrentes en lunes/viernes.',
                        score: 20
                    });
                }
            }

            const recent = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
            const recentCount = await prisma.vacation.count({
                where: {
                    employeeId: vacation.employeeId,
                    startDate: { gte: recent },
                    status: { not: 'REJECTED' }
                }
            });
            if (recentCount >= 3) {
                reasons.push({
                    code: 'FREQUENT_ABSENCE',
                    message: 'Alta frecuencia de ausencias en los últimos 60 días.',
                    score: 20
                });
            }

            if (vacation.days && vacation.days > 10) {
                reasons.push({
                    code: 'LONG_ABSENCE',
                    message: 'Ausencia de larga duración (>10 días laborables).',
                    score: 15
                });
            }

            await upsertAnomaly('VACATION', vacation.id, vacation.employeeId, reasons);
        } catch (error) {
            console.error('[Anomaly] detectVacation error:', error);
        }
    }
};
