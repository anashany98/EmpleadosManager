
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const payroll = await prisma.payrollRow.findFirst();
    console.log('PAYROLL_ID:', payroll?.id);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
