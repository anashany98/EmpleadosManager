import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';

export const FileMappingController = {
    getAll: async (req: Request, res: Response) => {
        const user = (req as any).user;
        const userCompanyId = user?.companyId;
        
        const mappings = await (prisma as any).fileMapping.findMany({
            where: userCompanyId 
                ? { OR: [{ companyId: userCompanyId }, { companyId: null }] }
                : undefined,
            orderBy: { createdAt: 'desc' }
        });
        
        return ApiResponse.success(res, mappings);
    },

    create: async (req: Request, res: Response) => {
        const { qrType, category, namePattern, companyId } = req.body;
        
        if (companyId) {
            const existing = await (prisma as any).fileMapping.findFirst({
                where: { qrType, companyId }
            });
            if (existing) {
                return ApiResponse.error(res, 'Ya existe un mapeo para este tipo en la empresa', 409);
            }
        }
        
        const mapping = await (prisma as any).fileMapping.create({
            data: { qrType, category, namePattern, companyId: companyId || null }
        });
        return ApiResponse.success(res, mapping, 'Mapeo creado', 201);
    },

    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { qrType, category, namePattern, companyId } = req.body;
        
        const existing = await (prisma as any).fileMapping.findUnique({ where: { id } });
        if (!existing) {
            return ApiResponse.error(res, 'Mapeo no encontrado', 404);
        }
        
        if (companyId && existing.companyId !== companyId) {
            return ApiResponse.error(res, 'No se puede cambiar la empresa', 400);
        }
        
        const mapping = await (prisma as any).fileMapping.update({
            where: { id },
            data: { qrType, category, namePattern }
        });
        return ApiResponse.success(res, mapping, 'Mapeo actualizado');
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        
        const existing = await (prisma as any).fileMapping.findUnique({ where: { id } });
        if (!existing) {
            return ApiResponse.error(res, 'Mapeo no encontrado', 404);
        }
        
        if (existing.companyId) {
            const user = (req as any).user;
            if (user?.companyId && user.companyId !== existing.companyId) {
                return ApiResponse.error(res, 'No autorizado a eliminar este mapeo', 403);
            }
        }
        
        await (prisma as any).fileMapping.delete({ where: { id } });
        return ApiResponse.success(res, null, 'Mapeo eliminado');
    }
};