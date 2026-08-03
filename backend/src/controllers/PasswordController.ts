import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { handleControllerError } from '../utils/controllerError';
import { EmailService } from '../services/EmailService';
import { coercePermissionMap, normalizeRole } from '../../../shared/authz';
import { validatePassword } from '../utils/passwordPolicy';
import { getBcryptRounds } from '../utils/bcryptRounds';
import { assertCompanyAccess } from '../utils/companyAccess';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';
import { AuditService } from '../services/AuditService';

const log = createLogger('PasswordController');

const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL) {
    throw new Error('FATAL: FRONTEND_URL must be defined.');
}

const PASSWORD_RESET_EXPIRES_MS = 15 * 60 * 1000;
const ACCESS_ACTIVATION_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

type PasswordTokenPurpose = 'PASSWORD_RESET' | 'ACCESS_ACTIVATION';

const hashPasswordToken = (token: string) =>
    crypto.createHash('sha256').update(token).digest('hex');

async function createOneTimePasswordToken(
    employeeId: string,
    purpose: PasswordTokenPurpose,
    expiresInMs: number
): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashPasswordToken(token);
    const now = new Date();

    await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
            where: {
                employeeId,
                purpose,
                usedAt: null
            },
            data: { usedAt: now }
        }),
        prisma.passwordResetToken.create({
            data: {
                tokenHash,
                employeeId,
                purpose,
                expiresAt: new Date(now.getTime() + expiresInMs)
            }
        })
    ]);

    return token;
}

async function consumeOneTimePasswordToken(token: string) {
    const tokenRecord = await prisma.passwordResetToken.findUnique({
        where: { tokenHash: hashPasswordToken(token) },
        include: { employee: true }
    });

    const now = new Date();
    if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt <= now) {
        throw new AppError('El enlace ha expirado o es invalido', 400);
    }

    const consumed = await prisma.passwordResetToken.updateMany({
        where: {
            id: tokenRecord.id,
            usedAt: null,
            expiresAt: { gt: now }
        },
        data: { usedAt: now }
    });

    if (consumed.count !== 1) {
        throw new AppError('El enlace ya ha sido utilizado', 400);
    }

    return tokenRecord.employee;
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
                        { dni: { equals: trimmedId, mode: 'insensitive' } },
                        { email: { equals: trimmedId, mode: 'insensitive' } }
                    ]
                }
            });

            if (!employee) {
                await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
                log.debug('Password reset requested but no employee found');
                return ApiResponse.success(res, null, 'Si los datos coinciden, recibiras un correo con las instrucciones.');
            }

            if (!employee.email) {
                await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
                log.debug('Password reset: employee has no email');
                return ApiResponse.success(res, null, 'Si los datos coinciden, recibiras un correo con las instrucciones.');
            }

            const resetToken = await createOneTimePasswordToken(
                employee.id,
                'PASSWORD_RESET',
                PASSWORD_RESET_EXPIRES_MS
            );
            const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

            const html = `
                <p>Hola ${employee.name},</p>
                <p>Hemos recibido una solicitud para restablecer tu contrasena.</p>
                <p>Haz clic en el siguiente enlace para continuar:</p>
                <p><a href="${resetLink}">${resetLink}</a></p>
                <p>Este enlace caduca en 15 minutos y solo se puede usar una vez.</p>
                <p>Si no solicitaste este cambio, ignora este mensaje.</p>
            `;

            await EmailService.sendMail(
                employee.email,
                'Restablecimiento de contrasena',
                html
            );

            return ApiResponse.success(res, null, 'Si los datos coinciden, recibiras un correo con las instrucciones.');
        } catch (error: any) {
            log.error({ error }, 'Error processing password reset request');
            return handleControllerError(res, error, 'Error al procesar la solicitud');
        }
    },

    reset: async (req: Request, res: Response) => {
        try {
            const { token, newPassword } = req.body;

            if (!token || !newPassword) {
                throw new AppError('Token y nueva contrasena requeridos', 400);
            }

            const policy = validatePassword(newPassword);
            if (!policy.ok) {
                throw new AppError(policy.message || 'Contrasena no valida', 400);
            }

            const employee = await consumeOneTimePasswordToken(token);
            if (!employee) throw new AppError('Empleado no encontrado', 404);

            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { employeeId: employee.id },
                        { dni: employee.dni }
                    ]
                }
            });

            const hashedPassword = await bcrypt.hash(newPassword, getBcryptRounds());

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
                    }),
                    prisma.passwordResetToken.updateMany({
                        where: {
                            employeeId: employee.id,
                            usedAt: null
                        },
                        data: { usedAt: new Date() }
                    })
                ]);
            } else {
                await prisma.$transaction([
                    prisma.user.create({
                        data: {
                            email: employee.email || `${employee.dni}@system.local`,
                            dni: employee.dni,
                            password: hashedPassword,
                            role: normalizeRole('employee'),
                            employeeId: employee.id,
                            permissions: JSON.stringify(coercePermissionMap({}))
                        }
                    }),
                    prisma.passwordResetToken.updateMany({
                        where: {
                            employeeId: employee.id,
                            usedAt: null
                        },
                        data: { usedAt: new Date() }
                    })
                ]);
            }

            return ApiResponse.success(res, null, 'Contrasena actualizada correctamente. Ya puedes iniciar sesion.');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al restablecer contrasena', error.statusCode || 400);
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

            // MED-1: un admin de empresa solo puede generar acceso para
            // empleados de SU empresa. `assertCompanyAccess` deja pasar a
            // admins globales y rechaza (403) a usuarios con empresa si el
            // empleado es de otra (o no tiene empresa asignada). Así se
            // evita enumerar empleados de otros tenants y filtrar su email.
            assertCompanyAccess(requester, employee.companyId, 'No tienes acceso a este empleado');

            if (!employee.dni) throw new AppError('El empleado no tiene DNI registrado', 400);

            const welcomeToken = await createOneTimePasswordToken(
                employee.id,
                'ACCESS_ACTIVATION',
                ACCESS_ACTIVATION_EXPIRES_MS
            );
            const loginUrl = `${FRONTEND_URL}/reset-password?token=${welcomeToken}`;

            if (employee.email) {
                const html = `
                    <p>Hola ${employee.name},</p>
                    <p>Se ha habilitado tu acceso al portal del empleado.</p>
                    <p>Para activar tu cuenta y establecer tu contrasena, haz clic en el siguiente enlace:</p>
                    <p><a href="${loginUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Activar Cuenta</a></p>
                    <p>O copia y pega esta direccion en tu navegador:</p>
                    <p>${loginUrl}</p>
                    <p>Este enlace es valido por 7 dias y solo se puede usar una vez.</p>
                `;

                await EmailService.sendMail(
                    employee.email,
                    'Bienvenido al Portal del Empleado - Activacion de Cuenta',
                    html
                );

                await AuditService.log('ACCESS_GENERATED', 'USER', employee.id, { method: 'EMAIL_LINK' }, requester.id);
                return ApiResponse.success(res, { email: employee.email, hasEmail: true }, 'Invitacion enviada por correo.');
            }

            if (process.env.NODE_ENV === 'production') {
                throw new AppError('El empleado no tiene email. No se pueden entregar credenciales de forma segura.', 400);
            }

            const mockLink = `/reset-password?token=${welcomeToken}`;
            return ApiResponse.success(res, {
                hasEmail: false,
                activationLink: mockLink
            }, 'Acceso generado. Copia el enlace de activacion (SOLO DESARROLLO).');
        } catch (error: any) {
            log.error({ error }, 'Error generating access');
            return handleControllerError(res, error, 'Error al generar acceso');
        }
    }
};
