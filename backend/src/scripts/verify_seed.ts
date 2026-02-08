import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function run() {
    const employees = await p.employee.findMany({ select: { id: true, name: true } });
    console.log('--- EMPLOYEES FOUND: ' + employees.length + ' ---');
    employees.forEach(e => console.log(`- ${e.name}`));
    const admins = await p.user.findMany({ where: { role: 'admin' }, select: { email: true } });
    console.log('--- ADMINS FOUND: ' + admins.length + ' ---');
    admins.forEach(a => console.log(`- ${a.email}`));
    await p.$disconnect();
}
run();
