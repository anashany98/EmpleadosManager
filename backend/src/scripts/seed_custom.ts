import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Custom Seeding Started ---');

    // 1. Create/Update Default Admin (admin@admin.com)
    // This user is NOT linked to an employee request (pure system admin)
    const adminEmail = 'admin@admin.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD;

    if (!adminPassword || adminPassword.length < 8) {
        console.error('❌ FATAL: SEED_ADMIN_PASSWORD or ADMIN_INITIAL_PASSWORD env var is required and must be at least 8 characters');
        console.error('   Usage: SEED_ADMIN_PASSWORD=YourSecurePassword npx ts-node scripts/seed_custom.ts');
        process.exit(1);
    }

    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);

    console.log(`Upserting Admin: ${adminEmail} ...`);
    await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            password: hashedAdminPassword,
            role: 'ADMIN',
            permissions: JSON.stringify({ all: true })
        },
        create: {
            email: adminEmail,
            // Schema has `dni String? @unique`. So null is fine.
            password: hashedAdminPassword,
            role: 'ADMIN',
            permissions: JSON.stringify({ all: true })
        }
    });
    console.log(`✅ Admin ready: ${adminEmail}`);

    // 2. Create/Update Employee: ANAS HANY LAHROUDY
    const anasDni = '49480953h';
    const anasEmail = 'anas.hany@nominasapp.com';
    const anasName = 'ANAS HANY LAHROUDY';

    // Get a company
    const company = await prisma.company.findFirst();
    if (!company) throw new Error("No company found! Run regular seed first.");

    console.log(`Upserting Employee: ${anasName} ...`);
    let anasEmployee = await prisma.employee.findUnique({ where: { dni: anasDni } });

    if (anasEmployee) {
        anasEmployee = await prisma.employee.update({
            where: { id: anasEmployee.id },
            data: {
                name: anasName,
                firstName: 'Anas',
                lastName: 'Hany Lahroudy',
                category: 'Oficial de 1ª', // Example
                jobTitle: 'Desarrollador',
                department: 'IT',
                companyId: company.id
            }
        });
    } else {
        anasEmployee = await prisma.employee.create({
            data: {
                name: anasName,
                firstName: 'Anas',
                lastName: 'Hany Lahroudy',
                dni: anasDni,
                email: anasEmail,
                companyId: company.id,
                department: 'IT',
                jobTitle: 'Desarrollador',
                category: 'Oficial de 1ª',
                active: true,
                entryDate: new Date(),
                workingDayType: 'FULL_TIME'
            }
        });
    }
    console.log(`✅ Employee ready: ${anasName}`);

    // 3. Create/Update User for Anas (Role: ADMIN for full access)
    const anasUserPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!anasUserPassword || anasUserPassword.length < 8) {
        console.error('❌ FATAL: SEED_ADMIN_PASSWORD env var is required for Anas user');
        process.exit(1);
    }
    const hashedAnasPassword = await bcrypt.hash(anasUserPassword, 10);

    const anasUser = await prisma.user.findFirst({
        where: {
            OR: [{ dni: anasDni }, { email: anasEmail }]
        }
    });

    if (anasUser) {
        console.log(`Updating User for Anas (Upgrading to 'ADMIN' for demo purposes)...`);
        await prisma.user.update({
            where: { id: anasUser.id },
            data: {
                email: anasEmail,
                dni: anasDni,
                role: 'ADMIN', // Upgraded for full access
                password: hashedAnasPassword,
                employeeId: anasEmployee.id,
                permissions: JSON.stringify({ all: true })
            }
        });
    } else {
        console.log(`Creating User for Anas...`);
        await prisma.user.create({
            data: {
                email: anasEmail,
                dni: anasDni,
                role: 'ADMIN', // Upgraded for full access
                password: hashedAnasPassword,
                employeeId: anasEmployee.id,
                permissions: JSON.stringify({ all: true })
            }
        });
    }
    console.log(`✅ User Anas ready (Role: ADMIN). Login with DNI ${anasDni} or Email.`);

}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());