import * as crypto from 'crypto';
import { createLogger } from './LoggerService';

const log = createLogger('EncryptionService');
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16

const getEncryptionKey = (): string => {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 32) {
        throw new Error('FATAL: ENCRYPTION_KEY must be defined in environment and be exactly 32 characters long.');
    }
    return key;
};

export class EncryptionService {
    /**
     * Validates that the encryption key is correctly configured.
     * Should be called on application startup.
     */
    static validateKey() {
        try {
            getEncryptionKey();
            // Test encryption/decryption to be sure
            const test = 'test-string';
            const encrypted = this.encrypt(test);
            const decrypted = this.decrypt(encrypted);
            if (decrypted !== test) {
                throw new Error('Encryption/Decryption test failed');
            }
            log.info('Encryption service validated successfully');
        } catch (error) {
            log.fatal({ error }, 'Encryption Service Validation Failed');
            process.exit(1); // Fail fast
        }
    }
    /**
     * Encrypts plain text using AES-256-CBC
     */
    static encrypt(text: string | null | undefined): string | null {
        if (!text) return null;

        try {
            const key = getEncryptionKey();
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key), iv);
            let encrypted = cipher.update(text);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            return iv.toString('hex') + ':' + encrypted.toString('hex');
        } catch (error) {
            log.error({ error }, 'Encryption failed');
            throw new Error('Encryption failed');
        }
    }

    /**
     * Decrypts AES-256-CBC encrypted text
     */
    static decrypt(text: string | null | undefined): string | null {
        if (!text) return null;
        if (!text.includes(':')) return text; // Probably not encrypted

        try {
            const key = getEncryptionKey();
            const textParts = text.split(':');
            const iv = Buffer.from(textParts.shift()!, 'hex');
            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        } catch (error) {
            log.error({ error }, 'Decryption failed');
            return null; // Return null on failure, DO NOT return original text
        }
    }
}
