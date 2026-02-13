import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';

export const FileMappingController = {
    getAll: async (req: Request, res: Response) => {
        const mappings = await (prisma as any).fileMapping.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return ApiResponse.success(res, mappings);
    },

    create: async (req: Request, res: Response) => {
        const { qrType, category, namePattern } = req.body;
        const mapping = await (prisma as any).fileMapping.create({
            data: { qrType, category, namePattern }
        });
        return ApiResponse.success(res, mapping, 'Mapeo creado', 201);
    },

    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { qrType, category, namePattern } = req.body;
        const mapping = await (prisma as any).fileMapping.update({
            where: { id },
            data: { qrType, category, namePattern }
        });
        return ApiResponse.success(res, mapping, 'Mapeo actualizado');
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        await (prisma as any).fileMapping.delete({ where: { id } });
        return ApiResponse.success(res, null, 'Mapeo eliminado');
    }
};
