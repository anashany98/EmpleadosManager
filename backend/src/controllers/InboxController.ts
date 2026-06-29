import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { inboxService } from '../services/InboxService';
import { StorageService } from '../services/StorageService';
import { createLogger } from '../services/LoggerService';

const log = createLogger('InboxController');

export const InboxController = {
    getAllPending: async (req: Request, res: Response) => {
        try {
            const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
            const page = Math.max(parseInt(req.query.page as string) || 1, 1);
            const skip = (page - 1) * limit;

            const user = (req as any).user;
            const isGlobalAdmin = user?.role === 'admin' && !user?.companyId;

            const where: any = { processed: false };
            if (!isGlobalAdmin) {
                where.OR = [
                    { companyId: user?.companyId || null },
                    { companyId: null }
                ];
            }

            const [pending, total] = await Promise.all([
                prisma.inboxDocument.findMany({
                    where,
                    orderBy: { receivedAt: 'desc' },
                    take: limit,
                    skip
                }),
                prisma.inboxDocument.count({ where })
            ]);

            return ApiResponse.paginated(res, pending, {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            });
        } catch (error) {
            log.error({ error }, 'Error getting pending documents');
            return ApiResponse.error(res, 'Error al obtener documentos pendientes');
        }
    },

    triggerSync: async (_req: Request, res: Response) => {
        try {
            inboxService.syncFolder().catch(err => log.error({ err }, 'Sync error'));
            inboxService.pollEmails().catch(err => log.error({ err }, 'Email poll error'));
            return ApiResponse.success(res, null, 'Sincronización iniciada');
        } catch (error) {
            log.error({ error }, 'Error triggering sync');
            return ApiResponse.error(res, 'Error al iniciar sincronización');
        }
    },

    assign: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { employeeId, category, name, expiryDate } = req.body;

        if (!employeeId || !category) {
            return ApiResponse.error(res, 'Faltan datos obligatorios');
        }

        try {
            const document = await inboxService.assignDocument(id, employeeId, category, name, expiryDate);
            return ApiResponse.success(res, document, 'Documento asignado correctamente');
        } catch (error: any) {
            log.error({ error }, 'Error assigning document');
            return ApiResponse.error(res, error.message || 'Error al asignar documento');
        }
    },

    upload: async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return ApiResponse.error(res, 'No se ha subido ningún archivo', 400);
            }

            // Move file from temp to inbox
            const inboxPath = path.join(process.cwd(), 'data', 'inbox');

            if (!fs.existsSync(inboxPath)) {
                fs.mkdirSync(inboxPath, { recursive: true });
            }

            const ext = path.extname(req.file.originalname);
            const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
            const targetPath = path.join(inboxPath, safeName);
            fs.renameSync(req.file.path, targetPath);

            const companyId = (req as any).user?.companyId || null;

            // InboxService watcher should pick it up automatically
            // But we can trigger a sync manually to be faster
            try {
                inboxService.processFile(targetPath, companyId).catch(err => log.error({ err }, 'Sync error in background'));
            } catch (syncError) {
                log.warn({ syncError }, 'Sync warning after upload');
            }

            return ApiResponse.success(res, { filename: req.file.originalname }, 'Archivo subido a la bandeja de entrada');
        } catch (error: any) {
            log.error({ error }, 'Error uploading file');
            return ApiResponse.error(res, error.message || 'Error al subir el archivo', 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const doc = await prisma.inboxDocument.findUnique({ where: { id } });
            if (!doc) return ApiResponse.error(res, 'Documento no encontrado', 404);

            const user = (req as any).user;
            const isGlobalAdmin = user?.role === 'admin' && !user?.companyId;
            if (!isGlobalAdmin && doc.companyId && doc.companyId !== user?.companyId) {
                return ApiResponse.error(res, 'No tienes acceso a este documento', 403);
            }

            await prisma.inboxDocument.delete({ where: { id } });

            if (doc.fileUrl) {
                StorageService.deleteFile(doc.fileUrl).catch(err =>
                    log.warn({ err, fileUrl: doc.fileUrl }, 'Failed to delete file from storage after DB delete')
                );
            }
            return ApiResponse.success(res, null, 'Documento descartado');
        } catch (error) {
            log.error({ error, id }, 'Error deleting inbox document');
            return ApiResponse.error(res, 'Error al eliminar documento');
        }
    },

    download: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const doc = await prisma.inboxDocument.findUnique({ where: { id } });
            if (!doc || !doc.fileUrl) return ApiResponse.error(res, 'Documento no encontrado', 404);

            const user = (req as any).user;
            const isGlobalAdmin = user?.role === 'admin' && !user?.companyId;
            if (!isGlobalAdmin && doc.companyId && doc.companyId !== user?.companyId) {
                return ApiResponse.error(res, 'No tienes acceso a este documento', 403);
            }

            if (StorageService.provider === 'local') {
                const filePath = path.join(process.cwd(), 'uploads', doc.fileUrl);
                if (!fs.existsSync(filePath)) return ApiResponse.error(res, 'Archivo no encontrado', 404);
                return res.sendFile(filePath);
            }

            const signedUrl = await StorageService.getSignedDownloadUrl(doc.fileUrl);
            if (!signedUrl) return ApiResponse.error(res, 'No se pudo generar URL', 500);
            return res.redirect(signedUrl);
        } catch (error: any) {
            log.error({ error, id }, 'Error downloading inbox document');
            return ApiResponse.error(res, error.message || 'Error al descargar documento', 500);
        }
    }
};
