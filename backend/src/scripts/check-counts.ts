import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const uCount = await prisma.user.count();
    const eCount = await prisma.employee.count();
    console.log(`Users: ${uCount}, Employees: ${eCount}`);
    await prisma.$disconnect();
}

main();
