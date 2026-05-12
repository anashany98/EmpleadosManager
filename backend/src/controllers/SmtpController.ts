import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { EmailService } from '../services/EmailService';
import { createLogger } from '../services/LoggerService';

const log = createLogger('SmtpController');

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

export const SmtpController = {
    getSmtpConfig: async (req: Request, res: Response) => {
        try {
            const configs = await prisma.configuration.findMany({
                where: {
                    key: { in: SMTP_KEYS }
                }
            });

            const configMap: Record<string, string> = {};
            configs.forEach(config => {
                try {
                    configMap[config.key] = JSON.parse(config.value);
                } catch {
                    configMap[config.key] = config.value;
                }
            });

            delete configMap['SMTP_PASS'];

            return ApiResponse.success(res, configMap);
        } catch (error) {
            log.error({ error }, 'Error fetching SMTP config');
            return ApiResponse.error(res, 'Error al obtener configuración SMTP');
        }
    },

    saveSmtpConfig: async (req: Request, res: Response) => {
        const { host, port, secure, user, pass, from } = req.body;

        try {
            for (const [key, value] of Object.entries({
                SMTP_HOST: host,
                SMTP_PORT: String(port || 587),
                SMTP_SECURE: String(secure || false),
                SMTP_USER: user,
                SMTP_PASS: pass,
                SMTP_FROM: from
            })) {
                await prisma.configuration.upsert({
                    where: { key },
                    update: { value: String(value) },
                    create: { key, value: String(value) }
                });
            }

            return ApiResponse.success(res, null, 'Configuración SMTP guardada');
        } catch (error) {
            log.error({ error }, 'Error saving SMTP config');
            return ApiResponse.error(res, 'Error al guardar configuración SMTP');
        }
    },

    testSmtpConfig: async (req: Request, res: Response) => {
        const { to } = req.body;

        if (!to) {
            return ApiResponse.error(res, 'Email de destino requerido', 400);
        }

        try {
            const testResult = await EmailService.sendTestEmail(to);
            return ApiResponse.success(res, testResult, 'Email de prueba enviado');
        } catch (error: any) {
            log.error({ error }, 'Error sending test email');
            return ApiResponse.error(res, error.message || 'Error al enviar email de prueba');
        }
    }
};