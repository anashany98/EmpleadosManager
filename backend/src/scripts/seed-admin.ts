import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getBcryptRounds } from '../utils/bcryptRounds';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@admin.com';
    const password = process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || 'CHANGE_ME_IN_PRODUCTION';
    
    if (password === 'CHANGE_ME_IN_PRODUCTION' || password.length < 8) {
        console.error('❌ FATAL: Password too weak or not set via SEED_ADMIN_PASSWORD env var');
        console.error('   Usage: SEED_ADMIN_PASSWORD=YourSecurePassword123 npx ts-node scripts/seed-admin.ts');
        process.exit(1);
    }

    // Full permissions for admin
    const permissions = {
        employees: 'write',
        payroll: 'write',
        companies: 'write',
        calendar: 'write',
        audit: 'write',
        assets: 'write',
        reports: 'write',
        timesheet: 'write',
        projects: 'write',
        inbox: 'write',
        users: 'write',
        settings: 'write',
        documents: 'write',
        vacations: 'write',
        expenses: 'write',
        analytics: 'write',
        performance: 'write',
        fleet: 'write',
        cards: 'write',
        kiosk: 'write',
        notifications: 'write',
        onboarding: 'write',
        offboarding: 'write'
    };

    const hashedPassword = await bcrypt.hash(password, getBcryptRounds());
    const role = 'admin';

    await prisma.user.upsert({
        where: { email },
        update: {
            role,
            password: hashedPassword,
            permissions: JSON.stringify(permissions)
        },
        create: {
            email,
            password: hashedPassword,
            role,
            permissions: JSON.stringify(permissions)
        }
    });

    console.log('Admin user updated/created successfully with full permissions!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${'*'.repeat(8)} (hidden for security)`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
