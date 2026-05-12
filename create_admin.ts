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
    const email = process.env.ADMIN_EMAIL || 'admin@empresa.com';
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
        console.error('❌ FATAL: ADMIN_PASSWORD environment variable is required');
        console.error('   Usage: ADMIN_PASSWORD=YourSecurePassword node create_admin.js');
        process.exit(1);
    }

    if (password.length < 8) {
        console.error('❌ FATAL: ADMIN_PASSWORD must be at least 8 characters');
        process.exit(1);
    }
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
