
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking Prisma Client...');

    if ((prisma as any).refreshToken) {
        console.log('✅ refreshToken model exists on PrismaClient');
    } else {
        console.error('❌ refreshToken model MISSING on PrismaClient');
        // Check what keys exist
        console.log('Available keys:', Object.keys(prisma));
    }

    try {
        // Try to create a dummy token to see if it works
        // We need a user first?
        const user = await prisma.user.findFirst();
        if (user) {
            console.log('✅ Found a user:', user.email);
        } else {
            console.log('⚠️ No users found to test relation.');
        }
    } catch (e) {
        console.error('❌ Database connection or query failed:', e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
