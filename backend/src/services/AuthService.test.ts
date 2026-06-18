import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AuthService } from './AuthService';
import { prisma } from '../lib/prisma';

vi.mock('../lib/prisma', () => ({
    prisma: {
        user: {
            findFirst: vi.fn()
        },
        refreshToken: {
            create: vi.fn()
        }
    }
}));

vi.mock('bcryptjs', () => ({
    default: {
        compare: vi.fn()
    }
}));



describe('AuthService.login', () => {
    const mockUser = {
        id: 'user-1',
        email: 'test@empresa.com',
        dni: '12345678A',
        password: 'hashed-password',
        role: 'employee',
        permissions: '{"dashboard":"read"}',
        employeeId: 'emp-1',
        isActive: true,
        sessionVersion: 0,
        lockedUntil: null,
        failedLoginAttempts: 0,
        employee: { companyId: 'company-1' },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should login successfully with email and correct password', async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as any);
        vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);

        const result = await AuthService.login('test@empresa.com', 'correct-password');

        expect(result.accessToken).toBeTruthy();
        expect(result.user.email).toBe('test@empresa.com');
        expect(result.user.role).toBe('employee');
    });

    it('should throw 401 with incorrect password', async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as any);

        await expect(
            AuthService.login('test@empresa.com', 'wrong-password')
        ).rejects.toThrow('Credenciales incorrectas');
    });

    it('should throw 401 when user not found', async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

        await expect(
            AuthService.login('unknown@empresa.com', 'password')
        ).rejects.toThrow('Credenciales incorrectas');
    });

    it('should throw 403 when user is inactive', async () => {
        const inactiveUser = { ...mockUser, isActive: false };
        vi.mocked(prisma.user.findFirst).mockResolvedValue(inactiveUser as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as any);

        await expect(
            AuthService.login('test@empresa.com', 'correct-password')
        ).rejects.toThrow('Usuario deshabilitado');
    });

    it('should throw 423 when account is locked', async () => {
        const futureDate = new Date(Date.now() + 3600000);
        const lockedUser = { ...mockUser, lockedUntil: futureDate };
        vi.mocked(prisma.user.findFirst).mockResolvedValue(lockedUser as any);

        await expect(
            AuthService.login('test@empresa.com', 'correct-password')
        ).rejects.toThrow('Cuenta bloqueada');
    });

    it('should login with DNI (case insensitive)', async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as any);
        vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);

        const result = await AuthService.login('12345678a', 'correct-password');

        expect(result.accessToken).toBeTruthy();
    });

    it('returns the company scope for company admins and keeps sessionVersion in the access token', async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: 'user-1',
            email: 'admin@company.test',
            dni: '12345678A',
            password: 'hashed-password',
            role: 'admin',
            permissions: JSON.stringify({ employees: 'write' }),
            employeeId: 'emp-1',
            sessionVersion: 7,
            isActive: true,
            employee: {
                companyId: 'company-1'
            }
        } as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(prisma.refreshToken.create).mockResolvedValue({ id: 'rt-1' } as never);

        const result = await AuthService.login('admin@company.test', 'secret');

        const decoded = jwt.verify(result.accessToken, process.env.JWT_SECRET || 'test-jwt-secret', { algorithms: ['HS256'] }) as {
            id: string;
            sessionVersion: number;
        };

        expect(decoded.id).toBe('user-1');
        expect(decoded.sessionVersion).toBe(7);
        expect(result.user.companyId).toBe('company-1');
    });
});
