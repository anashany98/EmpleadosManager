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
    beforeEach(() => {
        vi.clearAllMocks();
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

        const decoded = jwt.verify(result.accessToken, process.env.JWT_SECRET || 'test-jwt-secret') as {
            id: string;
            sessionVersion: number;
        };

        expect(decoded.id).toBe('user-1');
        expect(decoded.sessionVersion).toBe(7);
        expect(result.user.companyId).toBe('company-1');
    });
});
