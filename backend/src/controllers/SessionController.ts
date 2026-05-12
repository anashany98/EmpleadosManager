import { Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthenticatedRequest } from '../types/express';
import { issueCsrfToken } from '../middlewares/csrfMiddleware';

const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'csrf_token';

export const SessionController = {
    getMe: async (req: Request, res: Response) => {
        try {
            const existing = (req as any).cookies?.[CSRF_COOKIE_NAME];
            if (!existing) issueCsrfToken(res);
            
            const { user } = req as AuthenticatedRequest;
            if (!user) {
                throw new AppError('No estás autenticado', 401);
            }

            return ApiResponse.success(res, user);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al obtener usuario', error.statusCode || 401);
        }
    }
};