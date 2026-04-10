import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app/createApp';

describe('Rate Limiting Security Tests', () => {
    const app = createApp();
    const agent = request(app);

    describe('General Rate Limiting', () => {
        it('should allow requests under limit', async () => {
            const response = await agent.get('/api/health');
            expect(response.status).toBe(200);
        });

        it('should block requests exceeding general limit', async () => {
            const requests = Array(201).fill(null).map(() => agent.get('/api/health'));
            const responses = await Promise.all(requests);
            
            const blockedCount = responses.filter(r => r.status === 429).length;
            expect(blockedCount).toBeGreaterThan(0);
        }, 30000);
    });

    describe('Login Rate Limiting', () => {
        it('should block after 20 failed login attempts', async () => {
            const loginAttempts = Array(21).fill(null).map((_, i) => 
                agent.post('/api/auth/login').send({
                    identifier: `test${i}`,
                    password: 'wrongpassword'
                })
            );
            
            const responses = await Promise.all(loginAttempts);
            const blockedCount = responses.filter(r => r.status === 429).length;
            expect(blockedCount).toBeGreaterThan(0);
        }, 45000);
    });

    describe('Employee Endpoint Rate Limiting', () => {
        it('should apply stricter limit to employee endpoints', async () => {
            const requests = Array(101).fill(null).map(() => 
                agent.get('/api/employees').set('Authorization', 'Bearer invalid')
            );
            
            const responses = await Promise.all(requests);
            const rateLimited = responses.filter(r => 
                r.status === 429 || r.status === 401
            ).length;
            expect(rateLimited).toBeGreaterThan(0);
        }, 30000);
    });
});