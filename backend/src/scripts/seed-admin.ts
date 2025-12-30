import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@admin.com';
    const password = 'admin123';
    const role = 'admin';

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
        projects: 'write'
    };

    const hashedPassword = await bcrypt.hash(password, 10);

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
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
