import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Filling database with 5 detailed employees and 1 admin...');

    try {
        // 1. Ensure Company exists
        let company = await prisma.company.findFirst();
        if (!company) {
            company = await prisma.company.create({
                data: {
                    name: 'Enea Decoraciones S.L.',
                    cif: 'B98765432',
                    city: 'Palma de Mallorca',
                    address: 'Calle Industria 14',
                    legalRep: 'Matias Jure'
                }
            });
            console.log('✅ Created Company');
        }

        // 2. Create Admin
        const adminEmail = 'admin@empresa.com';
        const adminPassword = await bcrypt.hash('admin123', 10);
        const adminDni = '11111111A';

        const adminUser = await prisma.user.upsert({
            where: { email: adminEmail },
            update: { password: adminPassword, role: 'admin' },
            create: {
                email: adminEmail,
                dni: adminDni,
                password: adminPassword,
                role: 'admin'
            }
        });
        console.log('✅ Admin created/updated: admin@empresa.com / admin123');

        // 3. Create 5 Detailed Employees
        const employeesData = [
            {
                firstName: 'Carlos',
                lastName: 'Ruiz Mateos',
                dni: '44445555K',
                email: 'carlos.ruiz@empresa.com',
                phone: '600111222',
                address: 'Carrer de la Pau 12, 3B',
                city: 'Palma',
                province: 'Baleares',
                postalCode: '07012',
                jobTitle: 'Oficial de 1ª',
                department: 'Producción',
                category: 'Oficial de 1ª',
                contractType: 'Indefinido',
                iban: 'ES9121000418450200054321',
                socialSecurityNumber: '071234567890',
                annualGrossSalary: 28000,
                monthlyGrossSalary: 2333.33,
                entryDate: new Date('2022-03-15'),
                birthDate: new Date('1985-06-20'),
                dniExpiration: new Date('2030-01-01'),
                gender: 'MALE',
                workingDayType: 'COMPLETE'
            },
            {
                firstName: 'Laura',
                lastName: 'Sánchez Vidal',
                dni: '22223333L',
                email: 'laura.sanchez@empresa.com',
                phone: '611222333',
                address: 'Avenida Argentina 45',
                city: 'Palma',
                province: 'Baleares',
                postalCode: '07011',
                jobTitle: 'Administrativa',
                department: 'Administración',
                category: 'Auxiliar',
                contractType: 'Temporal',
                iban: 'ES9121000418450200051111',
                socialSecurityNumber: '079988776655',
                annualGrossSalary: 22000,
                monthlyGrossSalary: 1833.33,
                entryDate: new Date('2023-11-01'),
                birthDate: new Date('1992-02-10'),
                dniExpiration: new Date('2028-05-15'),
                gender: 'FEMALE',
                workingDayType: 'COMPLETE'
            },
            {
                firstName: 'Miguel',
                lastName: 'Ángel Torres',
                dni: '88887777M',
                email: 'miguel.torres@empresa.com',
                phone: '622333444',
                address: 'C/ Manacor 102',
                city: 'Palma',
                province: 'Baleares',
                postalCode: '07007',
                jobTitle: 'Técnico IT',
                department: 'IT',
                category: 'Técnico',
                contractType: 'Indefinido',
                iban: 'ES9121000418450200052222',
                socialSecurityNumber: '071122334455',
                annualGrossSalary: 32000,
                monthlyGrossSalary: 2666.66,
                entryDate: new Date('2021-01-10'),
                birthDate: new Date('1988-12-05'),
                dniExpiration: new Date('2026-11-20'),
                gender: 'MALE',
                workingDayType: 'COMPLETE'
            },
            {
                firstName: 'Elena',
                lastName: 'Gómez Martín',
                dni: '55556666G',
                email: 'elena.gomez@empresa.com',
                phone: '633444555',
                address: 'C/ Blanquerna 5',
                city: 'Palma',
                province: 'Baleares',
                postalCode: '07003',
                jobTitle: 'Responsable RRHH',
                department: 'Recursos Humanos',
                category: 'Responsable',
                contractType: 'Indefinido',
                iban: 'ES9121000418450200053333',
                socialSecurityNumber: '075544332211',
                annualGrossSalary: 35000,
                monthlyGrossSalary: 2916.66,
                entryDate: new Date('2019-05-20'),
                birthDate: new Date('1983-04-12'),
                dniExpiration: new Date('2032-08-10'),
                gender: 'FEMALE',
                workingDayType: 'COMPLETE'
            },
            {
                firstName: 'Roberto',
                lastName: 'Pérez Silva',
                dni: '33334444P',
                email: 'roberto.perez@empresa.com',
                phone: '644555666',
                address: 'Carrer de la Unió 2',
                city: 'Palma',
                province: 'Baleares',
                postalCode: '07001',
                jobTitle: 'Almacenero',
                department: 'Logística',
                category: 'Operario',
                contractType: 'Fijo Discontinuo',
                iban: 'ES9121000418450200054444',
                socialSecurityNumber: '076677889900',
                annualGrossSalary: 20000,
                monthlyGrossSalary: 1666.66,
                entryDate: new Date('2024-02-01'),
                birthDate: new Date('1995-09-30'),
                dniExpiration: new Date('2029-03-25'),
                gender: 'MALE',
                workingDayType: 'PART_TIME',
                weeklyHours: 35
            }
        ];

        for (const data of employeesData) {
            try {
                console.log(`Creating/Updating employee: ${data.firstName} ${data.lastName} (${data.dni})`);

                const employeeData = {
                    ...data,
                    companyId: company.id,
                    name: `${data.firstName} ${data.lastName}`,
                    active: true,
                    vacationDaysTotal: 30
                };

                const employee = await prisma.employee.upsert({
                    where: { dni: data.dni },
                    update: employeeData,
                    create: employeeData
                });

                // Create user for each employee
                const password = await bcrypt.hash('password123', 10);
                await prisma.user.upsert({
                    where: { email: data.email },
                    update: {
                        password: password,
                        role: 'employee',
                        employeeId: employee.id,
                        dni: data.dni
                    },
                    create: {
                        email: data.email,
                        dni: data.dni,
                        password: password,
                        role: 'employee',
                        employeeId: employee.id
                    }
                });
                console.log(`✅ User created/updated for ${data.firstName} (password123)`);
            } catch (err: any) {
                console.error(`❌ Error processing employee ${data.firstName}:`, err.message);
                if (err.code) console.error(`Prisma Error Code: ${err.code}`);
                if (err.meta) console.error(`Metadata:`, JSON.stringify(err.meta));
            }
        }

        console.log('\n🎉 Database seeded successfully!');
        console.log('Admin login: admin@empresa.com / admin123');
    } catch (globalErr: any) {
        console.error('❌ Global Error:', globalErr.message);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
