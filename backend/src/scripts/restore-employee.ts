import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const dni = '43773739R';
    console.log(`Ensuring employee with DNI ${dni} exists...`);

    let company = await prisma.company.findFirst();
    if (!company) {
        company = await prisma.company.create({
            data: {
                name: 'Empresa Demo',
                cif: 'B12345678'
            }
        });
    }

    const existing = await prisma.employee.findUnique({ where: { dni } });
    if (existing) {
        console.log('Employee already exists.');
    } else {
        await prisma.employee.create({
            data: {
                name: 'Carmen Martinez Diaz',
                firstName: 'Carmen',
                lastName: 'Martinez Diaz',
                dni: dni,
                email: 'carmen.martinez@demo.com',
                companyId: company.id,
                active: true,
                contractType: 'Indefinido',
                department: 'Administración',
                jobTitle: 'Responsable RRHH',
                entryDate: new Date(),
                birthDate: new Date('1985-05-15'),
                gender: 'FEMALE'
            }
        });
        console.log('Employee created successfully.');
    }

    // Clean up any potential stale User link to allow fresh registration
    const user = await prisma.user.findUnique({ where: { dni } });
    if (user) {
        console.log('Deleting stale user account to allow fresh activation...');
        await prisma.user.delete({ where: { dni } });
    }

    await prisma.$disconnect();
}

main();
