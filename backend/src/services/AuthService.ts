import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AppError } from '../utils/AppError';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7 days

export class AuthService {
    static async login(identifier: string, password: string) {
        const trimmedId = identifier.trim();

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: trimmedId },
                    { dni: trimmedId },
                    { dni: trimmedId.toLowerCase() },
                    { dni: trimmedId.toUpperCase() }
                ]
            }
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new AppError('Credenciales incorrectas', 401);
        }

        const accessToken = jwt.sign({ id: user.id }, JWT_SECRET, {
            expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        });

        const refreshToken = crypto.randomBytes(40).toString('hex');
        const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN);

        await prisma.refreshToken.create({
            data: {
                token: hashedRefreshToken,
                userId: user.id,
                expiresAt: expiresAt
            }
        });

        // Remove password from user object
        const { password: _, ...userWithoutPassword } = user;

        return {
            user: userWithoutPassword,
            accessToken,
            refreshToken,
            expiresAt
        };
    }
}
