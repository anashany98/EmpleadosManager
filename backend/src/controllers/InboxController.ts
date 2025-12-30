import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { inboxService } from '../services/InboxService';

export const InboxController = {
    getAllPending: async (req: Request, res: Response) => {
        try {
            // First sync with folder and poll emails
            await Promise.all([
                inboxService.syncFolder(),
                inboxService.pollEmails()
            ]);

            const pending = await prisma.inboxDocument.findMany({
                where: { processed: false },
                orderBy: { receivedAt: 'desc' }
            });
            return ApiResponse.success(res, pending);
        } catch (error) {
            console.error(error);
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
            console.error(error);
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

            const targetPath = path.join(inboxPath, req.file.originalname);
            fs.renameSync(req.file.path, targetPath);

            // InboxService watcher should pick it up automatically
            // But we can trigger a sync manually to be faster
            try {
                // Don't await this to avoid blocking the response if it takes too long or fails
                inboxService.syncFolder().catch(err => console.error('Sync error in background:', err));
            } catch (syncError) {
                console.warn('Sync warning after upload:', syncError);
            }

            return ApiResponse.success(res, { filename: req.file.originalname }, 'Archivo subido a la bandeja de entrada');
        } catch (error: any) {
            console.error(error);
            return ApiResponse.error(res, error.message || 'Error al subir el archivo', 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            await prisma.inboxDocument.delete({ where: { id } });
            // Note: We might want to delete the physical file too if it's a rejection
            return ApiResponse.success(res, null, 'Documento descartado');
        } catch (error) {
            return ApiResponse.error(res, 'Error al eliminar documento');
        }
    }
};
