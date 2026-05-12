import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const ITERATIONS = 100000;

/**
 * Derives a 32-byte key from a passphrase using PBKDF2.
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, 32, 'sha512');
}

/**
 * Encrypts a buffer using AES-256-GCM.
 * Output format: salt (64B) + iv (16B) + tag (16B) + ciphertext
 */
export function encrypt(data: Buffer, passphrase: string): Buffer {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(passphrase, salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, tag, encrypted]);
}

/**
 * Decrypts a buffer encrypted with AES-256-GCM.
 * Input format: salt (64B) + iv (16B) + tag (16B) + ciphertext
 */
export function decrypt(data: Buffer, passphrase: string): Buffer {
    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const ciphertext = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = deriveKey(passphrase, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Gets the backup encryption key from the environment.
 * Throws if BACKUP_ENCRYPTION_KEY is not set when encryption is needed.
 */
export function getEncryptionKey(): string {
    const key = process.env.BACKUP_ENCRYPTION_KEY;
    if (!key) {
        throw new Error('BACKUP_ENCRYPTION_KEY environment variable is not set. Backup encryption cannot proceed.');
    }
    if (key.length < 32) {
        throw new Error('BACKUP_ENCRYPTION_KEY must be at least 32 characters long.');
    }
    return key;
}

/**
 * Checks if backup encryption is enabled via environment.
 */
export function isEncryptionEnabled(): boolean {
    return process.env.BACKUP_ENCRYPTION_KEY !== undefined && process.env.BACKUP_ENCRYPTION_KEY.length >= 32;
}
