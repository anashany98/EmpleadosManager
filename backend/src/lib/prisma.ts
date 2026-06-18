import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const baseClient =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
        datasources: {
            db: {
                // Connection pool tuned for 4-6 concurrent users with
                // potentially heavy operations (payroll, reports, OCR).
                // Prisma's default of `num_physical_cpus * 2 + 1` is
                // insufficient when 2-3 users trigger report queries
                // simultaneously. 20 connections per backend instance
                // provides comfortable headroom for the 4-6 user target.
                url: `${process.env.DATABASE_URL}${process.env.DATABASE_URL?.includes('?') ? '&' : '?'}connection_limit=20&pool_timeout=15`,
            },
        },
        // Retry timed-out transactions up to 3 times with exponential backoff
        transactionOptions: {
            maxWait: 10000,
            timeout: 30000,
            isolationLevel: undefined,
        },
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = baseClient;
}

/**
 * Models that participate in soft-delete. Reads against these models
 * automatically filter out rows with `deletedAt IS NOT NULL` unless the
 * caller explicitly opts in via `includeSoftDeleted: true` in the query
 * args (handled at the service layer, not here).
 */
const SOFT_DELETE_MODELS = new Set<string>(['Employee']);

/**
 * Prisma middleware that injects `deletedAt: null` into every read query
 * against soft-deletable models. GDPR right-to-be-forgotten compliance.
 */
baseClient.$use(async (params, next) => {
    if (SOFT_DELETE_MODELS.has(params.model ?? '') && params.action === 'findUnique') {
        // findUnique does not support arbitrary where clauses beyond
        // the unique key. Convert to findFirst with deletedAt filter
        // for read consistency.
        if (params.args?.where && !('deletedAt' in params.args.where)) {
            params.action = 'findFirst';
            params.args.where = { ...params.args.where, deletedAt: null };
        }
    } else if (
        SOFT_DELETE_MODELS.has(params.model ?? '') &&
        ['findMany', 'findFirst', 'count', 'aggregate', 'groupBy'].includes(params.action)
    ) {
        const where = (params.args?.where ?? {}) as Record<string, unknown>;
        if (!('deletedAt' in where)) {
            params.args = { ...params.args, where: { ...where, deletedAt: null } };
        }
    }
    return next(params);
});

export const prisma = baseClient;

export async function testConnection() {
    try {
        await prisma.$connect();
        await prisma.$queryRaw`SELECT 1`;
        return true;
    } catch (error) {
         
        console.error('Database connection test failed:', error);
        return false;
    }
}

export default prisma;

// Re-export Prisma namespace for consumers
export { Prisma };
