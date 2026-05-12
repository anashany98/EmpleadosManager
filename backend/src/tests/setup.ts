// Set environment variables for testing
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012'; // 32 chars
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAMESITE = 'lax';
process.env.RETURN_TOKENS = 'true';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'redis_local_pw_2026';
process.env.BACKUP_ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY || 'test-backup-encryption-key-2026-32';

// Database configuration for tests
// Use local postgres if available, otherwise tests requiring DB will be skipped
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://nominas:nominas_local_pw_2026@localhost:5432/nominas_db?schema=public';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';

// Storage (S3) mock for tests - must be set to prevent FATAL error during module load
process.env.STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';
process.env.S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || 'test-key';
process.env.S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || 'test-secret';
process.env.S3_BUCKET = process.env.S3_BUCKET || 'test-bucket';
process.env.S3_REGION = process.env.S3_REGION || 'eu-west-1';
process.env.S3_ENDPOINT = process.env.S3_ENDPOINT || '';

// Silence console logs during tests to keep output clean
// console.log = vi.fn();
// console.error = vi.fn();
