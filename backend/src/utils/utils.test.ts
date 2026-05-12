import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AppError } from './AppError';
import { ApiResponse } from './ApiResponse';
import { validatePassword } from './passwordPolicy';

describe('AppError', () => {
    it('should create error with message and status code', () => {
        const error = new AppError('Not Found', 404);
        
        expect(error.message).toBe('Not Found');
        expect(error.statusCode).toBe(404);
        expect(error.isOperational).toBe(true);
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AppError);
    });

    it('should default to 500 status code', () => {
        const error = new AppError('Server Error');
        
        expect(error.statusCode).toBe(500);
    });

    it('should allow custom isOperational flag', () => {
        const operationalError = new AppError('Op Error', 400, true);
        const programmingError = new AppError('Prog Error', 500, false);
        
        expect(operationalError.isOperational).toBe(true);
        expect(programmingError.isOperational).toBe(false);
    });

        it('should capture stack trace', () => {
            const error = new AppError('Test');
            
            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('utils.test.ts');
        });
});

describe('ApiResponse', () => {
    let mockRes: Partial<Response>;
    let jsonMock: ReturnType<typeof vi.fn>;
    let statusMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        jsonMock = vi.fn();
        statusMock = vi.fn().mockReturnValue({ json: jsonMock });
        mockRes = {
            status: statusMock,
            json: jsonMock
        };
    });

    describe('success', () => {
        it('should return success response with default values', () => {
            ApiResponse.success(mockRes as Response, { id: 1 });

            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'Success',
                data: { id: 1 }
            });
        });

        it('should return success response with custom message', () => {
            ApiResponse.success(mockRes as Response, { id: 1 }, 'Created successfully');

            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Created successfully'
            }));
        });

        it('should return success response with custom status code', () => {
            ApiResponse.success(mockRes as Response, { id: 1 }, 'Created', 201);

            expect(statusMock).toHaveBeenCalledWith(201);
        });

        it('should handle null data', () => {
            ApiResponse.success(mockRes as Response, null);

            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                data: null
            }));
        });

        it('should handle array data', () => {
            ApiResponse.success(mockRes as Response, [1, 2, 3]);

            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                data: [1, 2, 3]
            }));
        });
    });

    describe('error', () => {
        it('should return error response with default values', () => {
            ApiResponse.error(mockRes as Response, 'Something went wrong');

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Something went wrong',
                errors: null
            });
        });

        it('should return error response with custom status code', () => {
            ApiResponse.error(mockRes as Response, 'Not found', 404);

            expect(statusMock).toHaveBeenCalledWith(404);
        });

        it('should return error response with errors array', () => {
            ApiResponse.error(mockRes as Response, 'Validation failed', 400, ['Field required']);

            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Validation failed',
                errors: ['Field required']
            });
        });

        it('should return 401 for unauthorized', () => {
            ApiResponse.error(mockRes as Response, 'Unauthorized', 401);

            expect(statusMock).toHaveBeenCalledWith(401);
        });

        it('should return 403 for forbidden', () => {
            ApiResponse.error(mockRes as Response, 'Forbidden', 403);

            expect(statusMock).toHaveBeenCalledWith(403);
        });
    });
});

describe('Password Policy', () => {
    describe('validatePassword', () => {
        it('should accept valid strong password', () => {
            const result = validatePassword('MyStr0ng@Pass!');
            expect(result.ok).toBe(true);
            expect(result.message).toBeUndefined();
        });

        it('should reject password shorter than 10 characters', () => {
            const result = validatePassword('Short1@');
            expect(result.ok).toBe(false);
            expect(result.message).toContain('al menos 10 caracteres');
        });

        it('should reject password with spaces', () => {
            const result = validatePassword('MyPass word1@');
            expect(result.ok).toBe(false);
            expect(result.message).toContain('espacios');
        });

        it('should reject password without uppercase', () => {
            const result = validatePassword('myweakpass1@');
            expect(result.ok).toBe(false);
            expect(result.message).toContain('mayúsculas');
        });

        it('should reject password without lowercase', () => {
            const result = validatePassword('MYWEAKPASS1@');
            expect(result.ok).toBe(false);
            expect(result.message).toContain('minúsculas');
        });

        it('should reject password without numbers', () => {
            const result = validatePassword('MyWeakPass@');
            expect(result.ok).toBe(false);
            expect(result.message).toContain('números');
        });

        it('should reject password without symbols', () => {
            const result = validatePassword('MyWeakPass1');
            expect(result.ok).toBe(false);
            expect(result.message).toContain('símbolo');
        });

        it('should reject empty password', () => {
            const result = validatePassword('');
            expect(result.ok).toBe(false);
        });

        it('should reject null password', () => {
            const result = validatePassword(null as any);
            expect(result.ok).toBe(false);
        });

        it('should accept password with various symbols', () => {
            const symbols = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'];
            
            symbols.forEach(symbol => {
                const result = validatePassword(`MyPassw0rd${symbol}`);
                expect(result.ok).toBe(true);
            });
        });

        it('should accept exactly 10 character password', () => {
            const result = validatePassword('Abcdefg1@#');
            expect(result.ok).toBe(true);
        });

        it('should accept long password', () => {
            const result = validatePassword('MyVeryLongAndSecurePassword123@!');
            expect(result.ok).toBe(true);
        });
    });
});
