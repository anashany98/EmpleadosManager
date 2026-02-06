import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { validatePassword } from '../utils/passwordPolicy';

export const UserController = {
    list: async (req: Request, res: Response) => {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                role: true,
                permissions: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' }
        });

        const parsedUsers = users.map(user => {
            let parsed: any = {};
            try {
                parsed = user.permissions ? JSON.parse(user.permissions) : {};
            } catch {
                parsed = {};
            }
            return {
                ...user,
                permissions: parsed
            };
        });

        return ApiResponse.success(res, parsedUsers);
    },

    create: async (req: Request, res: Response) => {
        const { email, password, role, permissions } = req.body;

        if (!email || !password) {
            throw new AppError('Email y contraseña son obligatorios', 400);
        }

        const policy = validatePassword(password);
        if (!policy.ok) {
            throw new AppError(policy.message || 'Contraseña no válida', 400);
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new AppError('El usuario ya existe', 400);
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                role: role || 'user',
                permissions: permissions ? JSON.stringify(permissions) : null
            }
        });

        const { password: _, ...userWithoutPassword } = user;
        return ApiResponse.success(res, userWithoutPassword, 'Usuario creado correctamente', 201);
    },

    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { email, password, role, permissions } = req.body;

        const data: any = {};
        if (email) data.email = email;
        if (role) data.role = role;
        if (permissions) data.permissions = JSON.stringify(permissions);
        if (password) {
            const policy = validatePassword(password);
            if (!policy.ok) {
                throw new AppError(policy.message || 'Contraseña no válida', 400);
            }
            data.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id },
            data
        });

        const { password: _, ...userWithoutPassword } = user;
        return ApiResponse.success(res, userWithoutPassword, 'Usuario actualizado correctamente');
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;

        // Prevent deleting the last admin or the current user (if needed)
        // For now simple delete
        const userToDelete = await prisma.user.findUnique({ where: { id } });
        if (!userToDelete) {
            throw new AppError('Usuario no encontrado', 404);
        }

        if (userToDelete.role === 'admin') {
            const adminCount = await prisma.user.count({ where: { role: 'admin' } });
            if (adminCount <= 1) {
                throw new AppError('No se puede eliminar el último administrador', 400);
            }
        }

        await prisma.user.delete({ where: { id } });

        return ApiResponse.success(res, null, 'Usuario eliminado correctamente');
    }
};
