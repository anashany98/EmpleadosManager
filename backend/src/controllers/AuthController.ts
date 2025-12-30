import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-123';
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // Short lived
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

const generateRefreshToken = () => {
    return crypto.randomBytes(40).toString('hex');
};

export const AuthController = {
    login: async (req: Request, res: Response) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                throw new AppError('Por favor, proporciona email y contraseña', 400);
            }

            const user = await prisma.user.findUnique({ where: { email } });

            if (!user || !(await bcrypt.compare(password, user.password))) {
                throw new AppError('Email o contraseña incorrectos', 401);
            }

            // Generate Access Token
            const accessToken = jwt.sign({ id: user.id }, JWT_SECRET, {
                expiresIn: ACCESS_TOKEN_EXPIRES_IN,
            });

            // Generate Refresh Token
            const refreshToken = generateRefreshToken();
            const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN);

            // Save Refresh Token to DB
            // Using as any to bypass potential EPERM type generation issues
            await (prisma as any).refreshToken.create({
                data: {
                    token: refreshToken,
                    userId: user.id,
                    expiresAt: expiresAt
                }
            });

            // Hide password
            const { password: _, ...userWithoutPassword } = user;

            return ApiResponse.success(res, {
                user: userWithoutPassword,
                token: accessToken,
                refreshToken
            }, 'Sesión iniciada correctamente');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al iniciar sesión', error.statusCode || 500);
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
