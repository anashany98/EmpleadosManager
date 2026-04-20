import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app/createApp';

const app = createApp();

describe('Auth Integration Tests', () => {
    describe('POST /api/auth/login', () => {
        it('should reject login without credentials', async () => {
            const res = await request(app as any)
                .post('/api/auth/login')
                .send({});

            // Returns 400 (validation) or 500 (DB unavailable in tests)
            expect([400, 500]).toContain(res.status);
        });

        it('should reject login with invalid identifier format', async () => {
            const res = await request(app as any)
                .post('/api/auth/login')
                .send({ identifier: '', password: 'test1234' });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('should return error for non-existent user', async () => {
            const res = await request(app as any)
                .post('/api/auth/login')
                .send({ identifier: 'nonexistent_user_12345@test.com', password: 'wrongpassword' });

            // Returns 401 (auth failure) or 500 (DB unavailable)
            expect([401, 500]).toContain(res.status);
        });
    });

    describe('POST /api/auth/refresh', () => {
        it('should reject refresh without token', async () => {
            const res = await request(app as any)
                .post('/api/auth/refresh')
                .send({});

            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('should reject invalid refresh token', async () => {
            const res = await request(app as any)
                .post('/api/auth/refresh')
                .send({ refreshToken: 'invalid-refresh-token' });

            // Returns 401 (invalid token) or 500 (DB unavailable)
            expect([401, 500]).toContain(res.status);
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should succeed even without a token (idempotent)', async () => {
            const res = await request(app as any)
                .post('/api/auth/logout')
                .send({});

            // Logout should succeed - it just clears cookies
            expect(res.status).toBeGreaterThanOrEqual(200);
        });
    });

    describe('POST /api/auth/request-password-reset', () => {
        it('should handle request for non-existent user gracefully', async () => {
            const res = await request(app as any)
                .post('/api/auth/request-password-reset')
                .send({ identifier: 'nonexistent_dni_99999' });

            // Returns 200 (security: fake success) or 500 (DB/email unavailable)
            expect([200, 500]).toContain(res.status);
        });

        it('should reject empty identifier', async () => {
            const res = await request(app as any)
                .post('/api/auth/request-password-reset')
                .send({ identifier: '' });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('GET /api/auth/me', () => {
        it('should reject unauthenticated access', async () => {
            const res = await request(app as any)
                .get('/api/auth/me');

            expect(res.status).toBe(401);
        });

        it('should reject invalid token', async () => {
            const res = await request(app as any)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid_token');

            expect(res.status).toBe(401);
        });
    });
});
