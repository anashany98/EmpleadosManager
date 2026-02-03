
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const dni = '49480953h';
    console.log(`Checking user with DNI: ${dni}`);

    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { dni: dni },
                { dni: dni.toUpperCase() }
            ]
        }
    });

    if (user) {
        console.log('User found:', user.email, user.dni, user.role);
        const isMatch = await bcrypt.compare('password123', user.password);
        console.log('Password match for "password123":', isMatch);
    } else {
        console.log('User NOT found');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
