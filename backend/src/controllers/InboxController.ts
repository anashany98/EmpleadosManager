import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/express';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { inboxService } from '../services/InboxService';
import { StorageService } from '../services/StorageService';
import { createLogger } from '../services/LoggerService';
import { serveLocalUploadFile } from '../utils/fileDownload';

const log = createLogger('InboxController');

export const InboxController = {
    getAllPending: async (req: Request, res: Response) => {
        try {
            const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
            const page = Math.max(parseInt(req.query.page as string) || 1, 1);
            const skip = (page - 1) * limit;

            const user = (req as AuthenticatedRequest).user;
            const isGlobalAdmin = user?.role === 'admin' && !user?.companyId;

            // CRIT-002: los documentos con companyId:null (huérfanos)
            // SOLO son visibles al admin global. Cualquier usuario de
            // tenant solo ve los documentos de SU empresa. El bug
            // original usaba `OR: [{companyId: user.companyId}, {companyId: null}]`,
            // que filtraba los null como visibles para todos.
            const where: any = { processed: false };
            if (isGlobalAdmin) {
                // Sin filtro adicional: ve todo.
            } else if (user?.companyId) {
                where.companyId = user.companyId;
            } else {
                // Usuario autenticado sin empresa asignada y sin rol
                // global: no debería ver nada. Forzamos un filtro que
                // nunca matchea.
                where.companyId = '__none__';
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
        const user = (req as AuthenticatedRequest).user;

        if (!employeeId || !category) {
            return ApiResponse.error(res, 'Faltan datos obligatorios');
        }

        try {
            // CRIT-002: pasamos el actor para que el servicio valide
            // explícitamente que el inbox doc Y el empleado destino
            // pertenecen al tenant del actor.
            const document = await inboxService.assignDocument(id, employeeId, category, name, expiryDate, user);
            return ApiResponse.success(res, document, 'Documento asignado correctamente');
        } catch (error: unknown) {
            log.error({ error }, 'Error assigning document');
            const message = error instanceof Error ? error.message : 'Error al asignar documento';
            // 404 cuando es cross-tenant para no enumerar IDs ajenos
            const status = /otro tenant|ya fue procesado|sin empresa|ya procesado|no encontrad/i.test(message) ? 404 : 500;
            return ApiResponse.error(res, message, status);
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

            const companyId = (req as AuthenticatedRequest).user?.companyId || null;

            // InboxService watcher should pick it up automatically
            // But we can trigger a sync manually to be faster
            try {
                inboxService.processFile(targetPath, companyId).catch(err => log.error({ err }, 'Sync error in background'));
            } catch (syncError) {
                log.warn({ syncError }, 'Sync warning after upload');
            }

            return ApiResponse.success(res, { filename: req.file.originalname }, 'Archivo subido a la bandeja de entrada');
        } catch (error: unknown) {
            log.error({ error }, 'Error uploading file');
            return ApiResponse.error(res, error instanceof Error ? error.message : 'Error al subir el archivo', 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const doc = await prisma.inboxDocument.findUnique({ where: { id } });
            if (!doc) return ApiResponse.error(res, 'Documento no encontrado', 404);

            const user = (req as AuthenticatedRequest).user;
            const isGlobalAdmin = user?.role === 'admin' && !user?.companyId;

            // CRIT-002: el bug original era `if (... && doc.companyId && doc.companyId !== user.companyId)`,
            // que dejaba pasar docs con companyId:null. Ahora exigimos
            // ownership explícito: o el doc pertenece a mi tenant, o
            // soy admin global.
            const belongsToTenant = doc.companyId && doc.companyId === user?.companyId;
            if (!isGlobalAdmin && !belongsToTenant) {
                log.warn({ id, userId: user?.id, docCompanyId: doc.companyId }, 'Cross-tenant inbox delete blocked');
                return ApiResponse.error(res, 'Documento no encontrado', 404);
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

            const user = (req as AuthenticatedRequest).user;
            const isGlobalAdmin = user?.role === 'admin' && !user?.companyId;

            // CRIT-002: mismo fix que en delete. Sin companyId
            // coincidente o sin global admin, el doc no existe para
            // este actor.
            const belongsToTenant = doc.companyId && doc.companyId === user?.companyId;
            if (!isGlobalAdmin && !belongsToTenant) {
                log.warn({ id, userId: user?.id, docCompanyId: doc.companyId }, 'Cross-tenant inbox download blocked');
                return ApiResponse.error(res, 'Documento no encontrado', 404);
            }

            if (StorageService.provider === 'local') {
                // MED-007/barrido: usar el helper compartido que
                // valida contención de path (defense-in-depth
                // contra path traversal), sanitiza el nombre de
                // descarga y maneja errores de stream con callback
                // explícito (404 en ENOENT, 500 controlado en
                // otros casos).
                return serveLocalUploadFile(res, doc.fileUrl, {
                    downloadName: doc.originalName ?? undefined
                });
            }

            const signedUrl = await StorageService.getSignedDownloadUrl(doc.fileUrl);
            if (!signedUrl) return ApiResponse.error(res, 'No se pudo generar URL', 500);
            return res.redirect(signedUrl);
        } catch (error: unknown) {
            log.error({ error, id }, 'Error downloading inbox document');
            return ApiResponse.error(res, error instanceof Error ? error.message : 'Error al descargar documento', 500);
        }
    }
};
