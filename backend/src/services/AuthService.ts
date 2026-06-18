import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AppError } from '../utils/AppError';
import { normalizeActor } from '../../../shared/authz';
import { signAccessToken } from '../utils/accessTokens';
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7 days

export class AuthService {
    static async login(identifier: string, password: string) {
        const trimmedId = identifier.trim();

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: trimmedId },
                    { dni: { equals: trimmedId, mode: 'insensitive' } }
                ]
            },
            include: {
                employee: {
                    select: {
                        companyId: true
                    }
                }
            }
        });

        if (user && user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
            throw new AppError('Cuenta bloqueada temporalmente. Inténtalo más tarde.', 423);
        }

        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new AppError('Credenciales incorrectas', 401);
        }

        if (!user.isActive) {
            throw new AppError('Usuario deshabilitado. Contacte al administrador.', 403);
        }

        const accessToken = signAccessToken({
            id: user.id,
            sessionVersion: user.sessionVersion
        });

        const refreshToken = crypto.randomBytes(40).toString('hex');
        const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN);

        await prisma.refreshToken.create({
            data: {
                token: hashedRefreshToken,
                userId: user.id,
                expiresAt
            }
        });

        // Remove password from user object
         
        const { password: _password, employee, ...userWithoutPassword } = user;
        const normalizedUser = normalizeActor({
            id: userWithoutPassword.id,
            email: userWithoutPassword.email,
            role: userWithoutPassword.role,
            permissions: userWithoutPassword.permissions
                ? JSON.parse(userWithoutPassword.permissions as string)
                : {},
            employeeId: userWithoutPassword.employeeId,
            companyId: employee?.companyId
        });

        if (!normalizedUser) {
            throw new AppError('Error de configuración de usuario. Contacte al administrador.', 500);
        }

        return {
            user: {
                ...userWithoutPassword,
                role: normalizedUser.role,
                permissions: normalizedUser.permissions,
                companyId: normalizedUser.companyId
            },
            accessToken,
            refreshToken,
            expiresAt
        };
    }
}
