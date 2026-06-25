import { EncryptionService } from '../services/EncryptionService';
import { createLogger } from '../services/LoggerService';

const log = createLogger('ConfigValidator');

function failConfigurationValidation(errors: string[]): never {
    const message = `Configuration validation failed: ${errors.join('; ')}`;
    if (process.env.VITEST || process.env.VITEST_WORKER_ID) {
        throw new Error(message);
    }
    process.exit(1);
}

interface EnvValidator {
    name: string;
    required?: boolean;
    validate?: (value: string | undefined) => { valid: boolean; error?: string };
    defaultValue?: string;
}

/**
 * Validates that all required environment variables are properly configured
 * before the application starts. This prevents runtime failures in production.
 */
export function validateRuntimeConfiguration(): void {
    const errors: string[] = [];
    const isProduction = process.env.NODE_ENV === 'production';

    // === CRITICAL SECRETS (must be present and valid) ===
    const critical: EnvValidator[] = [
{
            name: 'REDIS_HOST',
            required: true,
            validate: (v) => {
                if (process.env.REDIS_URL) return { valid: true };
                if (!v) return { valid: false, error: 'REDIS_HOST is required' };
                return { valid: true };
            }
        },
        {
            name: 'JWT_SECRET',
            required: true,
            validate: (v) => {
                if (!v) return { valid: false, error: 'JWT_SECRET is required' };
                if (v.length < 32) return { valid: false, error: 'JWT_SECRET must be at least 32 characters long' };
                return { valid: true };
            }
        },
        {
            name: 'ENCRYPTION_KEY',
            required: true,
            // EncryptionService.validateKey() will handle this, but we add extra checks
            validate: (v) => {
                if (!v) return { valid: false, error: 'ENCRYPTION_KEY is required' };
                if (v.length !== 32) return { valid: false, error: 'ENCRYPTION_KEY must be exactly 32 characters' };
                return { valid: true };
            }
        },
        {
            name: 'DATABASE_URL',
            required: true,
            validate: (v) => {
                if (!v) return { valid: false, error: 'DATABASE_URL is required' };
                if (!v.startsWith('postgresql://') && !v.startsWith('postgres://')) {
                    return { valid: false, error: 'DATABASE_URL must be a PostgreSQL connection string' };
                }
                return { valid: true };
            }
        }
    ];

    // === REQUIRED FOR PRODUCTION ===
    const requiredProduction: EnvValidator[] = [
        {
            name: 'NODE_ENV',
            required: false,
            validate: (v) => {
                if (v === 'production') return { valid: true };
                if (!v || v === 'development') {
                    return { valid: false, error: 'NODE_ENV must be set to "production" in production environments' };
                }
                return { valid: true };
            }
        },
        {
            name: 'PORT',
            required: false,
            validate: (v) => {
                const port = parseInt(v || '3000');
                if (isNaN(port) || port < 1 || port > 65535) {
                    return { valid: false, error: 'PORT must be a valid port number (1-65535)' };
                }
                return { valid: true };
            }
        },
        {
            name: 'CORS_ORIGIN',
            required: true,
            validate: (v) => {
                if (!v) return { valid: false, error: 'CORS_ORIGIN is required in production' };
                // Check if it's a wildcard in production (not recommended)
                if (v === '*' && process.env.NODE_ENV === 'production') {
                    return { valid: false, error: 'CORS_ORIGIN cannot be "*" in production' };
                }
                return { valid: true };
            }
        },
        {
            name: 'FRONTEND_URL',
            required: true,
            validate: (v) => {
                if (!v) return { valid: false, error: 'FRONTEND_URL is required' };
                try {
                    new URL(v);
                    return { valid: true };
                } catch {
                    return { valid: false, error: 'FRONTEND_URL must be a valid URL' };
                }
            }
        },
        {
            name: 'REDIS_HOST',
            required: true,
            validate: (v) => {
                if (process.env.REDIS_URL) return { valid: true };
                if (!v) return { valid: false, error: 'REDIS_HOST is required' };
                return { valid: true };
            }
        },
        {
            name: 'REDIS_PASSWORD',
            required: false,
            validate: (v) => {
                if (process.env.REDIS_URL) return { valid: true };
                if (!v) return { valid: false, error: 'REDIS_PASSWORD is required in production when REDIS_URL is not set' };
                if (v.length < 16) return { valid: false, error: 'REDIS_PASSWORD must be at least 16 characters long' };
                return { valid: true };
            }
        },
        {
            name: 'COOKIE_SECURE',
            required: false,
            validate: (v) => {
                const val = (v || 'false').toLowerCase();
                if (!['true', 'false'].includes(val)) {
                    return { valid: false, error: 'COOKIE_SECURE must be "true" or "false"' };
                }
                // In production, COOKIE_SECURE should be true
                if (process.env.NODE_ENV === 'production' && val !== 'true') {
                    return { valid: false, error: 'COOKIE_SECURE must be "true" in production for HTTPS' };
                }
                return { valid: true };
            }
        },
        {
            name: 'COOKIE_SAMESITE',
            required: false,
            validate: (v) => {
                const val = (v || 'lax').toLowerCase();
                if (!['lax', 'strict', 'none'].includes(val)) {
                    return { valid: false, error: 'COOKIE_SAMESITE must be "lax", "strict", or "none"' };
                }
                if (process.env.NODE_ENV === 'production' && val === 'none') {
                    return { valid: false, error: 'COOKIE_SAMESITE="none" is not recommended in production unless required for cross-site usage' };
                }
                return { valid: true };
            }
        },
        {
            name: 'CSRF_COOKIE_NAME',
            required: false,
            validate: () => ({ valid: true })
        },
        {
            name: 'CSRF_HEADER_NAME',
            required: false,
            validate: () => ({ valid: true })
        },
        {
            name: 'BACKUP_ENCRYPTION_KEY',
            required: true,
            validate: (v) => {
                if (!v) return { valid: false, error: 'BACKUP_ENCRYPTION_KEY is required in production' };
                if (v.length < 32) return { valid: false, error: 'BACKUP_ENCRYPTION_KEY must be at least 32 characters long' };
                return { valid: true };
            }
        }
    ];

    // === OPTIONAL BUT RECOMMENDED ===
    const optional: EnvValidator[] = [
        {
            name: 'LOG_LEVEL',
            required: false,
            validate: (v) => {
                const levels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
                if (v && !levels.includes(v.toLowerCase())) {
                    return { valid: false, error: `LOG_LEVEL must be one of: ${levels.join(', ')}` };
                }
                return { valid: true };
            }
        },
        {
            name: 'PRISMA_QUERY_TIMEOUT',
            required: false,
            validate: (v) => {
                if (v) {
                    const num = parseInt(v);
                    if (isNaN(num) || num < 1000) {
                        return { valid: false, error: 'PRISMA_QUERY_TIMEOUT must be a positive number in milliseconds' };
                    }
                }
                return { valid: true };
            }
        },
        {
            name: 'PRISMA_CONNECT_TIMEOUT',
            required: false,
            validate: (v) => {
                if (v) {
                    const num = parseInt(v);
                    if (isNaN(num) || num < 1000) {
                        return { valid: false, error: 'PRISMA_CONNECT_TIMEOUT must be a positive number in milliseconds' };
                    }
                }
                return { valid: true };
            }
        }
    ];

    // === STORAGE CONFIGURATION (based on provider) ===
    const storageProvider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
    if (storageProvider === 's3') {
        const _s3Validators: EnvValidator[] = [
            { name: 'S3_BUCKET', required: true, validate: (v) => v ? { valid: true } : { valid: false, error: 'S3_BUCKET is required when STORAGE_PROVIDER=s3' } },
            { name: 'S3_ACCESS_KEY_ID', required: true, validate: (v) => v ? { valid: true } : { valid: false, error: 'S3_ACCESS_KEY_ID is required when STORAGE_PROVIDER=s3' } },
            { name: 'S3_SECRET_ACCESS_KEY', required: true, validate: (v) => v ? { valid: true } : { valid: false, error: 'S3_SECRET_ACCESS_KEY is required when STORAGE_PROVIDER=s3' } }
        ];
        void _s3Validators;
    }

    // Combine all validators
    const allValidators = isProduction
        ? [...critical, ...requiredProduction, ...optional]
        : [...critical, ...optional];

    // Validate each
    for (const validator of allValidators) {
        const value = process.env[validator.name];
        const result = validator.validate ? validator.validate(value) : { valid: true };

        if (!result.valid) {
            errors.push(`${validator.name}: ${result.error || 'Invalid configuration'}`);
        }
    }

    // Storage-specific validation
    if (storageProvider === 's3') {
        const s3Vars = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
        for (const name of s3Vars) {
            if (!process.env[name]) {
                errors.push(`${name}: Required when STORAGE_PROVIDER=s3`);
            }
        }
    }

    // Kiosk secret validation (if kiosk endpoints are used)
    const hasKioskSecret = process.env.KIOSK_DEVICE_SECRET || process.env.KIOSK_SECRET;
    if (!hasKioskSecret && process.env.NODE_ENV === 'production') {
        // Kiosk is optional but recommended, only warning
        log.warn('KIOSK_DEVICE_SECRET or KIOSK_SECRET not set - kiosk functionality will be disabled');
    }

    // Check for debug/test values in production
    if (isProduction) {
        const forbiddenValues = [
            'test-jwt-secret', 'secret-key-123', 'super-secret-key-change-me',
            'changeme', 'dev', 'development', 'local_jwt_secret', 'local_encryption_key',
            'local_pw', 'nominas_local_pw', '_local_', 'CHANGE_ME', 'GENERATE_WITH',
            '<RUN:', 'password123', 'admin123'
        ];

        if (process.env.JWT_SECRET && forbiddenValues.some(fv => process.env.JWT_SECRET!.toLowerCase().includes(fv.toLowerCase()))) {
            errors.push('JWT_SECRET contains a forbidden test/development/placeholder value in production');
        }

        if (process.env.ENCRYPTION_KEY && forbiddenValues.some(fv => process.env.ENCRYPTION_KEY!.toLowerCase().includes(fv.toLowerCase()))) {
            errors.push('ENCRYPTION_KEY contains a forbidden test/development/placeholder value in production');
        }

        if (process.env.POSTGRES_PASSWORD && forbiddenValues.some(fv => process.env.POSTGRES_PASSWORD!.toLowerCase().includes(fv.toLowerCase()))) {
            errors.push('POSTGRES_PASSWORD contains a forbidden test/development/placeholder value in production');
        }

        if (process.env.BACKUP_ENCRYPTION_KEY && forbiddenValues.some(fv => process.env.BACKUP_ENCRYPTION_KEY!.toLowerCase().includes(fv.toLowerCase()))) {
            errors.push('BACKUP_ENCRYPTION_KEY contains a forbidden test/development/placeholder value in production');
        }
    }

    // If there are errors, fail fast
    if (errors.length > 0) {
        log.fatal({ errors }, 'Configuration validation failed. Application cannot start.');
        console.error('\n=== CONFIGURATION VALIDATION FAILED ===');
        errors.forEach(err => console.error(`  âœ— ${err}`));
        console.error('=== Please fix these issues before starting ===\n');
        failConfigurationValidation(errors);
    }

    // Run EncryptionService validation
    try {
        EncryptionService.validateKey();
    } catch (error) {
        errors.push(`Encryption key validation failed: ${error}`);
        log.fatal({ error }, 'Encryption validation failed');
        failConfigurationValidation(errors);
    }

    log.info('All configuration validations passed');
}

