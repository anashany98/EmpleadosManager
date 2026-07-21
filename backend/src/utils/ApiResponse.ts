import { Response } from 'express';
import { PaginationMeta } from './pagination';

export class ApiResponse {
    static success(res: Response, data: any, message: string = 'Success', statusCode: number = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
        });
    }

    /**
     * Unified paginated success response.
     * Shape: { success: true, message, data: [...], meta: { total, page, limit, totalPages } }
     */
    static paginated<T>(
        res: Response,
        data: T[],
        meta: PaginationMeta,
        message: string = 'Success',
        statusCode: number = 200
    ) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            meta,
        });
    }

    static error(
        res: Response,
        message: string = 'Error',
        statusCode: number = 500,
        errors: any = null,
        correlationId?: string
    ) {
        return res.status(statusCode).json({
            success: false,
            message,
            errors,
            // MED-007: incluir el correlation ID en el body
            // para que el usuario lo reporte y soporte lo
            // encuentre en los logs. Se omite cuando es
            // undefined para no añadir ruido a respuestas
            // exitosas.
            ...(correlationId ? { correlationId } : {})
        });
    }
}
