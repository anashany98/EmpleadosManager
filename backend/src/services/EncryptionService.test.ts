import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { EncryptionService } from './EncryptionService';
import crypto from 'crypto';

vi.mock('./LoggerService', () => ({
    createLogger: () => ({
        error: vi.fn(),
        fatal: vi.fn(),
        info: vi.fn()
    })
}));

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
        expect(encrypted).toMatch(/^gcm:/);

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

    it('should handle Spanish characters correctly', () => {
        const original = 'Español ñoño áéíóú';
        const encrypted = EncryptionService.encrypt(original);
        const decrypted = EncryptionService.decrypt(encrypted);
        expect(decrypted).toBe(original);
    });

    it('should handle long strings', () => {
        const original = 'A'.repeat(10000);
        const encrypted = EncryptionService.encrypt(original);
        const decrypted = EncryptionService.decrypt(encrypted);
        expect(decrypted).toBe(original);
    });

    it('should produce different ciphertext for same plaintext', () => {
        const original = 'test';
        const encrypted1 = EncryptionService.encrypt(original);
        const encrypted2 = EncryptionService.encrypt(original);
        expect(encrypted1).not.toBe(encrypted2);
        expect(EncryptionService.decrypt(encrypted1)).toBe(original);
        expect(EncryptionService.decrypt(encrypted2)).toBe(original);
    });

    it('should decrypt legacy AES-CBC values', () => {
        const original = 'legacy secret';
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(TEST_KEY), iv);
        const encrypted = Buffer.concat([cipher.update(original), cipher.final()]);
        const legacyValue = `${iv.toString('hex')}:${encrypted.toString('hex')}`;

        expect(EncryptionService.decrypt(legacyValue)).toBe(original);
    });
});
