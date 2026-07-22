import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';

const log = createLogger('EmployeeTrainingController');

export const EmployeeTrainingController = {
    getByEmployee: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        const { user } = req as AuthenticatedRequest;

        if (!user.companyId && user.role !== 'admin') {
            return ApiResponse.error(res, 'No autorizado', 403);
        }

        try {
            const whereClause: any = {};
            
            if (user.companyId) {
                whereClause.employee = { companyId: user.companyId };
            }

            const trainings = await prisma.training.findMany({
                where: {
                    employeeId,
                    ...whereClause
                },
                orderBy: { date: 'desc' }
            });

            return ApiResponse.success(res, trainings);
        } catch {
            log.error('Error fetching trainings');
            return ApiResponse.error(res, 'Error al obtener formaciones');
        }
    },

    create: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        const { courseName, name, date, hours, certificateUrl, type } = req.body;
        const { user } = req as AuthenticatedRequest;

        if (!user.companyId && user.role !== 'admin') {
            return ApiResponse.error(res, 'No autorizado', 403);
        }

        try {
            const employee = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { id: true, companyId: true }
            });

            if (!employee) {
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            if (user.companyId && employee.companyId !== user.companyId) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }

      const training = await prisma.training.create({
        data: {
          employeeId,
          type: type || 'COURSE',
          name: courseName || name,
          date: new Date(date),
          hours: hours ? parseInt(hours) : null,
          fileUrl: certificateUrl
        }
            });

            return ApiResponse.success(res, training, 'Formación creada');
        } catch {
            log.error('Error creating training');
            return ApiResponse.error(res, 'Error al crear formación');
        }
    },

    update: async (req: Request, res: Response) => {
        const { employeeId, id } = req.params;
        const { courseName, name, date, hours, certificateUrl, type } = req.body;
        const { user } = req as AuthenticatedRequest;

        if (!user.companyId && user.role !== 'admin') {
            return ApiResponse.error(res, 'No autorizado', 403);
        }

        try {
            const existing = await prisma.training.findUnique({
                where: { id },
                include: { employee: { select: { companyId: true } } as any }
            });

            if (!existing) {
                return ApiResponse.error(res, 'Formación no encontrada', 404);
            }
            if (existing.employeeId !== employeeId) {
                return ApiResponse.error(res, 'La formación no pertenece a este empleado', 400);
            }
            if (user.companyId && existing.employee?.companyId !== user.companyId) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }

            const training = await prisma.training.update({
                where: { id },
                data: {
                    type: type !== undefined ? (type || 'COURSE') : existing.type,
                    name: (courseName || name) ?? existing.name,
                    date: date ? new Date(date) : existing.date,
                    hours: hours !== undefined ? (hours ? parseInt(hours) : null) : existing.hours,
                    fileUrl: certificateUrl !== undefined ? (certificateUrl || null) : existing.fileUrl
                }
            });

            return ApiResponse.success(res, training, 'Formación actualizada');
        } catch (error) {
            log.error({ error }, 'Error updating training');
            return ApiResponse.error(res, 'Error al actualizar formación');
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { user } = req as AuthenticatedRequest;

        if (!user.companyId && user.role !== 'admin') {
            return ApiResponse.error(res, 'No autorizado', 403);
        }

        try {
            const training = await prisma.training.findUnique({
                where: { id },
                include: { employee: { select: { companyId: true } } as any }
            });

            if (!training) {
                return ApiResponse.error(res, 'Formación no encontrada', 404);
            }

            if (user.companyId && training.employee?.companyId !== user.companyId) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }

            await prisma.training.delete({ where: { id } });

            return ApiResponse.success(res, null, 'Formación eliminada');
        } catch {
            log.error('Error deleting training');
            return ApiResponse.error(res, 'Error al eliminar formación');
        }
    }
};