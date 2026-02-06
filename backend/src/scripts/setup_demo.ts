
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Setting up Demo Environment...');

    // 1. Create/Update Admin
    const adminEmail = 'admin@empresa.com';
    const adminPassword = 'admin123';
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);

    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: { password: hashedAdminPassword, role: 'admin' },
        create: { email: adminEmail, password: hashedAdminPassword, role: 'admin' }
    });
    console.log(`✅ Admin: ${adminEmail} / ${adminPassword}`);

    // 2. Ensure Company Exists
    let company = await prisma.company.findFirst();
    if (!company) {
        company = await prisma.company.create({
            data: {
                name: 'Demo Company S.L.',
                cif: 'B12345678',
                officeLatitude: 40.4168,
                officeLongitude: -3.7038,
                allowedRadius: 500
            }
        });
        console.log('✅ Created Demo Company');
    }

    // 3. Create Demo Employee
    const demoEmail = 'empleado@empresa.com';
    const demoPassword = 'empleado123';
    const dni = '12345678A';

    let employee = await prisma.employee.findUnique({ where: { dni } });
    if (!employee) {
        employee = await prisma.employee.create({
            data: {
                dni,
                name: 'Juan Perez (Demo)',
                firstName: 'Juan',
                lastName: 'Perez',
                email: demoEmail,
                companyId: company.id,
                active: true,
                entryDate: new Date('2024-01-01'),
                jobTitle: 'Desarrollador',
                vacationDaysTotal: 22,
                contractType: 'Indefinido'
            }
        });
        console.log('✅ Created Demo Employee');
    }

    // 4. Create User for Employee
    const hashedDemoPassword = await bcrypt.hash(demoPassword, 10);
    await prisma.user.upsert({
        where: { email: demoEmail },
        update: {
            password: hashedDemoPassword,
            role: 'employee',
            employeeId: employee.id
        },
        create: {
            email: demoEmail,
            dni: dni,
            password: hashedDemoPassword,
            role: 'employee',
            employeeId: employee.id
        }
    });

    // 5. Create Sample Time Entries (Yesterday 9-18)
    // Clear existing for clarity
    await prisma.timeEntry.deleteMany({ where: { employeeId: employee.id } });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStart = new Date(yesterday.setHours(9, 0, 0, 0));
    const yLunchStart = new Date(yesterday.setHours(14, 0, 0, 0));
    const yLunchEnd = new Date(yesterday.setHours(15, 0, 0, 0));
    const yEnd = new Date(yesterday.setHours(18, 0, 0, 0));

    await prisma.timeEntry.createMany({
        data: [
            { employeeId: employee.id, type: 'IN', timestamp: yStart },
            { employeeId: employee.id, type: 'LUNCH_START', timestamp: yLunchStart },
            { employeeId: employee.id, type: 'LUNCH_END', timestamp: yLunchEnd },
            { employeeId: employee.id, type: 'OUT', timestamp: yEnd }
        ]
    });
    console.log('✅ Created Sample Time Entries (Yesterday)');

    // 6. Create Sample Payroll
    // Batch
    const batch = await prisma.payrollImportBatch.create({
        data: {
            year: 2024,
            month: 1, // January
            sourceFilename: 'demor.pdf',
            createdById: admin.id,
            status: 'VALIDATED'
        }
    });

    const payroll = await prisma.payrollRow.create({
        data: {
            batchId: batch.id,
            employeeId: employee.id,
            rawEmployeeName: employee.name,
            bruto: 2500.00,
            neto: 1950.50,
            ssEmpresa: 800.00,
            ssTrabajador: 150.00,
            irpf: 400.00,
            status: 'VALID'
        }
    });

    // Items
    await prisma.payrollItem.createMany({
        data: [
            { payrollRowId: payroll.id, concept: 'Salario Base', amount: 2000.00, type: 'EARNING' },
            { payrollRowId: payroll.id, concept: 'Plus Transporte', amount: 50.00, type: 'EARNING' },
            { payrollRowId: payroll.id, concept: 'IRPF', amount: 400.00, type: 'DEDUCTION' },
            { payrollRowId: payroll.id, concept: 'Seguridad Social', amount: 150.00, type: 'DEDUCTION' }
        ]
    });
    console.log('✅ Created Sample Payroll (Jan 2024)');

    console.log('\n🎉 DEMO READY!');
    console.log(`Admin:    ${adminEmail} / ${adminPassword}`);
    console.log(`Employee: ${demoEmail} / ${demoPassword}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
