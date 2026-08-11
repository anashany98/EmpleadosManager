import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        employee: { findMany: vi.fn() },
        document: { findMany: vi.fn() },
        hrTask: { findMany: vi.fn() },
        project: { findMany: vi.fn() },
        asset: { findMany: vi.fn() }
    }
}));

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }));

import { GlobalSearchService } from './GlobalSearchService';

describe('GlobalSearchService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.employee.findMany.mockResolvedValue([
            {
                id: 'employee-1',
                name: 'Ana García',
                firstName: 'Ana',
                lastName: 'García',
                dni: '12345678Z',
                department: 'Obras',
                active: true
            }
        ]);
        prismaMock.document.findMany.mockResolvedValue([]);
        prismaMock.hrTask.findMany.mockResolvedValue([]);
        prismaMock.project.findMany.mockResolvedValue([]);
        prismaMock.asset.findMany.mockResolvedValue([]);
    });

    it('returns tenant-scoped, navigable results', async () => {
        const results = await GlobalSearchService.search({
            id: 'user-1',
            email: 'rrhh@example.com',
            role: 'hr',
            companyId: 'company-1',
            permissions: { employees: 'read' }
        } as never, 'Ana');

        expect(results[0]).toEqual({
            id: 'employee-1',
            kind: 'employee',
            title: 'Ana García',
            subtitle: '12345678Z · Obras',
            path: '/employees/employee-1',
            group: 'Empleados'
        });
        expect(prismaMock.employee.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ companyId: 'company-1' })
            })
        );
    });
});
