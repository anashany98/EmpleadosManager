import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2] || 'admin@empresa.com';
    const password = process.env.DEPLOY_ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD;

    if (!password) {
        console.error('❌ FATAL: Password not provided');
        console.error('   Usage: DEPLOY_ADMIN_PASSWORD=YourSecurePassword npx ts-node scripts/deploy_admin.ts [email]');
        console.error('   Or set ADMIN_INITIAL_PASSWORD environment variable');
        process.exit(1);
    }

    if (password.length < 8) {
        console.error('❌ FATAL: Password must be at least 8 characters');
        process.exit(1);
    }

    console.log(`Creating admin user: ${email}`);

    const hashedPassword = await bcrypt.hash(password, 10);

    const permissions = {
        employees: 'write',
        payroll: 'write',
        companies: 'write',
        calendar: 'write',
        audit: 'write',
        assets: 'write',
        reports: 'write',
        timesheet: 'write',
        projects: 'write'
    };

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            role: 'admin',
            permissions: JSON.stringify(permissions)
        },
        create: {
            email,
            password: hashedPassword,
            role: 'admin',
            permissions: JSON.stringify(permissions)
        }
    });

    console.log('✅ Admin user created/updated:', user.email);
    console.log('   Password: ********* (hidden for security)');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });