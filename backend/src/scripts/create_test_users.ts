
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getBcryptRounds } from '../utils/bcryptRounds';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Creating Test Users...');

    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const employeePassword = process.env.SEED_EMPLOYEE_PASSWORD || process.env.DEFAULT_USER_PASSWORD;

    if (!adminPassword || adminPassword.length < 8) {
        console.error('❌ FATAL: SEED_ADMIN_PASSWORD env var is required (min 8 chars)');
        console.error('   Usage: SEED_ADMIN_PASSWORD=YourSecurePassword npx ts-node scripts/create_test_users.ts');
        process.exit(1);
    }

    if (!employeePassword || employeePassword.length < 6) {
        console.error('❌ FATAL: SEED_EMPLOYEE_PASSWORD env var is required (min 6 chars)');
        console.error('   Usage: SEED_EMPLOYEE_PASSWORD=YourPassword npx ts-node scripts/create_test_users.ts');
        process.exit(1);
    }

    const hashedAdminPassword = await bcrypt.hash(adminPassword, getBcryptRounds());

    // 1. Create/Update Admin
    const adminEmail = 'admin@empresa.com';

    await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            password: hashedAdminPassword,
            role: 'admin'
        },
        create: {
            email: adminEmail,
            password: hashedAdminPassword,
            role: 'admin'
        }
    });

    console.log(`✅ Admin User Ready: ${adminEmail}`);

    // 2. Create Employee User
    // Find an active employee
    const employee = await prisma.employee.findFirst({
        where: { active: true },
        include: { company: true }
    });

    if (!employee) {
        console.error('❌ No active employees found. Run seeds first.');
        return;
    }

    const hashedEmployeePassword = await bcrypt.hash(employeePassword, getBcryptRounds());
    const employeeEmail = employee.email || `empleado${employee.dni}@empresa.com`;

    await prisma.user.upsert({
        where: { email: employeeEmail },
        update: {
            password: hashedEmployeePassword,
            role: 'employee',
            employeeId: employee.id
        },
        create: {
            email: employeeEmail,
            password: hashedEmployeePassword,
            role: 'employee',
            employeeId: employee.id,
            dni: employee.dni
        }
    });

    // Ensure employee record has this email
    if (employee.email !== employeeEmail) {
        await prisma.employee.update({
            where: { id: employee.id },
            data: { email: employeeEmail }
        });
    }

    console.log(`✅ Employee User Ready: ${employeeEmail}`);
    console.log(`   Linked to: ${employee.name} (ID: ${employee.id})`);
    console.log(`   Password: ****** (via SEED_EMPLOYEE_PASSWORD env var)`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
