import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';

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

        const parsedUsers = users.map(user => ({
            ...user,
            permissions: user.permissions ? JSON.parse(user.permissions) : {}
        }));

        return ApiResponse.success(res, parsedUsers);
    },

    create: async (req: Request, res: Response) => {
        const { email, password, role, permissions } = req.body;

        if (!email || !password) {
            throw new AppError('Email y contraseña son obligatorios', 400);
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
        await prisma.user.delete({ where: { id } });

        return ApiResponse.success(res, null, 'Usuario eliminado correctamente');
    }
};
