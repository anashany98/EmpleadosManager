import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const dni = '43773739R';
    console.log(`Checking status for DNI: ${dni}`);

    const employee = await prisma.employee.findUnique({ where: { dni } });
    console.log('Employee:', employee ? 'FOUND' : 'NOT FOUND');
    if (employee) {
        console.log('Employee Details:', JSON.stringify({ id: employee.id, name: employee.name, email: employee.email }));
    }

    const linkedUser = await prisma.user.findFirst({
        where: { OR: [{ dni: dni }, { employeeId: employee?.id }] }
    });
    console.log('Linked User:', linkedUser ? 'FOUND' : 'NOT FOUND');
    if (linkedUser) {
        console.log('User Details:', JSON.stringify({ id: linkedUser.id, email: linkedUser.email, role: linkedUser.role, dni: linkedUser.dni }));
    }

    await prisma.$disconnect();
}

main();
