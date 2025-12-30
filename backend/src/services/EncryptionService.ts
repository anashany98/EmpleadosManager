import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-secret-key-32-chars-long!!'; // Must be 32 bytes
const IV_LENGTH = 16; // For AES, this is always 16

export class EncryptionService {
    /**
     * Encrypts plain text using AES-256-CBC
     */
    static encrypt(text: string | null | undefined): string | null {
        if (!text) return null;

        try {
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
            let encrypted = cipher.update(text);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            return iv.toString('hex') + ':' + encrypted.toString('hex');
        } catch (error) {
            console.error('Encryption error:', error);
            return text; // Fallback to plain text if error (or handle as needed)
        }
    }

    /**
     * Decrypts AES-256-CBC encrypted text
     */
    static decrypt(text: string | null | undefined): string | null {
        if (!text) return null;
        if (!text.includes(':')) return text; // Probably not encrypted

        try {
            const textParts = text.split(':');
            const iv = Buffer.from(textParts.shift()!, 'hex');
            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        } catch (error) {
            console.error('Decryption error:', error);
            return text; // Fallback to original text
        }
    }
}
