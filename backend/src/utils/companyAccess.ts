import { AuthUser } from '../types/express';
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
