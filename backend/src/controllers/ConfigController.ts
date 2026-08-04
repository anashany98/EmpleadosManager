import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { BackupService } from '../services/BackupService';
import { inboxService } from '../services/InboxService';
import path from 'path';
import fs from 'fs';
import { createLogger } from '../services/LoggerService';

const log = createLogger('ConfigController');

export const ConfigController = {
    getConfig: async (req: Request, res: Response) => {
        const { key } = req.params;
        try {
            const config = await (prisma as any).configuration.findUnique({
                where: { key }
            });

            if (!config) {
                return ApiResponse.success(res, null);
            }

            return ApiResponse.success(res, JSON.parse(config.value));
        } catch (error) {
            log.error({ error }, 'Error fetching config');
            return ApiResponse.error(res, 'Error al obtener la configuración');
        }
    },

    saveConfig: async (req: Request, res: Response) => {
        const { key } = req.params;
        const value = req.body;

        try {
            const config = await prisma.configuration.upsert({
                where: { key },
                update: { value: JSON.stringify(value) },
                create: {
                    key,
                    value: JSON.stringify(value)
                }
            });

            return ApiResponse.success(res, JSON.parse(config.value), 'Configuración guardada correctamente');
        } catch (error) {
            log.error({ error }, 'Error saving config');
            return ApiResponse.error(res, 'Error al guardar la configuración');
        }
    },

    // Prueba la conexión IMAP con los datos del formulario (o los guardados si
    // no se envían) y devuelve el nº de correos sin leer, o el error real de
    // conexión para que el usuario pueda diagnosticar por qué no llega nada.
    testImap: async (req: Request, res: Response) => {
        try {
            let imap = (req.body as any)?.imap;
            if (!imap) {
                const entry = await (prisma as any).configuration.findUnique({ where: { key: 'inbox_settings' } });
                if (entry) imap = JSON.parse(entry.value)?.imap;
            }
            if (!imap?.host || !imap?.user) {
                return ApiResponse.error(res, 'Configura el servidor IMAP y el usuario antes de probar la conexión.', 400);
            }
            const result = await inboxService.testImapConnection(imap);
            return ApiResponse.success(res, result, `Conexión IMAP correcta. ${result.unread} correo(s) sin leer en la bandeja.`);
        } catch (error: any) {
            log.error({ error }, 'IMAP connection test failed');
            return ApiResponse.error(res, error.message || 'Error al probar la conexión IMAP');
        }
    },

    createBackup: async (req: Request, res: Response) => {
        const { type } = req.body; // 'SNAPSHOT' | 'FULL'
        try {
            const result = type === 'FULL'
                ? await BackupService.createFullBackup()
                : await BackupService.createSnapshot();

            return ApiResponse.success(res, result, 'Backup creado correctamente');
        } catch (error) {
            log.error({ error }, 'Error creating backup');
            return ApiResponse.error(res, 'Error al crear el backup');
        }
    },

    getBackups: async (req: Request, res: Response) => {
        try {
            const backups = await BackupService.getBackups();
            return ApiResponse.success(res, backups);
        } catch (error) {
            log.error({ error }, 'Error listing backups');
            return ApiResponse.error(res, 'Error al listar backups');
        }
    },

    downloadBackup: async (req: Request, res: Response) => {
        const { filename, type } = req.query;
        if (!filename || !type) return ApiResponse.error(res, 'Faltan parámetros');

        const folder = type === 'FULL' ? 'full' : type === 'SNAPSHOT' ? 'snapshots' : null;
        if (!folder) return ApiResponse.error(res, 'Tipo inválido', 400);

        const safeName = path.basename(filename as string);
        if (safeName !== filename) return ApiResponse.error(res, 'Nombre de archivo inválido', 400);

        const filePath = path.join(process.cwd(), 'backups', folder, safeName);

        if (!fs.existsSync(filePath)) {
            return ApiResponse.error(res, 'Archivo no encontrado', 404);
        }

        res.download(filePath);
    }
};
