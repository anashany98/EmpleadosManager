import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getBcryptRounds } from './backend/src/utils/bcryptRounds';

if (!process.env.DATABASE_URL) {
    console.error('❌ FATAL: DATABASE_URL environment variable is required');
    process.exit(1);
}

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

async function createAdmin() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email) {
        console.error('❌ FATAL: ADMIN_EMAIL environment variable is required');
        process.exit(1);
    }

    if (!password) {
        console.error('❌ FATAL: ADMIN_PASSWORD environment variable is required');
        console.error('   Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=YourSecurePassword node create_admin.js');
        process.exit(1);
    }

    // Aplicar la misma política de contraseñas que el resto de la app
    if (password.length < 10 ||
        /\s/.test(password) ||
        !/[a-z]/.test(password) ||
        !/[A-Z]/.test(password) ||
        !/[0-9]/.test(password) ||
        !/[^A-Za-z0-9]/.test(password)) {
        console.error('❌ FATAL: ADMIN_PASSWORD debe tener >=10 caracteres, mayúsculas, minúsculas, números y al menos un símbolo, sin espacios.');
        process.exit(1);
    }
    const rounds = getBcryptRounds();
    const hashedPassword = await bcrypt.hash(password, rounds);

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
