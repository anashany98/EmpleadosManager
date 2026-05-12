import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';

const createTestApp = () => {
    const app = express();
    app.use(express.json());

    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        message: {
            status: 429,
            message: 'Demasiados intentos de login'
        }
    });

    app.post('/login', loginLimiter, (req, res) => {
        const { validCredentials } = req.body;
        if (validCredentials) {
            return res.json({ success: true });
        }
        return res.status(401).json({ success: false });
    });

    return app;
};

describe('Rate Limiting', () => {
    it('should allow requests within limit', async () => {
        const app = createTestApp();

        for (let i = 0; i < 5; i++) {
            const res = await request(app)
                .post('/login')
                .send({ validCredentials: false });
            expect(res.status).not.toBe(429);
        }
    });

    it('should block requests exceeding limit', async () => {
        const app = createTestApp();

        for (let i = 0; i < 5; i++) {
            await request(app)
                .post('/login')
                .send({ validCredentials: false });
        }

        const res = await request(app)
            .post('/login')
            .send({ validCredentials: false });

        expect(res.status).toBe(429);
        expect(res.body.message).toContain('Demasiados intentos');
    });

    it('should include rate limit headers', async () => {
        const app = createTestApp();

        const res = await request(app)
            .post('/login')
            .send({ validCredentials: false });

        expect(res.headers['ratelimit-limit']).toBeDefined();
        expect(res.headers['ratelimit-remaining']).toBeDefined();
    });

    it('should not count successful requests when skipSuccessfulRequests is true', async () => {
        const app = createTestApp();

        await request(app).post('/login').send({ validCredentials: true });
        await request(app).post('/login').send({ validCredentials: true });
        await request(app).post('/login').send({ validCredentials: true });
        await request(app).post('/login').send({ validCredentials: true });
        await request(app).post('/login').send({ validCredentials: true });

        const res = await request(app)
            .post('/login')
            .send({ validCredentials: false });

        expect(res.status).not.toBe(429);
    });
});
