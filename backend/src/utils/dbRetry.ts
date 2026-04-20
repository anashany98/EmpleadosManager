import { createLogger } from '../services/LoggerService';

const log = createLogger('DbRetry');

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 200;
const DEFAULT_MAX_DELAY_MS = 5000;

/**
 * Error codes from PostgreSQL/Prisma that indicate transient failures
 * which are safe to retry.
 */
const RETRYABLE_ERROR_CODES = [
    'P1001', // Cannot reach database server
    'P1002', // Database server reached but timed out
    'P1008', // Operations timed out
    'P1017', // Server has closed the connection
    'P2024', // Timed out fetching a connection from the pool
    'P2034', // Transaction failed due to a write conflict or deadlock
];

const RETRYABLE_POSTGRES_CODES = [
    '08006', // Connection failure
    '08001', // Unable to connect
    '08004', // Rejected connection
    '40001', // Serialization failure (deadlock)
    '40P01', // Deadlock detected
    '57P03', // Cannot connect now
    '55000', // Object not in prerequisite state
];

interface RetryOptions {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    operationName?: string;
}

/**
 * Checks if an error is retryable (transient DB failure).
 */
function isRetryableError(error: any): boolean {
    // Prisma error codes
    if (error?.code && RETRYABLE_ERROR_CODES.includes(error.code)) {
        return true;
    }

    // PostgreSQL error codes
    const pgCode = error?.meta?.code || error?.meta?.db_error;
    if (pgCode && RETRYABLE_POSTGRES_CODES.includes(pgCode)) {
        return true;
    }

    // Connection refused / timeout patterns in message
    const msg = error?.message?.toLowerCase() || '';
    if (msg.includes('connection') && (msg.includes('refused') || msg.includes('timeout') || msg.includes('reset'))) {
        return true;
    }

    return false;
}

/**
 * Calculates delay with exponential backoff and jitter.
 */
function getDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * baseDelayMs;
    return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Executes a database operation with automatic retry on transient failures.
 * Uses exponential backoff with jitter to avoid thundering herd.
 *
 * @param operation - An async function that performs the DB operation
 * @param options - Retry configuration
 * @returns The result of the operation
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = DEFAULT_MAX_RETRIES,
        baseDelayMs = DEFAULT_BASE_DELAY_MS,
        maxDelayMs = DEFAULT_MAX_DELAY_MS,
        operationName = 'DB operation'
    } = options;

    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;

            // Don't retry if the error is not transient
            if (!isRetryableError(error)) {
                throw error;
            }

            // Don't retry if we've exhausted attempts
            if (attempt >= maxRetries) {
                log.error({ error, attempt, operationName }, 'All retries exhausted');
                throw error;
            }

            const delay = getDelay(attempt, baseDelayMs, maxDelayMs);
            log.warn({ error: error.message, attempt: attempt + 1, maxRetries, delay, operationName }, 'Retrying DB operation');

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Wraps a Prisma operation with retry logic, returning a bound function.
 * Useful for composing with existing code.
 *
 * @example
 * const result = await withRetry(() => prisma.user.findMany({ where: {...} }));
 */
export function retryableOperation<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T> {
    return withRetry(operation, options);
}
