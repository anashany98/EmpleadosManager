import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { createLogger } from '../services/LoggerService';
import { absenceTypeCreateSchema, absenceTypeUpdateSchema } from '../schemas/absenceTypeConfigSchemas';

const log = createLogger('AbsenceTypeConfigController');

export const AbsenceTypeConfigController = {
    getAll: async (_req: Request, res: Response) => {
        try {
            const types = await prisma.absenceTypeConfig.findMany({
                orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
            });
            return ApiResponse.success(res, types);
        } catch (error) {
            log.error({ error }, 'Error fetching absence types');
            return ApiResponse.error(res, 'Error al obtener los tipos de ausencia');
        }
    },

    getActive: async (_req: Request, res: Response) => {
        try {
            const types = await prisma.absenceTypeConfig.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
            });
            return ApiResponse.success(res, types);
        } catch (error) {
            log.error({ error }, 'Error fetching active absence types');
            return ApiResponse.error(res, 'Error al obtener los tipos de ausencia');
        }
    },

    create: async (req: Request, res: Response) => {
        const parsed = absenceTypeCreateSchema.safeParse(req.body);
        if (!parsed.success) {
            return ApiResponse.error(res, 'Datos inválidos', 400, parsed.error.flatten().fieldErrors);
        }

        const data = parsed.data;

        try {
            const existing = await prisma.absenceTypeConfig.findUnique({ where: { code: data.code } });
            if (existing) {
                return ApiResponse.error(res, `Ya existe un tipo con el código "${data.code}"`, 409);
            }

            const created = await prisma.absenceTypeConfig.create({ data });
            return ApiResponse.success(res, created, 'Tipo de ausencia creado', 201);
        } catch (error) {
            log.error({ error }, 'Error creating absence type');
            return ApiResponse.error(res, 'Error al crear el tipo de ausencia');
        }
    },

    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        const parsed = absenceTypeUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            return ApiResponse.error(res, 'Datos inválidos', 400, parsed.error.flatten().fieldErrors);
        }

        try {
            const existing = await prisma.absenceTypeConfig.findUnique({ where: { id } });
            if (!existing) {
                return ApiResponse.error(res, 'Tipo de ausencia no encontrado', 404);
            }

            const updated = await prisma.absenceTypeConfig.update({
                where: { id },
                data: parsed.data,
            });
            return ApiResponse.success(res, updated, 'Tipo de ausencia actualizado');
        } catch (error) {
            log.error({ error }, 'Error updating absence type');
            return ApiResponse.error(res, 'Error al actualizar el tipo de ausencia');
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;

        try {
            const existing = await prisma.absenceTypeConfig.findUnique({ where: { id } });
            if (!existing) {
                return ApiResponse.error(res, 'Tipo de ausencia no encontrado', 404);
            }

            const vacationCount = await prisma.vacation.count({
                where: { type: existing.code },
            });
            if (vacationCount > 0) {
                return ApiResponse.error(
                    res,
                    `No se puede eliminar: hay ${vacationCount} ausencia(s) registradas con este tipo. Desactívalo en su lugar.`,
                    409
                );
            }

            await prisma.absenceTypeConfig.delete({ where: { id } });
            return ApiResponse.success(res, null, 'Tipo de ausencia eliminado');
        } catch (error) {
            log.error({ error }, 'Error deleting absence type');
            return ApiResponse.error(res, 'Error al eliminar el tipo de ausencia');
        }
    },
};
