import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';

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
            console.error(error);
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
            console.error(error);
            return ApiResponse.error(res, 'Error al guardar la configuración');
        }
    }
};
