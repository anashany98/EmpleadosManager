import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { AuthController } from '../../controllers/AuthController';
import { AuthService } from '../../services/AuthService';
import { AppError } from '../../utils/AppError';

// Mock AuthService
vi.mock('../../services/AuthService', () => ({
    AuthService: {
        login: vi.fn(),
    }
}));

// Mock ApiResponse
vi.mock('../../utils/ApiResponse', () => ({
    ApiResponse: {
        success: vi.fn((res, data) => res.status(200).json({ status: 'success', data })),
        error: vi.fn((res, msg, code) => res.status(code).json({ message: msg })),
    }
}));

// Setup Express App
const app = express();
app.use(express.json());
app.post('/api/auth/login', AuthController.login);

describe('Auth Integration (Controller -> Service)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should login successfully when Service returns data', async () => {
        const mockServiceResponse = {
            user: { id: 'user-123', email: 'test@example.com', role: 'admin' },
            accessToken: 'mock-access',
            refreshToken: 'mock-refresh',
            expiresAt: new Date(),
        };

        (AuthService.login as any).mockResolvedValue(mockServiceResponse);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.token).toBe('mock-access');
        expect(AuthService.login).toHaveBeenCalledWith('test@example.com', 'password');
    });

    it('should return 401 when Service throws error', async () => {
        (AuthService.login as any).mockRejectedValue(new AppError('Credenciales incorrectas', 401));

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'wrong' });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Credenciales incorrectas');
    });
});
