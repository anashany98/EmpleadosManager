import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const dni = '43773739R';
    console.log(`Searching for DNI: "${dni}"`);

    // Exact match
    const empExact = await prisma.employee.findUnique({ where: { dni } });
    console.log('Exact match:', empExact ? 'FOUND' : 'NOT FOUND');

    // Case insensitive/loose match
    const employees = await prisma.employee.findMany({
        where: {
            dni: {
                contains: dni.trim()
            }
        }
    });
    console.log(`Found ${employees.length} matches with contains:`, employees.map(e => `|${e.dni}|`));

    // List all
    const all = await prisma.employee.findMany({ take: 5 });
    console.log('Sample employees:', all.map(e => `|${e.dni}|`));

    await prisma.$disconnect();
}

main();
