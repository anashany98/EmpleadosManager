
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Custom Seeding Started ---');

    // 1. Create/Update Default Admin (admin@admin.com)
    // This user is NOT linked to an employee request (pure system admin)
    const adminEmail = 'admin@admin.com';
    const adminPassword = await bcrypt.hash('admin123', 10);

    console.log(`Upserting Admin: ${adminEmail} ...`);
    const adminUser = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            password: adminPassword,
            role: 'ADMIN',
            permissions: JSON.stringify({ all: true })
        },
        create: {
            email: adminEmail,
            // We need a dummy DNI for admin if schema enforces unique DNI or null? 
            // Schema has `dni String? @unique`. So null is fine if DNI is unique.
            // But verify if DNI is mandatory in some logic. It's optional in schema.
            password: adminPassword,
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
    // Check if exists to update or create
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

    // 3. Create/Update User for Anas (Role: EMPLOYEE or USER, NOT ADMIN)
    // The previous run might have made him ADMIN. We demote him if he exists.
    const anasUserPassword = await bcrypt.hash('password123', 10);

    // Check if user exists by DNI or Email
    let anasUser = await prisma.user.findFirst({
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
                password: anasUserPassword,
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
                password: anasUserPassword,
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
