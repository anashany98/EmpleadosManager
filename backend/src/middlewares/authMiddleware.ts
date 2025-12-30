import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-123';

export const protect = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.query.token) {
            token = req.query.token as string;
        }

        if (!token) {
            return next(new AppError('No estás autenticado. Por favor inicia sesión.', 401));
        }

        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, role: true, permissions: true } // Include permissions
        });

        if (!user) {
            return next(new AppError('El usuario perteneciente a este token ya no existe.', 401));
        }

        // Parse permissions from string to object if they exist
        const userWithParsedPermissions = {
            ...user,
            permissions: user.permissions ? JSON.parse(user.permissions as string) : {}
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

        const permissions = JSON.parse(user.permissions);
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
