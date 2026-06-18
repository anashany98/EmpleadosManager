
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('ERROR: JWT_SECRET is required. Set it in .env or environment variables.');
    process.exit(1);
}

async function main() {
    const user = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (!user) {
        console.log('No admin found');
        return;
    }
    const token = jwt.sign({ id: user.id }, JWT_SECRET || 'test-secret', { algorithm: 'HS256', expiresIn: '1h' });
    console.log('TOKEN:', token);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());

