
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    console.log('--- DATABASE DIAGNOSTIC ---');
    const companies = await prisma.company.findMany();
    console.log('Companies:', companies.length);
    companies.forEach(c => console.log(` - ${c.name} (${c.id})`));

    const employees = await prisma.employee.count();
    console.log('Total Employees:', employees);

    const activeEmployees = await prisma.employee.count({ where: { active: true } });
    console.log('Active Employees:', activeEmployees);

    const timeEntries = await prisma.timeEntry.count();
    console.log('Time Entries:', timeEntries);

    const vacations = await prisma.vacation.count();
    console.log('Vacations:', vacations);

    const alertCount = await prisma.alert.count();
    console.log('Alerts:', alertCount);

    await prisma.$disconnect();
}

check().catch(console.error);
