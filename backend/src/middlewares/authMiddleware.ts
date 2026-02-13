import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET is not defined in environment variables.');
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if ((req as any).cookies?.access_token) {
            token = (req as any).cookies.access_token as string;
        }

        if (!token) {
            return next(new AppError('No estás autenticado. Por favor inicia sesión.', 401));
        }

        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                role: true,
                permissions: true,
                employeeId: true,
                dni: true,
                employee: { select: { companyId: true } }
            } // Include employee links
        });

        if (!user) {
            return next(new AppError('El usuario perteneciente a este token ya no existe.', 401));
        }

        // Parse permissions from string to object if they exist
        let parsedPermissions: any = {};
        try {
            parsedPermissions = user.permissions ? JSON.parse(user.permissions as string) : {};
        } catch {
            parsedPermissions = {};
        }

        const userWithParsedPermissions = {
            ...user,
            permissions: parsedPermissions,
            companyId: user.employee?.companyId
        };

        (req as any).user = userWithParsedPermissions;
        next();
    } catch (error) {
        next(new AppError('Token inválido o expirado.', 401));
    }
};

export const restrictTo = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!roles.includes(user.role)) {
            return next(new AppError('No tienes permiso para realizar esta acción.', 403));
        }
        next();
    };
};

export const checkPermission = (module: string, level: 'read' | 'write') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        // Admin has full access
        if (user.role === 'admin') return next();

        if (!user.permissions) {
            return next(new AppError('No tienes permisos configurados.', 403));
        }

        let permissions: any = {};
        try {
            permissions = typeof user.permissions === 'string'
                ? JSON.parse(user.permissions)
                : user.permissions;
        } catch {
            permissions = {};
        }

        const userLevel = permissions[module] || 'none';

        if (level === 'write' && userLevel !== 'write') {
            return next(new AppError(`No tienes permiso de escritura en el módulo ${module}.`, 403));
        }

        if (level === 'read' && userLevel === 'none') {
            return next(new AppError(`No tienes acceso al módulo ${module}.`, 403));
        }

        next();
    };
};

export const allowSelfOrRole = (roles: string[] = ['admin'], paramName: string = 'id') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        const resourceId = req.params[paramName];

        // 1. Check if user has allowed role
        if (roles.includes(user.role)) {
            return next();
        }

        // 2. Check if user owns the resource (Self-Service)
        // user.employeeId should match the requested ID
        if (user.employeeId && user.employeeId === resourceId) {
            return next();
        }

        return next(new AppError('No tienes permiso para acceder a este recurso.', 403));
    };
};
