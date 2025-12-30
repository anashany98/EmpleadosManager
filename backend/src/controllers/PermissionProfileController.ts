import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';

export const PermissionProfileController = {
    list: async (req: Request, res: Response) => {
        const profiles = await prisma.permissionProfile.findMany({
            orderBy: { name: 'asc' }
        });

        const parsedProfiles = profiles.map(profile => ({
            ...profile,
            permissions: JSON.parse(profile.permissions)
        }));

        return ApiResponse.success(res, parsedProfiles);
    },

    create: async (req: Request, res: Response) => {
        const { name, permissions } = req.body;

        if (!name || !permissions) {
            throw new AppError('El nombre y los permisos son obligatorios', 400);
        }

        const existingProfile = await prisma.permissionProfile.findUnique({ where: { name } });
        if (existingProfile) {
            throw new AppError('Ya existe un perfil con este nombre', 400);
        }

        const profile = await prisma.permissionProfile.create({
            data: {
                name,
                permissions: JSON.stringify(permissions)
            }
        });

        return ApiResponse.success(res, {
            ...profile,
            permissions: JSON.parse(profile.permissions)
        }, 'Perfil creado correctamente', 201);
    },

    update: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { name, permissions } = req.body;

        const data: any = {};
        if (name) data.name = name;
        if (permissions) data.permissions = JSON.stringify(permissions);

        const profile = await prisma.permissionProfile.update({
            where: { id },
            data
        });

        return ApiResponse.success(res, {
            ...profile,
            permissions: JSON.parse(profile.permissions)
        }, 'Perfil actualizado correctamente');
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        await prisma.permissionProfile.delete({ where: { id } });
        return ApiResponse.success(res, null, 'Perfil eliminado correctamente');
    }
};
