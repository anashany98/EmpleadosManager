import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { errorMiddleware } from './errorMiddleware';
import { AppError } from '../utils/AppError';

describe('Error Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockReq = {};
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        mockNext = vi.fn();
    });

    it('should handle AppError with correct status code', () => {
        const error = new AppError('Test error', 400);

        errorMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Test error'
        }));
    });

    it('should handle generic Error with 500 status in production', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const error = new Error('Internal error');

        errorMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Internal Server Error'
        }));

        process.env.NODE_ENV = originalEnv;
    });

    it('should expose error message in development mode', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const error = new Error('Detailed error message');

        errorMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Detailed error message'
        }));

        process.env.NODE_ENV = originalEnv;
    });

    it('should handle AppError with different status codes', () => {
        const statusCodes = [400, 401, 403, 404, 500];

        statusCodes.forEach(statusCode => {
            const error = new AppError(`Error ${statusCode}`, statusCode);
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };

            errorMiddleware(error, mockReq as Request, res as Response, mockNext);

            expect(res.status).toHaveBeenCalledWith(statusCode);
        });
    });
});
