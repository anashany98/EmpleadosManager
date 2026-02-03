import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET must be defined.');
}
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // Short lived
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

const generateRefreshToken = () => {
    return crypto.randomBytes(40).toString('hex');
};

export const AuthController = {
    login: async (req: Request, res: Response) => {
        try {
            const { email, dni, password, identifier } = req.body;
            // Support 'identifier' generic field or specific email/dni fields
            const loginId = identifier || email || dni;

            if (!loginId || !password) {
                throw new AppError('Por favor, proporciona identificador y contraseña', 400);
            }

            // Search by Email OR DNI (trimmed and case-safe for DNI)
            const trimmedId = loginId.trim();
            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: trimmedId },
                        { dni: trimmedId }, // Exact match
                        { dni: trimmedId.toLowerCase() }, // Lowercase
                        { dni: trimmedId.toUpperCase() } // Uppercase
                    ]
                }
            });

            // Debug log (remove in prod)
            console.log(`[Login] Attempt for ${trimmedId}. User found: ${!!user}`);

            if (!user || !(await bcrypt.compare(password, user.password))) {
                throw new AppError('Credenciales incorrectas', 401);
            }

            // Generate Access Token
            const accessToken = jwt.sign({ id: user.id }, JWT_SECRET, {
                expiresIn: ACCESS_TOKEN_EXPIRES_IN,
            });

            // Generate Refresh Token
            const refreshToken = generateRefreshToken();
            const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN);

            // Save Refresh Token to DB
            console.log('[Login] Saving refresh token...');
            if (!(prisma as any).refreshToken) {
                console.error('[Login CRITICAL] prisma.refreshToken is undefined!');
                throw new Error('Prisma Client incomplete (refreshToken missing)');
            }

            await (prisma as any).refreshToken.create({
                data: {
                    token: refreshToken,
                    userId: user.id,
                    expiresAt: expiresAt
                }
            });
            console.log('[Login] Refresh token saved.');

            // Hide password
            const { password: _, ...userWithoutPassword } = user;

            return ApiResponse.success(res, {
                user: userWithoutPassword,
                token: accessToken,
                refreshToken
            }, 'Sesión iniciada correctamente');
        } catch (error: any) {
            console.error('[Login Error]', error);
            return ApiResponse.error(res, `INTERNAL ERROR: ${error.message}`, error.statusCode || 500, { stack: error.stack });
        }
    },

    // Generar/Habilitar Acceso para Empleado
    generateAccess: async (req: Request, res: Response) => {
        try {
            const { employeeId } = req.body;

            if (!employeeId) throw new AppError('ID de empleado requerido', 400);

            const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
            if (!employee) throw new AppError('Empleado no encontrado', 404);
            if (!employee.dni) throw new AppError('El empleado no tiene DNI registrado', 400);
            // if (!employee.email) throw new AppError('El empleado no tiene email personal para enviar las credenciales', 400);


            // Generate Random Password
            const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Check if user exists linked to this employee or DNI
            let user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { employeeId: employee.id },
                        { dni: employee.dni }
                    ]
                }
            });

            if (user) {
                // Update existing user
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        password: hashedPassword,
                        dni: employee.dni, // Ensure synced
                        employeeId: employee.id
                    }
                });
            } else {
                // Create new user
                const empEmail = employee.email || `${employee.dni}@system.local`;
                // Check if email is taken by another user (shouldn't happen 1:1 usually but check safety)
                const existingEmail = await prisma.user.findUnique({ where: { email: empEmail } });

                if (existingEmail) {
                    // Determine if we should link or fail. 
                    // Failing is safer to avoid account hijacking or confusion.
                    // But if the email matches, maybe it IS the user?
                    if (existingEmail.dni && existingEmail.dni !== employee.dni) {
                        throw new AppError('El email del empleado ya está asociado a otro usuario con diferente DNI', 400);
                    }
                    // If email exists but no DNI, maybe we upgrade it?
                    // Let's UPDATE it to link it.
                    user = await prisma.user.update({
                        where: { id: existingEmail.id },
                        data: {
                            dni: employee.dni,
                            employeeId: employee.id,
                            password: hashedPassword
                        }
                    });
                } else {
                    user = await prisma.user.create({
                        data: {
                            email: empEmail,
                            dni: employee.dni,
                            password: hashedPassword,
                            role: 'user', // Default role
                            employeeId: employee.id,
                            permissions: JSON.stringify({ dashboard: 'read', calendar: 'read' }) // Default permissions?
                        }
                    });
                }
            }

            // SIMULATE EMAIL SENDING
            if (employee.email) {
                console.log(`
                ==================================================
                [MOCK EMAIL SERVICE] SENDING TO: ${employee.email}
                SUBJECT: Credenciales de Acceso - Portal del Empleado
                --------------------------------------------------
                Hola ${employee.name},
    
                Se ha habilitado tu acceso al portal del empleado.
                
                Usuario (DNI): ${employee.dni}
                Contraseña: ${tempPassword}
    
                Accede aquí: http://localhost:5173/login
                ==================================================
                `);
                return ApiResponse.success(res, { email: employee.email, hasEmail: true }, 'Acceso generado. Credenciales enviadas por correo.');
            } else {
                // Return password directly if no email
                return ApiResponse.success(res, {
                    hasEmail: false,
                    password: tempPassword,
                    username: employee.dni
                }, 'Acceso generado. Copia la contraseña.');
            }

        } catch (error: any) {
            console.error(error);
            return ApiResponse.error(res, error.message || 'Error al generar acceso', error.statusCode || 500);
        }
    },

    refresh: async (req: Request, res: Response) => {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                throw new AppError('Refresh Token no proporcionado', 400);
            }

            // Find token in DB
            const storedToken = await (prisma as any).refreshToken.findUnique({
                where: { token: refreshToken },
                include: { user: true }
            });

            if (!storedToken || storedToken.revoked || new Date() > new Date(storedToken.expiresAt)) {
                // Should we revoke the family if reused? For now just deny.
                throw new AppError('Refresh Token inválido o expirado', 401);
            }

            const user = storedToken.user;

            // Generate new Access Token
            const newAccessToken = jwt.sign({ id: user.id }, JWT_SECRET, {
                expiresIn: ACCESS_TOKEN_EXPIRES_IN,
            });

            // Rotate Refresh Token (Optional security best practice: create new RT, revoke old one)
            // For simplicity in this phase, we keep the RT valid until expiry, 
            // OR we can rotate it. Let's rotate it for "App Excellence".

            const newRefreshToken = generateRefreshToken();
            const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN);

            // Revoke old
            await (prisma as any).refreshToken.update({
                where: { id: storedToken.id },
                data: { revoked: true }
            });

            // Create new
            await (prisma as any).refreshToken.create({
                data: {
                    token: newRefreshToken,
                    userId: user.id,
                    expiresAt: newExpiresAt
                }
            });

            return ApiResponse.success(res, {
                token: newAccessToken,
                refreshToken: newRefreshToken
            }, 'Token renovado correctamente');

        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al renovar token', 401);
        }
    },

    logout: async (req: Request, res: Response) => {
        try {
            const { refreshToken } = req.body;
            if (refreshToken) {
                // Revoke token if provided
                // Try catch in case it doesn't exist or is already deleted
                try {
                    // We don't delete, we revoke (soft delete principle for audit)
                    // But if we want to save space we could delete. Let's revoke.
                    // First find it to make sure it exists to avoid error on update
                    const found = await (prisma as any).refreshToken.findUnique({ where: { token: refreshToken } });
                    if (found) {
                        await (prisma as any).refreshToken.update({
                            where: { token: refreshToken },
                            data: { revoked: true }
                        });
                    }
                } catch (e) {
                    console.error("Error revoking token on logout", e);
                }
            }

            return ApiResponse.success(res, null, 'Sesión cerrada correctamente');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al cerrar sesión', 500);
        }
    },

    // --- SELF SERVICE PASSWORD RESET ---

    requestPasswordReset: async (req: Request, res: Response) => {
        try {
            const { identifier } = req.body;
            if (!identifier) throw new AppError('DNI o Email requerido', 400);
            const trimmedId = identifier.trim();
            // 1. Find Employee by DNI or Email (case-safe for DNI)
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
                // Security: Don't reveal if user exists. Fake success.
                // But for debugging, we might log it.
                console.log(`Password reset requested for "${trimmedId}" but no employee found.`);
                return ApiResponse.success(res, null, 'Si los datos coinciden, recibirás un correo con las instrucciones.');
            }

            if (!employee.email) {
                throw new AppError('El empleado no tiene un correo electrónico registrado. Contacta con RRHH.', 400);
            }

            // 2. Generate Reset Token (Short lived JWT)
            // Payload contains employee ID, so we know who to activate/reset
            const resetToken = jwt.sign({
                sub: employee.id,
                dni: employee.dni,
                type: 'PASSWORD_RESET'
            }, JWT_SECRET, { expiresIn: '15m' });

            // 3. "Send" Email
            const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

            console.log(`
            ==================================================
            PASSWORD RESET REQUEST FOR: ${employee.name} (${employee.email})
            --------------------------------------------------
            Link: ${resetLink}
            ==================================================
            `);

            // In a real app, use nodemailer here.

            return ApiResponse.success(res, { debugLink: resetLink }, 'Si los datos coinciden, recibirás un correo con las instrucciones.');

        } catch (error: any) {
            console.error(error);
            return ApiResponse.error(res, error.message || 'Error al procesar la solicitud', 500);
        }
    },

    resetPassword: async (req: Request, res: Response) => {
        try {
            const { token, newPassword } = req.body;

            if (!token || !newPassword) {
                throw new AppError('Token y nueva contraseña requeridos', 400);
            }

            // 1. Verify Token
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

            // 2. Find Employee
            const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
            if (!employee) throw new AppError('Empleado no encontrado', 404);

            // 3. Find or Create User
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
                // Update existing user
                await prisma.user.update({
                    where: { id: user.id },
                    data: { password: hashedPassword }
                });
            } else {
                // Create new user (Activation flow)
                await prisma.user.create({
                    data: {
                        email: employee.email || `${employee.dni}@system.local`, // Fallback
                        dni: employee.dni,
                        password: hashedPassword,
                        role: 'employee', // Default role
                        employeeId: employee.id,
                        permissions: JSON.stringify({}) // Default empty permissions
                    }
                });
            }

            return ApiResponse.success(res, null, 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.');

        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al restablecer contraseña', 400); // 400 likely for token errors
        }
    },

    getMe: async (req: Request, res: Response) => {
        try {
            // user is attached to req by protect middleware
            const user = (req as any).user;
            if (!user) {
                throw new AppError('No estás autenticado', 401);
            }

            return ApiResponse.success(res, user);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al obtener usuario', error.statusCode || 401);
        }
    }
};
