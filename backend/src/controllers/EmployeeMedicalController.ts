import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';

const log = createLogger('EmployeeMedicalController');

export const EmployeeMedicalController = {
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

            const medicalReviews = await prisma.medicalReview.findMany({
                where: {
                    employeeId,
                    ...whereClause
                },
                orderBy: { date: 'desc' }
            });

            return ApiResponse.success(res, medicalReviews);
        } catch (error) {
            log.error({ error }, 'Error fetching medical reviews');
            return ApiResponse.error(res, 'Error al obtener revisiones médicas');
        }
    },

    create: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        const { date, notes, result, nextReviewDate } = req.body;
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

      const review = await prisma.medicalReview.create({
        data: {
          employeeId,
          date: new Date(date),
          result: result || notes,
          nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : null
        }
            });

            return ApiResponse.success(res, review, 'Revisión médica creada');
        } catch (error) {
            log.error({ error }, 'Error creating medical review');
            return ApiResponse.error(res, 'Error al crear revisión médica');
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { user } = req as AuthenticatedRequest;

        if (!user.companyId && user.role !== 'admin') {
            return ApiResponse.error(res, 'No autorizado', 403);
        }

        try {
            const review = await prisma.medicalReview.findUnique({
                where: { id },
                include: { employee: { select: { companyId: true } } as any }
            });

            if (!review) {
                return ApiResponse.error(res, 'Revisión no encontrada', 404);
            }

            if (user.companyId && review.employee?.companyId !== user.companyId) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }

            await prisma.medicalReview.delete({ where: { id } });

            return ApiResponse.success(res, null, 'Revisión médica eliminada');
        } catch (error) {
            log.error({ error }, 'Error deleting medical review');
            return ApiResponse.error(res, 'Error al eliminar revisión médica');
        }
    }
};