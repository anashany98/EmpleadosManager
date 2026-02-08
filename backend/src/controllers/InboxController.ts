import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { inboxService } from '../services/InboxService';
import { StorageService } from '../services/StorageService';
import { createLogger } from '../services/LoggerService';

const log = createLogger('InboxController');

export const InboxController = {
    getAllPending: async (req: Request, res: Response) => {
        try {
            // First sync with folder and poll emails
            inboxService.syncFolder().catch(err => log.error({ err }, 'Sync error'));
            inboxService.pollEmails().catch(err => log.error({ err }, 'Email poll error'));

            const pending = await prisma.inboxDocument.findMany({
                where: { processed: false },
                orderBy: { receivedAt: 'desc' }
            });
            return ApiResponse.success(res, pending);
        } catch (error) {
            log.error({ error }, 'Error getting pending documents');
            return ApiResponse.error(res, 'Error al obtener documentos pendientes');
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
            const fs = require('fs');
            const path = require('path');
            const inboxPath = path.join(__dirname, '../../data/inbox'); // Ensure this matches InboxService watched folder

            if (!fs.existsSync(inboxPath)) {
                fs.mkdirSync(inboxPath, { recursive: true });
            }

            const safeName = path.basename(req.file.originalname);
            const targetPath = path.join(inboxPath, safeName);
            fs.renameSync(req.file.path, targetPath);

            // InboxService watcher should pick it up automatically
            // But we can trigger a sync manually to be faster
            try {
                // Don't await this to avoid blocking the response if it takes too long or fails
                inboxService.syncFolder().catch(err => log.error({ err }, 'Sync error in background'));
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
            if (doc?.fileUrl) {
                await StorageService.deleteFile(doc.fileUrl);
            }
            await prisma.inboxDocument.delete({ where: { id } });
            return ApiResponse.success(res, null, 'Documento descartado');
        } catch (error) {
            return ApiResponse.error(res, 'Error al eliminar documento');
        }
    },

    download: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const doc = await prisma.inboxDocument.findUnique({ where: { id } });
            if (!doc || !doc.fileUrl) return ApiResponse.error(res, 'Documento no encontrado', 404);

            if (StorageService.provider === 'local') {
                const fs = require('fs');
                const path = require('path');
                const filePath = path.join(process.cwd(), 'uploads', doc.fileUrl);
                if (!fs.existsSync(filePath)) return ApiResponse.error(res, 'Archivo no encontrado', 404);
                return res.sendFile(filePath);
            }

            const signedUrl = await StorageService.getSignedDownloadUrl(doc.fileUrl);
            if (!signedUrl) return ApiResponse.error(res, 'No se pudo generar URL', 500);
            return res.redirect(signedUrl);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al descargar documento', 500);
        }
    }
};
