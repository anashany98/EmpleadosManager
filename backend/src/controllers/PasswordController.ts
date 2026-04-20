import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { EmailService } from '../services/EmailService';
import { coercePermissionMap, normalizeRole } from '../../../shared/authz';
import { validatePassword } from '../utils/passwordPolicy';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';
import { AuditService } from '../services/AuditService';

const log = createLogger('PasswordController');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET must be defined.');
}

const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: FRONTEND_URL must be defined in production.');
}

export const PasswordController = {
    requestReset: async (req: Request, res: Response) => {
        try {
            const { identifier } = req.body;
            if (!identifier) throw new AppError('DNI o Email requerido', 400);
            const trimmedId = identifier.trim();
            
            const employee = await prisma.employee.findFirst({
                where: {
                    OR: [
                        { dni: trimmedId },
                        { dni: trimmedId.toUpperCase() },
                        { email: trimmedId }
                    ]
                }
            });

            if (!employee) {
                log.debug({ identifier: trimmedId }, 'Password reset requested but no employee found');
                return ApiResponse.success(res, null, 'Si los datos coinciden, recibirás un correo con las instrucciones.');
            }

            if (!employee.email) {
                log.debug({ identifier: trimmedId }, 'Password reset: employee has no email');
                return ApiResponse.success(res, null, 'Si los datos coinciden, recibirás un correo con las instrucciones.');
            }

            const resetToken = jwt.sign({
                sub: employee.id,
                dni: employee.dni,
                type: 'PASSWORD_RESET'
            }, JWT_SECRET, { expiresIn: '15m' });

            const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

            const html = `
                <p>Hola ${employee.name},</p>
                <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
                <p>Haz clic en el siguiente enlace para continuar:</p>
                <p><a href="${resetLink}">${resetLink}</a></p>
                <p>Este enlace caduca en 15 minutos.</p>
                <p>Si no solicitaste este cambio, ignora este mensaje.</p>
            `;

            await EmailService.sendMail(
                employee.email,
                'Restablecimiento de contraseña',
                html
            );

            return ApiResponse.success(res, null, 'Si los datos coinciden, recibirás un correo con las instrucciones.');

        } catch (error: any) {
            log.error({ error }, 'Error processing password reset request');
            return ApiResponse.error(res, error.message || 'Error al procesar la solicitud', 500);
        }
    },

    reset: async (req: Request, res: Response) => {
        try {
            const { token, newPassword } = req.body;

            if (!token || !newPassword) {
                throw new AppError('Token y nueva contraseña requeridos', 400);
            }

            const policy = validatePassword(newPassword);
            if (!policy.ok) {
                throw new AppError(policy.message || 'Contraseña no válida', 400);
            }

            let payload: any;
            try {
                payload = jwt.verify(token, JWT_SECRET);
            } catch (e) {
                throw new AppError('El enlace ha expirado o es inválido', 400);
            }

            if (payload.type !== 'PASSWORD_RESET' || !payload.sub) {
                throw new AppError('Token inválido', 400);
            }

            const employeeId = payload.sub;
            const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
            if (!employee) throw new AppError('Empleado no encontrado', 404);

            let user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { employeeId: employee.id },
                        { dni: employee.dni }
                    ]
                }
            });

            const hashedPassword = await bcrypt.hash(newPassword, 10);

            if (user) {
                await prisma.$transaction([
                    prisma.user.update({
                        where: { id: user.id },
                        data: {
                            password: hashedPassword,
                            sessionVersion: { increment: 1 }
                        }
                    }),
                    prisma.refreshToken.updateMany({
                        where: { userId: user.id, revoked: false },
                        data: { revoked: true }
                    })
                ]);
            } else {
                await prisma.user.create({
                    data: {
                        email: employee.email || `${employee.dni}@system.local`,
                        dni: employee.dni,
                        password: hashedPassword,
                        role: normalizeRole('employee'),
                        employeeId: employee.id,
                        permissions: JSON.stringify(coercePermissionMap({}))
                    }
                });
            }

            return ApiResponse.success(res, null, 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.');

        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al restablecer contraseña', 400);
        }
    },

    generateAccess: async (req: Request, res: Response) => {
        try {
            const { user: requester } = req as AuthenticatedRequest;
            if (!requester || requester.role !== 'admin') {
                throw new AppError('No autorizado', 403);
            }
            const { employeeId } = req.body;

            if (!employeeId) throw new AppError('ID de empleado requerido', 400);

            const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
            if (!employee) throw new AppError('Empleado no encontrado', 404);
            if (!employee.dni) throw new AppError('El empleado no tiene DNI registrado', 400);

            const welcomeToken = jwt.sign({
                sub: employee.id,
                dni: employee.dni,
                type: 'PASSWORD_RESET'
            }, JWT_SECRET, { expiresIn: '7d' });

            const loginUrl = `${FRONTEND_URL}/reset-password?token=${welcomeToken}`;

            if (employee.email) {
                const html = `
                    <p>Hola ${employee.name},</p>
                    <p>Se ha habilitado tu acceso al portal del empleado.</p>
                    <p>Para activar tu cuenta y establecer tu contraseña, haz clic en el siguiente enlace:</p>
                    <p><a href="${loginUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Activar Cuenta</a></p>
                    <p>O copia y pega esta dirección en tu navegador:</p>
                    <p>${loginUrl}</p>
                    <p>Este enlace es válido por 7 días.</p>
                `;

                await EmailService.sendMail(
                    employee.email,
                    'Bienvenido al Portal del Empleado - Activación de Cuenta',
                    html
                );

                await AuditService.log('ACCESS_GENERATED', 'USER', employee.id, { method: 'EMAIL_LINK' }, requester.id);
                return ApiResponse.success(res, { email: employee.email, hasEmail: true }, 'Invitación enviada por correo.');
            }

            if (process.env.NODE_ENV === 'production') {
                throw new AppError('El empleado no tiene email. No se pueden entregar credenciales de forma segura.', 400);
            }

            const mockLink = `/reset-password?token=${welcomeToken}`;
            return ApiResponse.success(res, {
                hasEmail: false,
                activationLink: mockLink
            }, 'Acceso generado. Copia el enlace de activación (SOLO DESARROLLO).');

        } catch (error: any) {
            log.error({ error }, 'Error generating access');
            return ApiResponse.error(res, error.message || 'Error al generar acceso', error.statusCode || 500);
        }
    }
};
