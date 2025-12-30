import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const profileName = 'Visualizador Global (Solo Lectura)';

    // Define read-only permissions
    const permissions = {
        dashboard: 'read',
        employees: 'read',
        payroll: 'read',
        companies: 'read',
        calendar: 'read',
        timesheet: 'read',
        assets: 'read',
        projects: 'read',
        reports: 'read',
        inventory: 'read',
        // System modules hidden/disabled
        audit: 'none',
        users: 'none'
    };

    console.log(`Seeding profile: ${profileName}...`);

    await prisma.permissionProfile.upsert({
        where: { name: profileName },
        update: {
            permissions: JSON.stringify(permissions)
        },
        create: {
            name: profileName,
            permissions: JSON.stringify(permissions)
        }
    });

    console.log('✅ Profile created/updated successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
