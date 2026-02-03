
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const url = process.env.DATABASE_URL;
        console.log('Using DATABASE_URL:', url);
        const employees = await prisma.employee.findMany({
            select: { name: true, createdAt: true }
        });
        console.log(`Found ${employees.length} employees:`);
        employees.forEach(e => console.log(`- ${e.name}`));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
