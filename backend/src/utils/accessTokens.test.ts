import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccessToken, ACCESS_TOKEN_EXPIRES_IN } from './accessTokens';

// Secret used for testing purposes

describe('Access Tokens Utils', () => {
    describe('ACCESS_TOKEN_EXPIRES_IN', () => {
        it('should be set to 15 minutes', () => {
            expect(ACCESS_TOKEN_EXPIRES_IN).toBe('15m');
        });
    });

    describe('signAccessToken', () => {
        it('should generate a valid JWT token', () => {
            const user = { id: 'user-123', sessionVersion: 1 };
            const token = signAccessToken(user);
            
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.').length).toBe(3);
        });

        it('should include user id in token payload', () => {
            const user = { id: 'user-123', sessionVersion: 1 };
            const token = signAccessToken(user);
            const decoded = jwt.decode(token) as any;
            
            expect(decoded.id).toBe('user-123');
            expect(decoded.sessionVersion).toBe(1);
        });

        it('should set expiration', () => {
            const user = { id: 'user-123', sessionVersion: 1 };
            const token = signAccessToken(user);
            const decoded = jwt.decode(token) as any;
            
            expect(decoded.exp).toBeDefined();
            expect(decoded.iat).toBeDefined();
        });

        it('should generate different tokens for different users', () => {
            const user1 = { id: 'user-1', sessionVersion: 1 };
            const user2 = { id: 'user-2', sessionVersion: 1 };
            
            const token1 = signAccessToken(user1);
            const token2 = signAccessToken(user2);
            
            expect(token1).not.toBe(token2);
        });

        it('should generate different tokens for session version increment', () => {
            const user1 = { id: 'user-1', sessionVersion: 1 };
            const user2 = { id: 'user-1', sessionVersion: 2 };
            
            const token1 = signAccessToken(user1);
            const token2 = signAccessToken(user2);
            
            expect(token1).not.toBe(token2);
        });
    });
});
