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

    // Logging to file for debugging
    try {
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(__dirname, '../../error.log');
        const logMsg = `[${new Date().toISOString()}] ${err.stack || err}\n`;
        fs.appendFileSync(logPath, logMsg);
    } catch (e) {
        console.error('Failed to write to error log', e);
    }

    return ApiResponse.error(
        res,
        process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
        500
    );
};
