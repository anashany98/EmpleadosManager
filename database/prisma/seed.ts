import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Adding seed data...');

    // Create Employees
    const employees = await Promise.all([
        prisma.employee.create({
            data: {
                name: 'Ana García',
                dni: '12345678A',
                subaccount465: '46500001',
                vacations: {
                    create: [
                        { startDate: new Date('2025-01-10'), endDate: new Date('2025-01-20'), type: 'VACATION', status: 'APPROVED' },
                        { startDate: new Date('2025-02-15'), endDate: new Date('2025-02-18'), type: 'SICK', status: 'APPROVED' }
                    ]
                }
            }
        }),
        prisma.employee.create({
            data: {
                name: 'Carlos Rodríguez',
                dni: '87654321B',
                subaccount465: '46500002',
                vacations: {
                    create: [
                        { startDate: new Date('2024-12-24'), endDate: new Date('2025-01-02'), type: 'VACATION', status: 'APPROVED' }
                    ]
                }
            }
        }),
        prisma.employee.create({
            data: {
                name: 'Lucía Fernández',
                dni: '11223344C',
                subaccount465: '46500003',
                vacations: {
                    create: [
                        { startDate: new Date('2025-03-01'), endDate: new Date('2025-08-01'), type: 'MATERNITY', status: 'APPROVED' }
                    ]
                }
            }
        }),
        prisma.employee.create({
            data: {
                name: 'Miguel Ángel Torres',
                dni: '99887766D',
                subaccount465: '46500004'
            }
        })
    ]);

    console.log(`✅ Added ${employees.length} employees with vacations.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
