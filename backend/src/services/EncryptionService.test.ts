import { describe, it, expect } from 'vitest';
import { EncryptionService } from './EncryptionService';
import dotenv from 'dotenv';

// Load env vars for the test (mocking process.env if needed)
dotenv.config();

// Force set a valid key for testing, ignoring .env content
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

describe('EncryptionService', () => {
    it('should encrypt and decrypt a string correctly', () => {
        const originalText = 'SENSITIVE_DATA_123';
        const encrypted = EncryptionService.encrypt(originalText);

        expect(encrypted).not.toBe(originalText);
        expect(encrypted).toContain(':'); // Checks for IV:Data format

        const decrypted = EncryptionService.decrypt(encrypted);
        expect(decrypted).toBe(originalText);
    });

    it('should return null/empty if input is null/empty', () => {
        // @ts-ignore
        expect(EncryptionService.encrypt(null)).toBe(null);
        // @ts-ignore
        expect(EncryptionService.decrypt(null)).toBe(null);
    });

    it('should handle special characters', () => {
        const text = 'H3llo W@rld! ñ $';
        const enc = EncryptionService.encrypt(text);
        const dec = EncryptionService.decrypt(enc);
        expect(dec).toBe(text);
    });
});
