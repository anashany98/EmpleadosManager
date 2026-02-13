import { Request } from 'express';

/**
 * User object attached to request after authentication
 */
export interface AuthUser {
    id: string;
    email: string;
    name?: string;
    role: 'admin' | 'hr' | 'employee' | 'manager';
    employeeId?: string;
    companyId?: string;
    permissions?: Record<string, 'none' | 'read' | 'write'>;
}

/**
 * Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
    user: AuthUser;
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
