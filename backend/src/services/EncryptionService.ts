import * as crypto from 'crypto';
import { createLogger } from './LoggerService';

const log = createLogger('EncryptionService');
const ALGORITHM = 'aes-256-gcm';
const LEGACY_ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 12;
const LEGACY_IV_LENGTH = 16;
const GCM_PREFIX = 'gcm';

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
     * Encrypts plain text using AES-256-GCM.
     * Format: gcm:ivHex:authTagHex:ciphertextHex
     */
    static encrypt(text: string | null | undefined): string | null {
        if (!text) return null;

        try {
            const key = getEncryptionKey();
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key), iv);
            let encrypted = cipher.update(text);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            const authTag = cipher.getAuthTag();
            return [
                GCM_PREFIX,
                iv.toString('hex'),
                authTag.toString('hex'),
                encrypted.toString('hex')
            ].join(':');
        } catch (error) {
            log.error({ error }, 'Encryption failed');
            const err = new Error('Encryption failed');
            (err as any).cause = error;
            throw err;
        }
    }

    /**
     * Decrypts AES-256-GCM encrypted text.
     * Legacy AES-256-CBC values are still supported for existing records.
     */
    static decrypt(text: string | null | undefined): string | null {
        if (!text) return null;
        if (!text.includes(':')) return text; // Probably not encrypted

        try {
            const key = getEncryptionKey();
            const textParts = text.split(':');

            if (textParts[0] === GCM_PREFIX) {
                const [, ivHex, authTagHex, encryptedHex] = textParts;
                if (!ivHex || !authTagHex || !encryptedHex) {
                    return null;
                }

                const iv = Buffer.from(ivHex, 'hex');
                const authTag = Buffer.from(authTagHex, 'hex');
                const encryptedText = Buffer.from(encryptedHex, 'hex');
                const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key), iv);
                decipher.setAuthTag(authTag);

                let decrypted = decipher.update(encryptedText);
                decrypted = Buffer.concat([decrypted, decipher.final()]);
                return decrypted.toString();
            }

            const iv = Buffer.from(textParts.shift()!, 'hex');
            if (iv.length !== LEGACY_IV_LENGTH) {
                return null;
            }

            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, Buffer.from(key), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        } catch (error) {
            log.error({ error }, 'Decryption failed');
            return null; // Return null on failure, DO NOT return original text
        }
    }
}
