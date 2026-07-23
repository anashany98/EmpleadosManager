import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
    prisma: {
        project: {
            findUnique: vi.fn()
        }
    }
}));

import { prisma } from '../lib/prisma';
import { ObraAuthorization } from './obraAuthorization';
import { AppError } from '../utils/AppError';

describe('ObraAuthorization.ensureCanAccess', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('admin puede acceder a cualquier obra (con o sin managerId)', async () => {
        (prisma.project.findUnique as any).mockResolvedValue({ id: 'o1', status: 'ACTIVE', managerId: null });
        const obra = await ObraAuthorization.ensureCanAccess('o1', { role: 'admin', id: 'u1', companyId: 'c1', employeeId: 'e1' } as any);
        expect(obra.id).toBe('o1');
    });

    it('hr puede acceder a cualquier obra', async () => {
        (prisma.project.findUnique as any).mockResolvedValue({ id: 'o1', status: 'ACTIVE', managerId: 'emp-other' });
        const obra = await ObraAuthorization.ensureCanAccess('o1', { role: 'hr', id: 'u1', companyId: 'c1', employeeId: 'e1' } as any);
        expect(obra.id).toBe('o1');
    });

    it('manager asignado puede acceder a su obra', async () => {
        (prisma.project.findUnique as any).mockResolvedValue({ id: 'o1', status: 'ACTIVE', managerId: 'emp-self' });
        const obra = await ObraAuthorization.ensureCanAccess('o1', { role: 'manager', id: 'u1', companyId: 'c1', employeeId: 'emp-self' } as any);
        expect(obra.id).toBe('o1');
    });

    it('manager NO puede acceder a obra de otro manager (403)', async () => {
        (prisma.project.findUnique as any).mockResolvedValue({ id: 'o1', status: 'ACTIVE', managerId: 'emp-other' });
        await expect(ObraAuthorization.ensureCanAccess('o1', { role: 'manager', id: 'u1', companyId: 'c1', employeeId: 'emp-self' } as any))
            .rejects.toMatchObject({ statusCode: 403 });
    });

    // Test del fix crítico del bypass
    it('manager NO puede acceder a obra SIN managerId asignado (403, no bypass)', async () => {
        (prisma.project.findUnique as any).mockResolvedValue({ id: 'o1', status: 'ACTIVE', managerId: null });
        await expect(ObraAuthorization.ensureCanAccess('o1', { role: 'manager', id: 'u1', companyId: 'c1', employeeId: 'emp-self' } as any))
            .rejects.toMatchObject({ statusCode: 403 });
    });

    it('manager sin employeeId no puede acceder (no se puede identificar)', async () => {
        (prisma.project.findUnique as any).mockResolvedValue({ id: 'o1', status: 'ACTIVE', managerId: null });
        await expect(ObraAuthorization.ensureCanAccess('o1', { role: 'manager', id: 'u1', companyId: 'c1' } as any))
            .rejects.toMatchObject({ statusCode: 403 });
    });

    it('employee (no manager/admin/hr) no puede acceder (403)', async () => {
        (prisma.project.findUnique as any).mockResolvedValue({ id: 'o1', status: 'ACTIVE', managerId: null });
        await expect(ObraAuthorization.ensureCanAccess('o1', { role: 'employee', id: 'u1', companyId: 'c1', employeeId: 'e1' } as any))
            .rejects.toMatchObject({ statusCode: 403 });
    });

    it('lanza 404 si la obra no existe', async () => {
        (prisma.project.findUnique as any).mockResolvedValue(null);
        await expect(ObraAuthorization.ensureCanAccess('nope', { role: 'admin', id: 'u1', companyId: 'c1' } as any))
            .rejects.toBeInstanceOf(AppError);
        await expect(ObraAuthorization.ensureCanAccess('nope', { role: 'admin', id: 'u1', companyId: 'c1' } as any))
            .rejects.toMatchObject({ statusCode: 404 });
    });
});
