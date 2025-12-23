import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Función auxiliar para calcular horas
function calculateHours(start: Date, end: Date): number {
    const diff = end.getTime() - start.getTime();
    return diff / (1000 * 60 * 60); // Convertir ms a horas
}

// Función para normalizar fecha (sin hora)
function normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
}

export const TimeEntryController = {
    // Obtener fichajes de un empleado
    getByEmployee: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        try {
            const entries = await prisma.timeEntry.findMany({
                where: { employeeId },
                orderBy: { date: 'desc' },
                take: 100 // Últimos 100 registros
            });
            res.json(entries);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener fichajes' });
        }
    },

    // Obtener fichajes de un empleado en un mes específico
    getByEmployeeMonth: async (req: Request, res: Response) => {
        const { employeeId, year, month } = req.params;
        try {
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

            const entries = await prisma.timeEntry.findMany({
                where: {
                    employeeId,
                    date: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                orderBy: { date: 'asc' }
            });

            // Calcular resumen del mes
            const summary = {
                totalHours: entries.reduce((sum: number, e: any) => sum + e.totalHours, 0),
                totalLunchHours: entries.reduce((sum: number, e: any) => sum + e.lunchHours, 0),
                daysWorked: entries.filter((e: any) => e.checkIn && e.checkOut).length,
                daysIncomplete: entries.filter((e: any) => e.checkIn && !e.checkOut).length
            };

            res.json({ entries, summary });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener fichajes del mes' });
        }
    },

    // Obtener todos los fichajes de una fecha específica
    getByDate: async (req: Request, res: Response) => {
        const { date } = req.params;
        try {
            const targetDate = normalizeDate(new Date(date));
            const nextDay = new Date(targetDate);
            nextDay.setDate(nextDay.getDate() + 1);

            const entries = await prisma.timeEntry.findMany({
                where: {
                    date: {
                        gte: targetDate,
                        lt: nextDay
                    }
                },
                include: {
                    employee: {
                        select: {
                            id: true,
                            name: true,
                            department: true,
                            category: true
                        }
                    }
                },
                orderBy: { checkIn: 'asc' }
            });
            res.json(entries);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener fichajes del día' });
        }
    },

    // Obtener fichajes en un rango de fechas (con filtro opcional por empleado)
    getByRange: async (req: Request, res: Response) => {
        const { from, to, employeeId } = req.query;
        try {
            const startDate = normalizeDate(new Date(from as string));
            const endDate = normalizeDate(new Date(to as string));
            endDate.setHours(23, 59, 59);

            const where: any = {
                date: {
                    gte: startDate,
                    lte: endDate
                }
            };

            if (employeeId) {
                where.employeeId = employeeId;
            }

            const entries = await prisma.timeEntry.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            id: true,
                            name: true,
                            department: true
                        }
                    }
                },
                orderBy: [{ date: 'asc' }, { employee: { name: 'asc' } }]
            });

            res.json(entries);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener fichajes en el rango' });
        }
    },

    // Crear o actualizar fichaje
    upsert: async (req: Request, res: Response) => {
        const { employeeId, date, checkIn, checkOut, lunchStart, lunchEnd, notes } = req.body;

        try {
            // Normalizar la fecha (solo día, sin hora)
            const normalizedDate = normalizeDate(new Date(date));

            // Calcular horas trabajadas y pausa
            let totalHours = 0;
            let lunchHours = 0;

            if (checkIn && checkOut) {
                const checkInDate = new Date(checkIn);
                const checkOutDate = new Date(checkOut);

                if (lunchStart && lunchEnd) {
                    const lunchStartDate = new Date(lunchStart);
                    const lunchEndDate = new Date(lunchEnd);
                    lunchHours = calculateHours(lunchStartDate, lunchEndDate);
                }

                const grossHours = calculateHours(checkInDate, checkOutDate);
                totalHours = Math.max(0, grossHours - lunchHours);
            }

            const entry = await prisma.timeEntry.upsert({
                where: {
                    employeeId_date: {
                        employeeId,
                        date: normalizedDate
                    }
                },
                update: {
                    checkIn: checkIn ? new Date(checkIn) : null,
                    checkOut: checkOut ? new Date(checkOut) : null,
                    lunchStart: lunchStart ? new Date(lunchStart) : null,
                    lunchEnd: lunchEnd ? new Date(lunchEnd) : null,
                    totalHours,
                    lunchHours,
                    notes: notes || null
                },
                create: {
                    employeeId,
                    date: normalizedDate,
                    checkIn: checkIn ? new Date(checkIn) : null,
                    checkOut: checkOut ? new Date(checkOut) : null,
                    lunchStart: lunchStart ? new Date(lunchStart) : null,
                    lunchEnd: lunchEnd ? new Date(lunchEnd) : null,
                    totalHours,
                    lunchHours,
                    notes: notes || null
                }
            });

            res.status(201).json(entry);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al guardar fichaje' });
        }
    },

    // Actualizar fichaje
    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { checkIn, checkOut, lunchStart, lunchEnd, notes } = req.body;

        try {
            // Calcular horas
            let totalHours = 0;
            let lunchHours = 0;

            if (checkIn && checkOut) {
                const checkInDate = new Date(checkIn);
                const checkOutDate = new Date(checkOut);

                if (lunchStart && lunchEnd) {
                    const lunchStartDate = new Date(lunchStart);
                    const lunchEndDate = new Date(lunchEnd);
                    lunchHours = calculateHours(lunchStartDate, lunchEndDate);
                }

                const grossHours = calculateHours(checkInDate, checkOutDate);
                totalHours = Math.max(0, grossHours - lunchHours);
            }

            const entry = await prisma.timeEntry.update({
                where: { id },
                data: {
                    checkIn: checkIn ? new Date(checkIn) : undefined,
                    checkOut: checkOut ? new Date(checkOut) : undefined,
                    lunchStart: lunchStart ? new Date(lunchStart) : undefined,
                    lunchEnd: lunchEnd ? new Date(lunchEnd) : undefined,
                    totalHours,
                    lunchHours,
                    notes: notes !== undefined ? notes : undefined
                }
            });

            res.json(entry);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al actualizar fichaje' });
        }
    },

    // Eliminar fichaje
    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            await prisma.timeEntry.delete({ where: { id } });
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar fichaje' });
        }
    }
};
