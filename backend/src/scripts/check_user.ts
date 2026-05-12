
// DEBUG ONLY SCRIPT - Never run in production!
// This script checks user existence and password validation.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const dni = process.env.CHECK_USER_DNI || '49480953h';
    const testPassword = process.env.CHECK_USER_PASSWORD;

    console.log(`Checking user with DNI: ${dni}`);

    if (!testPassword) {
        console.error('ERROR: CHECK_USER_PASSWORD environment variable is required');
        console.error('Usage: CHECK_USER_PASSWORD=YourPassword npx ts-node scripts/check_user.ts');
        process.exit(1);
    }

    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { dni },
                { dni: dni.toUpperCase() }
            ]
        }
    });

    if (user) {
        console.log('User found:', user.email, user.dni, user.role);
        const isMatch = await bcrypt.compare(testPassword, user.password);
        console.log('Password match:', isMatch);
    } else {
        console.log('User NOT found');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
