
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

async function main() {
    const user = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (!user) {
        console.log('No admin found');
        return;
    }
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
    console.log('TOKEN:', token);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
