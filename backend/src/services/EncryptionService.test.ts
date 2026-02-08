import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EncryptionService } from './EncryptionService';

// Ensure we have a valid key for testing
const TEST_KEY = '12345678901234567890123456789012'; // 32 chars
const ORIGINAL_ENV = process.env;

describe('EncryptionService', () => {
    beforeAll(() => {
        process.env.ENCRYPTION_KEY = TEST_KEY;
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('should encrypt and decrypt a string correctly', () => {
        const secret = 'Secret Message 123';
        const encrypted = EncryptionService.encrypt(secret);

        expect(encrypted).not.toBe(secret);
        expect(encrypted).toContain(':'); // IV:Content format

        const decrypted = EncryptionService.decrypt(encrypted);
        expect(decrypted).toBe(secret);
    });

    it('should return null for null/undefined input', () => {
        expect(EncryptionService.encrypt(null)).toBeNull();
        expect(EncryptionService.decrypt(null)).toBeNull();
    });

    it('should return original text if not in encrypted format (no colon)', () => {
        const plain = 'Not Encrypted';
        // The service logic says: if (!text.includes(':')) return text;
        expect(EncryptionService.decrypt(plain)).toBe(plain);
    });

    it('should throw error if key is missing/invalid', () => {
        process.env.ENCRYPTION_KEY = ''; // Invalid
        expect(() => EncryptionService.encrypt('test')).toThrow('Encryption failed');

        process.env.ENCRYPTION_KEY = 'short'; // Invalid
        expect(() => EncryptionService.encrypt('test')).toThrow('Encryption failed');

        // Restore key for other tests
        process.env.ENCRYPTION_KEY = TEST_KEY;
    });

    it('should return null (not throw) when decryption fails due to tampered data', () => {
        // Correct format but invalid data
        const tampered = '12345678901234567890123456789012:invalidhexstrings';
        // The service catches error and returns null
        const result = EncryptionService.decrypt(tampered);
        expect(result).toBeNull();
    });
});
