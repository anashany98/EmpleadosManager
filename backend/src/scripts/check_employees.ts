
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const employees = await prisma.employee.count();
    console.log(`Total Employees: ${employees}`);

    const anas = await prisma.employee.findFirst({
        where: { dni: '49480953h' },
        include: { company: true }
    });

    if (anas) {
        console.log('Anas found:', anas.name, anas.dni, 'Company:', anas.company?.name);
    } else {
        console.log('Anas NOT found in Employee table.');
    }

    const companies = await prisma.company.findMany({ include: { _count: { select: { employees: true } } } });
    console.log('Companies:', JSON.stringify(companies, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
