import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { protect, restrictTo, checkPermission, allowSelfOrRole } from '../middlewares/authMiddleware';

vi.mock('../lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn()
        }
    }
}));

describe('Auth Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockReq = {
            headers: {},
            cookies: {},
            params: {}
        };
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        mockNext = vi.fn();
    });

    describe('protect', () => {
        it('should call next with error when no token provided', async () => {
            await protect(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            const error = (mockNext as any).mock.calls[0][0];
            expect(error.message).toBe('No estás autenticado. Por favor inicia sesión.');
            expect(error.statusCode).toBe(401);
        });

        it('should call next with error when token is invalid', async () => {
            mockReq.headers = { authorization: 'Bearer invalid-token' };

            await protect(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            const error = (mockNext as any).mock.calls[0][0];
            expect(error.message).toBe('Token inválido o expirado.');
            expect(error.statusCode).toBe(401);
        });
    });

    describe('restrictTo', () => {
        it('should call next with error when user is not authenticated', () => {
            mockReq.user = undefined;
            const middleware = restrictTo('admin');

            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            const error = (mockNext as any).mock.calls[0][0];
            expect(error.message).toBe('No estás autenticado.');
            expect(error.statusCode).toBe(401);
        });

        it('should call next with error when user role does not match', () => {
            mockReq.user = { id: '123', role: 'employee' } as any;
            const middleware = restrictTo('admin');

            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            const error = (mockNext as any).mock.calls[0][0];
            expect(error.message).toBe('No tienes permiso para realizar esta acción.');
            expect(error.statusCode).toBe(403);
        });

        it('should call next without error when user has matching role', () => {
            mockReq.user = { id: '123', role: 'admin' } as any;
            const middleware = restrictTo('admin');

            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith();
        });
    });

    describe('checkPermission', () => {
        it('should call next with error when user is not authenticated', () => {
            mockReq.user = undefined;
            const middleware = checkPermission('employees', 'read');

            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            const error = (mockNext as any).mock.calls[0][0];
            expect(error.statusCode).toBe(401);
        });

        it('should call next with error when user lacks permission', () => {
            mockReq.user = { id: '123', role: 'employee', permissions: {} } as any;
            const middleware = checkPermission('employees', 'write');

            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            const error = (mockNext as any).mock.calls[0][0];
            expect(error.statusCode).toBe(403);
        });
    });

    describe('allowSelfOrRole', () => {
        it('should call next with error when user is not authenticated', () => {
            mockReq.user = undefined;
            const middleware = allowSelfOrRole(['admin']);

            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            const error = (mockNext as any).mock.calls[0][0];
            expect(error.statusCode).toBe(401);
        });

        it('should allow access when user has matching role', () => {
            mockReq.user = { id: '123', role: 'admin' } as any;
            const middleware = allowSelfOrRole(['admin']);

            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith();
        });

        it('should allow self access when user is accessing own resource', () => {
            mockReq.user = { id: '123', role: 'employee', employeeId: '123' } as any;
            mockReq.params = { id: '123' };
            const middleware = allowSelfOrRole(['admin']);

            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith();
        });

        it('should deny access when user lacks role and not accessing own resource', () => {
            mockReq.user = { id: '123', role: 'employee', employeeId: '456' } as any;
            mockReq.params = { id: '789' };
            const middleware = allowSelfOrRole(['admin']);

            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            const error = (mockNext as any).mock.calls[0][0];
            expect(error.statusCode).toBe(403);
        });
    });
});
