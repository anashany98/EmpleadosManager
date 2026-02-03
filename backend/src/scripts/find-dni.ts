import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const employees = await prisma.employee.findMany({
        take: 10,
        select: { dni: true, name: true }
    });
    const valid = employees.find(e => e.dni);
    console.log(JSON.stringify(valid || employees[0]));
    await prisma.$disconnect();
}

main();
