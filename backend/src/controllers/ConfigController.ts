import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { BackupService } from '../services/BackupService';
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
