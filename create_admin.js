const { PrismaClient } = require('@prisma/client');
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'prisma', 'dev.db');
const url = `file:${dbPath}`;

console.log('Connecting to DB at:', url);

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: url,
        },
    },
});

async function createAdmin() {
    const email = 'admin@empresa.com';
    const hashedPassword = '$2b$10$uUdwXmwvbNYFTKWfQditk.FjEatxXWXWlBJH4l4c2wN02Olgie2EK'; // admin123

    try {
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                password: hashedPassword,
                role: 'admin'
            },
            create: {
                email,
                password: hashedPassword,
                role: 'admin'
            }
        });
        console.log('✅ Admin user created/updated:', user.email);
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();
