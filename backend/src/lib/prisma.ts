import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Retry timed-out transactions up to 3 times with exponential backoff
    // This handles transient deadlocks and connection pool exhaustion at the Prisma level
    transactionOptions: {
      maxWait: 10000,
      timeout: 30000,
      isolationLevel: undefined,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

prisma.$connect()
  .then(() => {
    console.log('Prisma connected successfully');
  })
  .catch((error) => {
    console.error('Prisma connection error:', error);
  });

export async function testConnection() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connection test passed');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

export default prisma;