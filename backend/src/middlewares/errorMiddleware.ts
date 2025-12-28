import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';

export const errorMiddleware = (
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (err instanceof AppError) {
        return ApiResponse.error(res, err.message, err.statusCode);
    }

    console.error('UNEXPECTED ERROR:', err);

    return ApiResponse.error(
        res,
        process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
        500
    );
};
