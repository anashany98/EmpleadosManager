import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuditService } from '../services/AuditService';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';
import { Prisma } from '@prisma/client';

const FORBIDDEN_UPDATE_KEYS = new Set(['id', 'createdAt', 'updatedAt']);

function ctx(req: Request) {
    return {
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
    };
}

export const ObraContractorController = {
    list: async (req: Request, res: Response) => {
        try {
            const q = req.query.q ? String(req.query.q).trim() : '';
            const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
            const skip = (page - 1) * limit;

            const where: Prisma.ObraContractorWhereInput = {};
            if (active !== undefined) where.active = active;
            if (q) {
                where.OR = [
                    { name: { contains: q, mode: 'insensitive' } },
                    { nif: { contains: q, mode: 'insensitive' } },
                    { activity: { contains: q, mode: 'insensitive' } }
                ];
            }

            const [contractors, total] = await Promise.all([
                prisma.obraContractor.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit
                }),
                prisma.obraContractor.count({ where })
            ]);

            return ApiResponse.paginated(res, contractors, {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            });
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al listar autónomos', 500);
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const contractor = await prisma.obraContractor.findUnique({
                where: { id },
                include: { _count: { select: { expenses: true } } }
            });
            if (!contractor) return ApiResponse.error(res, 'Autónomo no encontrado', 404);
            return ApiResponse.success(res, contractor);
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al obtener el autónomo', 500);
        }
    },

    create: async (req: Request, res: Response) => {
        try {
            const userId = (req as AuthenticatedRequest).user?.id;
            if (!userId) throw new AppError('Usuario no autenticado', 401);

            const { name, nif, vatRate, irpfRate, iban, activity, email, phone, address, notes } = req.body || {};

            let contractor;
            try {
                contractor = await prisma.obraContractor.create({
                    data: {
                        name,
                        nif,
                        vatRate: vatRate ?? null,
                        irpfRate: irpfRate ?? null,
                        iban: iban ?? null,
                        activity: activity ?? null,
                        email: email ?? null,
                        phone: phone ?? null,
                        address: address ?? null,
                        notes: notes ?? null,
                        active: true
                    }
                });
            } catch (e: unknown) {
                if (e !== null && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
                    throw new AppError('Ya existe un autónomo con ese NIF/CIF', 409);
                }
                throw e;
            }

            await AuditService.logWithContext('CREATE', 'OBRA_CONTRACTOR', contractor.id, {
                userId,
                ...ctx(req),
                metadata: { name: contractor.name, nif: contractor.nif }
            });

            return ApiResponse.success(res, contractor, 'Autónomo creado', 201);
        } catch (err: unknown) {
            if (err instanceof AppError) return ApiResponse.error(res, err.message, err.statusCode);
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al crear el autónomo', 500);
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const userId = (req as AuthenticatedRequest).user?.id;
            if (!userId) throw new AppError('Usuario no autenticado', 401);
            const { id } = req.params;

            const existing = await prisma.obraContractor.findUnique({ where: { id } });
            if (!existing) return ApiResponse.error(res, 'Autónomo no encontrado', 404);

            const updateData: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(req.body || {})) {
                if (FORBIDDEN_UPDATE_KEYS.has(k)) continue;
                updateData[k] = v;
            }
            // El NIF/CIF no se puede vaciar: la columna es NOT NULL + @unique
            if ('nif' in updateData && !updateData.nif) {
                throw new AppError('NIF/CIF no válido', 400);
            }

            let updated;
            try {
                updated = await prisma.obraContractor.update({
                    where: { id },
                    data: updateData as Prisma.ObraContractorUpdateInput
                });
            } catch (e: unknown) {
                if (e !== null && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
                    throw new AppError('Ya existe un autónomo con ese NIF/CIF', 409);
                }
                throw e;
            }

            await AuditService.logWithContext('UPDATE', 'OBRA_CONTRACTOR', id, {
                userId,
                ...ctx(req),
                metadata: { fields: Object.keys(updateData) }
            });

            return ApiResponse.success(res, updated, 'Autónomo actualizado');
        } catch (err: unknown) {
            if (err instanceof AppError) return ApiResponse.error(res, err.message, err.statusCode);
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al actualizar el autónomo', 500);
        }
    },

    /**
     * Baja lógica: marca el autónomo como inactivo. No se borra la fila
     * porque los gastos de obra históricos la referencian.
     */
    delete: async (req: Request, res: Response) => {
        try {
            const userId = (req as AuthenticatedRequest).user?.id;
            if (!userId) throw new AppError('Usuario no autenticado', 401);
            const { id } = req.params;

            const existing = await prisma.obraContractor.findUnique({ where: { id } });
            if (!existing) return ApiResponse.error(res, 'Autónomo no encontrado', 404);

            const updated = await prisma.obraContractor.update({
                where: { id },
                data: { active: false }
            });

            await AuditService.logWithContext('DELETE', 'OBRA_CONTRACTOR', id, {
                userId,
                ...ctx(req),
                metadata: { softDelete: true, name: existing.name, nif: existing.nif }
            });

            return ApiResponse.success(res, updated, 'Autónomo desactivado');
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al desactivar el autónomo', 500);
        }
    }
};
