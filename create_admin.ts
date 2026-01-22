import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'file:./database/prisma/dev.db',
        },
    },
});

async function createAdmin() {
    const email = 'admin@empresa.com';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                password: hashedPassword,
                role: 'admin'
            },
            create: {
                email,
                password: hashedPassword,
                role: 'admin'
            }
        });
        console.log('✅ Admin user created/updated:', user.email);
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();
