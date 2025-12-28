import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { HolidayService } from '../services/HolidayService';

export const VacationController = {
    // Obtener todas las vacaciones (Global)
    getAll: async (req: Request, res: Response) => {
        try {
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
            const { employeeId, startDate, endDate, type, reason } = req.body;

            if (!employeeId || !startDate || !endDate) {
                return res.status(400).json({ error: 'Faltan campos requeridos' });
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

            if (type === 'VACATION' || !type) {
                const employee = await prisma.employee.findUnique({
                    where: { id: employeeId },
                    include: { vacations: true }
                });

                if (!employee) return res.status(404).json({ error: 'Empleado no encontrado' });

                const currentYear = start.getFullYear();
                const usedDays = employee.vacations.reduce((acc: number, v: any) => {
                    if ((v.type === 'VACATION' || !v.type) && v.startDate.getFullYear() === currentYear) {
                        return acc + HolidayService.getBusinessDaysCount(new Date(v.startDate), new Date(v.endDate));
                    }
                    return acc;
                }, 0);

                const quota = employee.vacationDaysTotal || 30;
                if (usedDays + diffDays > quota) {
                    return res.status(400).json({
                        error: `Excede cupo.Disponibles: ${quota - usedDays}, Solicitados: ${diffDays}.`,
                        insufficientDays: true
                    });
                }
            }

            const vacation = await prisma.vacation.create({
                data: {
                    employeeId,
                    startDate: start,
                    endDate: end,
                    type: type || 'VACATION',
                    reason: reason || null
                }
            });

            res.json(vacation);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Eliminar
    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
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
            const vacation = await prisma.vacation.update({
                where: { id },
                data: { status }
            });
            return ApiResponse.success(res, vacation, 'Estado de vacaciones actualizado');
        } catch (error) {
            throw new AppError('Error al actualizar el estado de las vacaciones', 500);
        }
    }
};
