import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
    AccessTarget,
    canAccessPolicy,
    DomainPolicyKey,
    hasModuleAccess,
    normalizeActor,
    normalizeRole,
    PermissionLevel,
    PermissionModule
} from '../../../shared/authz';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, AuthUser } from '../types/express';
import { AppError } from '../utils/AppError';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET is not defined in environment variables.');
}

interface Cookies {
    access_token?: string;
    refresh_token?: string;
    csrf_token?: string;
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let token: string | undefined;
        const cookies = req.cookies as Cookies | undefined;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (cookies?.access_token) {
            token = cookies.access_token;
        }

        if (!token) {
            return next(new AppError('No estás autenticado. Por favor inicia sesión.', 401));
        }

        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; sessionVersion?: number };

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                role: true,
                permissions: true,
                employeeId: true,
                isActive: true,
                sessionVersion: true,
                employee: { select: { companyId: true } }
            }
        });

        if (!user) {
            return next(new AppError('El usuario perteneciente a este token ya no existe.', 401));
        }

        if (!user.isActive) {
            return next(new AppError('Tu cuenta ha sido desactivada. Contacta al administrador.', 401));
        }

        if (typeof decoded.sessionVersion !== 'number' || user.sessionVersion !== decoded.sessionVersion) {
            return next(new AppError('Tu sesión ha sido invalidada. Por favor, inicia sesión de nuevo.', 401));
        }

        let parsedPermissions: Record<string, PermissionLevel | 'admin'> = {};
        try {
            parsedPermissions = user.permissions ? JSON.parse(user.permissions as string) : {};
        } catch (parseError) {
            console.warn(`[AUTH] Invalid permissions JSON for user ${user.id}:`, parseError);
            parsedPermissions = {};
        }

        const normalized = normalizeActor({
            id: user.id,
            email: user.email,
            role: user.role,
            permissions: parsedPermissions,
            employeeId: user.employeeId,
            companyId: user.employee?.companyId
        });

        if (!normalized) {
            return next(new AppError('No se pudo normalizar el usuario autenticado.', 401));
        }

        const userWithParsedPermissions: AuthUser = {
            id: normalized.id || user.id,
            email: user.email,
            role: normalized.role,
            employeeId: normalized.employeeId,
            permissions: normalized.permissions,
            companyId: normalized.companyId
        };

        (req as AuthenticatedRequest).user = userWithParsedPermissions;
        next();
    } catch {
        next(new AppError('Token inválido o expirado.', 401));
    }
};

export const restrictTo = (...roles: string[]) => {
    const normalizedRoles = roles.map((role) => normalizeRole(role));

    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as AuthenticatedRequest).user;

        if (!user) {
            return next(new AppError('No estás autenticado.', 401));
        }

        if (!normalizedRoles.includes(user.role)) {
            return next(new AppError('No tienes permiso para realizar esta acción.', 403));
        }

        next();
    };
};

export const requireGlobalAdmin = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
        return next(new AppError('No estás autenticado.', 401));
    }

    if (user.role !== 'admin' || user.companyId) {
        return next(new AppError('Esta acción requiere un administrador global.', 403));
    }

    next();
};

export const checkPermission = (module: PermissionModule, level: PermissionLevel) => (req: Request, res: Response, next: NextFunction) => {
        const user = (req as AuthenticatedRequest).user;

        if (!user) {
            return next(new AppError('No estás autenticado.', 401));
        }

        if (!hasModuleAccess(user, module, level)) {
            return next(new AppError(`No tienes acceso al módulo ${module}.`, 403));
        }

        next();
    };

export const allowSelfOrRole = (roles: string[] = ['admin'], paramName = 'id') => {
    const normalizedRoles = roles.map((role) => normalizeRole(role));

    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as AuthenticatedRequest).user;
        const resourceId = req.params[paramName];

        if (!user) {
            return next(new AppError('No estás autenticado.', 401));
        }

        if (normalizedRoles.includes(user.role)) {
            return next();
        }

        if (user.employeeId && user.employeeId === resourceId) {
            return next();
        }

        return next(new AppError('No tienes permiso para acceder a este recurso.', 403));
    };
};

type PolicyTargetResolver = (req: AuthenticatedRequest) => Promise<AccessTarget | null | undefined> | AccessTarget | null | undefined;

export const authorize = (policyKey: DomainPolicyKey, resolveTarget?: PolicyTargetResolver) => async (req: Request, res: Response, next: NextFunction) => {
        const authReq = req as AuthenticatedRequest;
        const user = authReq.user;

        if (!user) {
            return next(new AppError('No estás autenticado.', 401));
        }

        const target = resolveTarget ? await resolveTarget(authReq) : undefined;

        if (!canAccessPolicy(policyKey, user, target)) {
            return next(new AppError('No tienes permiso para realizar esta acción.', 403));
        }

        next();
    };
