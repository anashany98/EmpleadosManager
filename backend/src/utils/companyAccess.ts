import { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest, AuthUser } from '../types/express';
import { prisma } from '../lib/prisma';
import { AppError } from './AppError';

export function isGlobalAdmin(user?: AuthUser | null): boolean {
    return Boolean(user && user.role === 'admin' && !user.companyId);
}

export function canAccessCompany(user: AuthUser | null | undefined, companyId?: string | null): boolean {
    if (isGlobalAdmin(user)) {
        return true;
    }

    if (!user?.companyId || !companyId) {
        return false;
    }

    return user.companyId === companyId;
}

export function assertCompanyAccess(user: AuthUser | null | undefined, companyId?: string | null, message = 'No autorizado'): void {
    if (!canAccessCompany(user, companyId)) {
        throw new AppError(message, 403);
    }
}

export function assertGlobalAdmin(user: AuthUser | null | undefined, message = 'Esta acción requiere un administrador global.'): void {
    if (!isGlobalAdmin(user)) {
        throw new AppError(message, 403);
    }
}

function normalizeRequestedCompanyId(requestedCompanyId?: string | null): string | undefined {
    if (!requestedCompanyId) {
        return undefined;
    }

    const normalized = requestedCompanyId.trim();
    return normalized.length > 0 ? normalized : undefined;
}

export function resolveAuthorizedCompanyId(
    user: AuthUser | null | undefined,
    requestedCompanyId?: string | null,
    message = 'No autorizado para acceder a otra empresa'
): string | undefined {
    const normalizedCompanyId = normalizeRequestedCompanyId(requestedCompanyId);

    if (normalizedCompanyId) {
        if (isGlobalAdmin(user)) {
            return normalizedCompanyId;
        }

        assertCompanyAccess(user, normalizedCompanyId, message);
        return normalizedCompanyId;
    }

    if (isGlobalAdmin(user)) {
        return undefined;
    }

    if (user?.companyId) {
        return user.companyId;
    }

    throw new AppError('Usuario sin empresa asignada', 403);
}

/**
 * Get the company ID to filter queries based on user role.
 * Returns undefined for global admins (no filter needed),
 * the user's companyId otherwise. Use in Prisma `where` clauses.
 */
export function getCompanyFilter(user: AuthUser | null | undefined): string | undefined {
    if (!user) return undefined;
    if (isGlobalAdmin(user)) return undefined;
    return user.companyId;
}

/**
 * Express middleware to verify the authenticated user has access to the
 * company of a target employee (looked up from a route param).
 * Use in routes that operate on employee data: /api/employees/:id/*
 */
// eslint-disable-next-line arrow-body-style
export const requireEmployeeCompanyAccess = (paramName: string = 'id'): ((req: Request, res: Response, next: NextFunction) => Promise<void>) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = (req as AuthenticatedRequest).user;
            if (!user) {
                return next(new AppError('No estás autenticado.', 401));
            }

            // Global admin can access anything
            if (isGlobalAdmin(user)) {
                return next();
            }

            const targetId = req.params[paramName];
            if (!targetId) {
                return next(new AppError('Target ID not provided', 400));
            }

            const employee = await prisma.employee.findUnique({
                where: { id: targetId },
                select: { companyId: true }
            });

            if (!employee) {
                return next(new AppError('Recurso no encontrado', 404));
            }

            // Company-scoped user must match company
            if (user.companyId && employee.companyId !== user.companyId) {
                return next(new AppError('No tienes acceso a este recurso', 403));
            }

            next();
        } catch (error) {
            next(new AppError('Error verificando acceso', 500));
        }
    };
};
