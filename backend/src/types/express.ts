import { Request } from 'express';
import { PermissionMap, Role } from '../../../shared/authz';

/**
 * User object attached to request after authentication
 */
export interface AuthUser {
    id: string;
    email: string;
    name?: string;
    role: Role;
    employeeId?: string;
    companyId?: string;
    permissions?: PermissionMap;
}

/**
 * Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
    user: AuthUser;
    obraOverride?: string | null;
}

/**
 * Type guard to check if request has authenticated user
 */
export function isAuthenticated(req: Request): req is AuthenticatedRequest {
    return !!(req as AuthenticatedRequest).user;
}

/**
 * Common pagination parameters
 */
export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

/**
 * Standard API response format
 */
export interface ApiResponseData<T = unknown> {
    status: 'success' | 'error';
    data?: T;
    message?: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
