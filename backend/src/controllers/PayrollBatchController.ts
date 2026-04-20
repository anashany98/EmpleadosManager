import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ExcelParser } from '../services/ExcelParser';
import { MappingService } from '../services/MappingService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuditService } from '../services/AuditService';
import { StorageService } from '../services/StorageService';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';
import { AppError } from '../utils/AppError';
import { withRetry } from '../utils/dbRetry';

const log = createLogger('PayrollBatchController');

export const PayrollBatchController = {
    upload: async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return ApiResponse.error(res, 'No se ha subido ningún archivo', 400);
            }

            const { user } = req as AuthenticatedRequest;
            const userId = user?.id || 'system';

            const buffer = req.file.buffer;
            const headers = await ExcelParser.getHeaders(buffer);

            const batch = await prisma.payrollImportBatch.create({
                data: {
                    year: new Date().getFullYear(),
                    month: new Date().getMonth() + 1,
                    sourceFilename: req.file.originalname,
                    createdById: userId,
                    status: 'UPLOADED'
                }
            });

            const { key } = await StorageService.saveBuffer({
                folder: `payroll/imports/${batch.id}`,
                originalName: req.file.originalname,
                buffer,
                contentType: req.file.mimetype
            });

            await prisma.payrollImportBatch.update({
                where: { id: batch.id },
                data: { sourceFileUrl: key }
            });

            await AuditService.log('UPLOAD', 'PAYROLL_BATCH', batch.id, { filename: req.file.originalname }, userId);

            return ApiResponse.success(res, {
                batchId: batch.id,
                headers,
                filename: key,
            }, 'Archivo subido correctamente. Por favor configura el mapeo.');

        } catch (error: any) {
            log.error({ error }, 'Error processing payroll upload');
            return ApiResponse.error(res, error.message || 'Error al procesar el archivo Excel', 500);
        }
    },

    applyMapping: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { mappingRules, filename } = req.body;
        const { user } = req as AuthenticatedRequest;
        const userId = user?.id || 'system';

        try {
            const batch = await prisma.payrollImportBatch.findUnique({
                where: { id },
                include: { createdBy: { include: { employee: true } } }
            });
            if (!batch) return ApiResponse.error(res, 'Lote no encontrado', 404);

            if (user.role !== 'admin') {
                const batchCompanyId = batch.createdBy?.employee?.companyId;
                if (!batchCompanyId || batchCompanyId !== user.companyId) {
                    throw new AppError('No tienes permiso para procesar este lote', 403);
                }
            }

            let buffer: Buffer | null = null;

            if (batch.sourceFileUrl) {
                buffer = await StorageService.getBuffer(batch.sourceFileUrl);
            } else if (filename) {
                const fs = await import('fs');
                const filePath = `uploads/${filename}`;
                try {
                    await fs.promises.access(filePath);
                    buffer = await fs.promises.readFile(filePath);
                } catch {
                    buffer = null;
                }
            }

            if (!buffer) {
                return ApiResponse.error(res, 'El archivo original ha caducado o no existe', 404);
            }

            const rawData = await ExcelParser.parseBuffer(buffer);
            const rowsData = MappingService.applyMapping(rawData, mappingRules, id);

            await withRetry(() => prisma.$transaction([
                prisma.payrollRow.deleteMany({ where: { batchId: id } }),
                prisma.payrollRow.createMany({
                    data: rowsData as any
                }),
                prisma.payrollImportBatch.update({
                    where: { id },
                    data: { status: 'MAPPED' }
                })
            ]), { operationName: 'applyPayrollMapping' });

            await AuditService.log('APPLY_MAPPING', 'PAYROLL_BATCH', id, { rowCount: rowsData.length }, userId);

            return ApiResponse.success(res, { rowsCreated: rowsData.length }, 'Mapeo aplicado correctamente');

        } catch (error: any) {
            log.error({ error }, 'Error applying mapping');
            return ApiResponse.error(res, error.message || 'Error al aplicar el mapeo', 500);
        }
    },

    getLatest: async (req: Request, res: Response) => {
        try {
            const { limit = 5 } = req.query;
            const { user } = req as AuthenticatedRequest;

            const whereClause: any = {};
            if (user.role !== 'admin') {
                if (!user.companyId) throw new AppError('Usuario sin empresa', 403);
                whereClause.createdBy = {
                    employee: {
                        companyId: user.companyId
                    }
                };
            }

            const batches = await prisma.payrollImportBatch.findMany({
                where: whereClause,
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: { rows: true }
                    },
                    createdBy: {
                        select: { email: true, role: true }
                    }
                }
            });

            const result = batches.map(b => ({
                id: b.id,
                name: b.sourceFilename,
                date: b.createdAt,
                status: b.status,
                rows: b._count.rows,
                user: b.createdBy?.email || 'System'
            }));

            return ApiResponse.success(res, result);
        } catch (error: any) {
            log.error({ error }, 'Error fetching batches');
            return ApiResponse.error(res, 'Error al obtener lotes');
        }
    },

    getRows: async (req: Request, res: Response) => {
        const { id } = req.params;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const { user } = req as AuthenticatedRequest;

        try {
            const batch = await prisma.payrollImportBatch.findUnique({
                where: { id },
                select: { createdBy: { select: { employee: { select: { companyId: true } } } } }
            });

            if (!batch) return ApiResponse.error(res, 'Lote no encontrado', 404);

            if (user.role !== 'admin') {
                const batchCompanyId = batch.createdBy?.employee?.companyId;
                if (batchCompanyId !== user.companyId) {
                    throw new AppError('No autorizado', 403);
                }
            }

            const skip = (page - 1) * limit;
            const rows = await prisma.payrollRow.findMany({
                where: { batchId: id },
                skip,
                take: limit,
                include: { items: true },
                orderBy: { id: 'asc' }
            });

            const total = await prisma.payrollRow.count({ where: { batchId: id } });
            const totalPages = Math.ceil(total / limit);

            return ApiResponse.success(res, { rows, totalPages, currentPage: page, total });
        } catch (error: any) {
            log.error({ error }, 'Error fetching rows');
            return ApiResponse.error(res, 'Error al obtener filas');
        }
    }
};