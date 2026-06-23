import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { createLogger } from '../services/LoggerService';

const log = createLogger('ErrorMiddleware');

export const errorMiddleware = (
    err: Error | AppError,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    if (err instanceof AppError) {
        return ApiResponse.error(res, err.message, err.statusCode);
    }

    // Logger estructurado (Sentry/Pino/JSON) en vez de console.error plano
    log.error(
        {
            err,
            path: req.path,
            method: req.method,
            requestId: (req as any).requestId
        },
        'Unexpected error'
    );

    return ApiResponse.error(
        res,
        process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
        500
    );
};