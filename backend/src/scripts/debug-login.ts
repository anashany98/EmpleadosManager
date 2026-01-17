
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-123';

async function main() {
    console.log('--- START DEBUG LOGIN ---');
    const loginId = 'admin@admin.com'; // Change if needed
    const password = 'any';

    console.log(`Attempting login for: ${loginId}`);

    try {
        const trimmedId = loginId.trim();
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: trimmedId },
                    { dni: trimmedId },
                    { dni: { equals: trimmedId.toUpperCase() } } // Fix logic slightly to match controller structure
                ]
            }
        });

        console.log('User query result:', user ? `Found (ID: ${user.id})` : 'Not Found');

        if (!user) {
            console.log('User not found. Stopping.');
            return;
        }

        console.log('User password hash length:', user.password ? user.password.length : 'NULL');

        console.log('Running bcrypt.compare...');
        const match = await bcrypt.compare(password, user.password);
        console.log('Bcrypt result:', match);

        if (!match) {
            console.log('Password mismatch (Expected 401)');
            // continue just to test other parts?
        }

        console.log('Generating tokens...');
        const accessToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = crypto.randomBytes(40).toString('hex');

        console.log('Creating refresh token in DB...');
        // Simulating the exact call from controller
        await (prisma as any).refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 1000 * 60 * 60)
            }
        });
        console.log('Refresh token created.');

        console.log('--- SUCCESS ---');

    } catch (e) {
        console.error('--- CRASH DETECTED ---');
        console.error(e);
    }
}

main().finally(() => prisma.$disconnect());
