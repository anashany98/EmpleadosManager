import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';
import { AppError } from '../utils/AppError';

const log = createLogger('PayrollRowController');

export const PayrollRowController = {
    getBreakdown: async (req: Request, res: Response) => {
        const { rowId } = req.params;
        const { user } = req as AuthenticatedRequest;

        try {
            const row = await prisma.payrollRow.findUnique({
                where: { id: rowId },
                select: { batch: { select: { createdBy: { select: { employee: { select: { companyId: true } } } } } } }
            });

            if (!row) return ApiResponse.error(res, 'Fila no encontrada', 404);

            if (user.role !== 'admin') {
                const rowCompanyId = row.batch?.createdBy?.employee?.companyId;
                if (rowCompanyId !== user.companyId) {
                    throw new AppError('No autorizado', 403);
                }
            }

            const items = await prisma.payrollItem.findMany({
                where: { payrollRowId: rowId },
                orderBy: { createdAt: 'asc' }
            });

            return ApiResponse.success(res, items);
        } catch (error: any) {
            log.error({ error }, 'Error fetching breakdown');
            return ApiResponse.error(res, 'Error al obtener desglose');
        }
    },

    saveBreakdown: async (req: Request, res: Response) => {
        const { rowId } = req.params;
        const { items } = req.body;
        const { user } = req as AuthenticatedRequest;

        try {
            const row = await prisma.payrollRow.findUnique({
                where: { id: rowId },
                select: { batch: { select: { createdBy: { select: { employee: { select: { companyId: true } } } } } } }
            });

            if (!row) return ApiResponse.error(res, 'Fila no encontrada', 404);

            if (user.role !== 'admin') {
                const rowCompanyId = row.batch?.createdBy?.employee?.companyId;
                if (rowCompanyId !== user.companyId) {
                    throw new AppError('No autorizado', 403);
                }
            }

            await prisma.$transaction([
                prisma.payrollItem.deleteMany({ where: { payrollRowId: rowId } }),
                prisma.payrollItem.createMany({
                    data: items.map((item: any) => ({
                        payrollRowId: rowId,
                        concept: item.concept,
                        amount: parseFloat(item.amount),
                        type: item.type
                    }))
                })
            ]);

            return ApiResponse.success(res, null, 'Desglose guardado');
        } catch (error: any) {
            log.error({ error }, 'Error saving breakdown');
            return ApiResponse.error(res, 'Error al guardar desglose');
        }
    }
};