import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateRuntimeConfiguration } from '../app/configValidator';
import { EncryptionService } from '../services/EncryptionService';

// Mock dependencies
vi.mock('../services/EncryptionService', () => ({
    EncryptionService: {
        validateKey: vi.fn()
    }
}));

vi.mock('../services/LoggerService', () => ({
    createLogger: () => ({
        fatal: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn()
    })
}));

describe('ConfigValidator', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset environment
        process.env = { ...originalEnv };
        vi.clearAllMocks();
    });

    describe('Critical Secrets Validation', () => {
        it('should fail if JWT_SECRET is missing', () => {
            process.env.JWT_SECRET = undefined;
            expect(() => validateRuntimeConfiguration()).toThrow('Configuration validation failed');
        });

        it('should fail if JWT_SECRET is too short (< 32 chars)', () => {
            process.env.JWT_SECRET = 'short-secret';
            expect(() => validateRuntimeConfiguration()).toThrow('Configuration validation failed');
        });

        it('should fail if JWT_SECRET is a default/fallback value', () => {
            process.env.JWT_SECRET = 'super-secret-key-change-me-and-long-enough-for-validation';
            process.env.NODE_ENV = 'production';
            process.env.COOKIE_SECURE = 'true';
            process.env.CORS_ORIGIN = 'https://internal.company.com';
            expect(() => validateRuntimeConfiguration()).toThrow('forbidden test/development/placeholder value');
        });

        it('should pass with valid JWT_SECRET', () => {
            process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-characters-long';
            process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
            expect(() => validateRuntimeConfiguration()).not.toThrow();
        });
    });

    describe('Database URL Validation', () => {
        it('should fail if DATABASE_URL is missing', () => {
            process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-characters-long';
            process.env.DATABASE_URL = undefined;
            expect(() => validateRuntimeConfiguration()).toThrow('DATABASE_URL is required');
        });

        it('should fail if DATABASE_URL is not PostgreSQL', () => {
            process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-characters-long';
            process.env.DATABASE_URL = 'mysql://localhost/db';
            expect(() => validateRuntimeConfiguration()).toThrow('must be a PostgreSQL connection string');
        });

        it('should pass with valid PostgreSQL URL', () => {
            process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-characters-long';
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
            process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
            expect(() => validateRuntimeConfiguration()).not.toThrow();
        });
    });

    describe('Production Environment Checks', () => {
        it('should skip production-only checks in development', () => {
            process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-characters-long';
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
            process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
            process.env.NODE_ENV = 'development';
            expect(() => validateRuntimeConfiguration()).not.toThrow();
        });

        it('should fail if CORS_ORIGIN is wildcard in production', () => {
            process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-characters-long';
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
            process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = '*';
            expect(() => validateRuntimeConfiguration()).toThrow('cannot be "*" in production');
        });

        it('should pass with valid CORS_ORIGIN in production', () => {
            process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-characters-long';
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
            process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = 'https://internal.company.com';
            process.env.COOKIE_SECURE = 'true';
            expect(() => validateRuntimeConfiguration()).not.toThrow();
        });

        it('should fail if COOKIE_SECURE is false in production', () => {
            process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-characters-long';
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
            process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = 'https://internal.company.com';
            process.env.COOKIE_SECURE = 'false';
            expect(() => validateRuntimeConfiguration()).toThrow('COOKIE_SECURE must be "true" in production');
        });

        it('should fail if COOKIE_SAMESITE is none in production', () => {
            process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-characters-long';
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
            process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = 'https://internal.company.com';
            process.env.COOKIE_SECURE = 'true';
            process.env.COOKIE_SAMESITE = 'none';
            expect(() => validateRuntimeConfiguration()).toThrow('COOKIE_SAMESITE="none" is not recommended');
        });
    });

    describe('S3 Storage Validation', () => {
        it('should require S3 variables when STORAGE_PROVIDER=s3', () => {
            process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-characters-long';
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
            process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = 'https://internal.company.com';
            process.env.COOKIE_SECURE = 'true';
            process.env.STORAGE_PROVIDER = 's3';
            delete process.env.S3_BUCKET;
            expect(() => validateRuntimeConfiguration()).toThrow('Required when STORAGE_PROVIDER=s3');
        });

        it('should pass with S3 credentials configured', () => {
            process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-characters-long';
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
            process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = 'https://internal.company.com';
            process.env.COOKIE_SECURE = 'true';
            process.env.STORAGE_PROVIDER = 's3';
            process.env.S3_BUCKET = 'my-bucket';
            process.env.S3_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
            process.env.S3_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
            expect(() => validateRuntimeConfiguration()).not.toThrow();
        });

        it('should pass with local storage (S3 not required)', () => {
            process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-characters-long';
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
            process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = 'https://internal.company.com';
            process.env.COOKIE_SECURE = 'true';
            process.env.STORAGE_PROVIDER = 'local';
            expect(() => validateRuntimeConfiguration()).not.toThrow();
        });
    });

    describe('Encryption Service Integration', () => {
        it('should call EncryptionService.validateKey', () => {
            process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-characters-long';
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
            process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = 'https://internal.company.com';
            process.env.COOKIE_SECURE = 'true';
            
            validateRuntimeConfiguration();
            expect(EncryptionService.validateKey).toHaveBeenCalled();
        });
    });

    describe('Edge Cases and Warnings', () => {
        it('should warn about missing kiosk secret (not fail)', () => {
            process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-characters-long';
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
            process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = 'https://internal.company.com';
            process.env.COOKIE_SECURE = 'true';
            // No kiosk secret set - should not throw
            expect(() => validateRuntimeConfiguration()).not.toThrow();
        });
    });
});
