
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Creating Test Users...');

    // 1. Create/Update Admin
    const adminEmail = 'admin@empresa.com';
    const adminPassword = 'admin123';
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);

    const admin = await prisma.user.upsert({
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

    console.log(`✅ Admin User Ready: ${adminEmail} / ${adminPassword}`);

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

    const employeePassword = 'empleado123';
    const hashedEmployeePassword = await bcrypt.hash(employeePassword, 10);
    const employeeEmail = employee.email || `empleado${employee.dni}@empresa.com`;

    const user = await prisma.user.upsert({
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

    console.log(`✅ Employee User Ready: ${employeeEmail} / ${employeePassword}`);
    console.log(`   Linked to: ${employee.name} (ID: ${employee.id})`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
