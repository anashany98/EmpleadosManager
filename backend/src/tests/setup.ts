import { vi } from 'vitest';

// Set environment variables for testing
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012'; // 32 chars
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAMESITE = 'lax';
process.env.RETURN_TOKENS = 'true';

// Silence console logs during tests to keep output clean
// console.log = vi.fn();
// console.error = vi.fn();
