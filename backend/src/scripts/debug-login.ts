// DEBUG ONLY SCRIPT - Never run in production!
// This script is for debugging login issues locally.

import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('ERROR: JWT_SECRET is required. Set it in .env or environment variables.');
    process.exit(1);
}

async function main() {
    console.log('--- START DEBUG LOGIN ---');
    const loginId = process.argv[2] || 'admin@admin.com';
    const password = process.argv[3] || 'DEBUG_ONLY';

    console.log(`Attempting login for: ${loginId}`);

    try {
        const trimmedId = loginId.trim();
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: trimmedId },
                    { dni: trimmedId },
                    { dni: { equals: trimmedId.toUpperCase() } }
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
        }

        console.log('Generating tokens...');
        jwt.sign({ id: user.id }, JWT_SECRET || 'test-secret', { algorithm: 'HS256', expiresIn: '15m' });
        const refreshToken = crypto.randomBytes(40).toString('hex');

        console.log('Creating refresh token in DB...');
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