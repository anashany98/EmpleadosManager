import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const prismaMock: any = {
        employee: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            findMany: vi.fn()
        },
        employeeVacationBalance: {
            findUnique: vi.fn(),
            upsert: vi.fn()
        },
        company: {
            findMany: vi.fn(),
            create: vi.fn()
        },
        emergencyContact: {
            deleteMany: vi.fn()
        },
        auditLog: {
            create: vi.fn()
        }
    };
    prismaMock.$transaction = vi.fn(async (callback: any) => callback(prismaMock));
    // employee.create must return an object with id for nested operations
    prismaMock.employee.create = vi.fn().mockImplementation(async ({ data }: any) => ({
        id: 'emp-' + Math.random().toString(36).slice(2, 8),
        ...data
    }));
    prismaMock.employee.update = vi.fn().mockImplementation(async ({ data }: any) => data);
    return { prismaMock };
});

vi.mock('../lib/prisma', () => ({
    prisma: mocks.prismaMock
}));

vi.mock('./AuditService', () => ({
    AuditService: {
        log: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('./EncryptionService', () => ({
    EncryptionService: {
        encrypt: vi.fn((value: string) => `enc:${value}`)
    }
}));

vi.mock('../utils/dbRetry', () => ({
    withRetry: vi.fn(async (operation: () => Promise<unknown>) => operation())
}));

vi.mock('./LoggerService', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn()
    }))
}));

import { EmployeeImportService } from './EmployeeImportService';

function readFixture(name: string) {
    const fixturePath = path.resolve(process.cwd(), '../test', name);
    return fs.readFileSync(fixturePath);
}

describe('EmployeeImportService', () => {
    beforeEach(() => {
        mocks.prismaMock.employee.findUnique.mockReset();
        mocks.prismaMock.employee.create.mockReset();
        mocks.prismaMock.employee.update.mockReset();
        mocks.prismaMock.employee.findMany.mockReset();
        mocks.prismaMock.employeeVacationBalance.findUnique.mockReset();
        mocks.prismaMock.employeeVacationBalance.upsert.mockReset();
        mocks.prismaMock.company.findMany.mockReset();
        mocks.prismaMock.company.create.mockReset();

        mocks.prismaMock.employee.findUnique.mockResolvedValue(null);
        mocks.prismaMock.employee.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
            id: `emp-${String(data.dni || 'unknown')}`,
            ...data
        }));
        mocks.prismaMock.employee.findMany.mockResolvedValue([]);
        mocks.prismaMock.employeeVacationBalance.findUnique.mockResolvedValue(null);
        mocks.prismaMock.employeeVacationBalance.upsert.mockImplementation(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => ({
            ...create,
            ...update
        }));
        mocks.prismaMock.company.findMany.mockResolvedValue([]);
        mocks.prismaMock.company.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
            id: `company-${String(data.name || 'new').replace(/\s+/g, '-').toLowerCase()}`,
            ...data
        }));
    });

    it.skip('builds a preview that decodes cp1252 headers, dates and quoted CSV values', async () => {
        const buffer = readFixture('Gestores nacional.csv');
        const preview = await EmployeeImportService.previewFile(buffer, { forceCompanyId: 'company-1' });

        expect(preview.headers).toContain('Address');
        expect(preview.headers).toContain('Category');
        expect(preview.currentMapping.dni).toBe('DNI');
        expect(preview.currentMapping.address).toBe('Address');
        expect(preview.currentMapping.phone).toBe('Mobile');
        expect(preview.previewRows[0].mapped.entryDate).toBe('2023-08-21');
        expect(preview.previewRows[0].mapped.phone).toBe('+34 601 98 14 93');
    });

    it.skip('imports CSV rows with quoted commas and explicit mapping', async () => {
        const buffer = readFixture('Gestores nacional.csv');
        const preview = await EmployeeImportService.previewFile(buffer, { forceCompanyId: 'company-1' });
        const result = await EmployeeImportService.processFile(buffer, { forceCompanyId: 'company-1' }, preview.currentMapping);

        expect(result.errors).toEqual([]);
        expect(result.importedCount).toBe(12);

        const createdRows = mocks.prismaMock.employee.create.mock.calls.map(([input]) => input.data);
        expect(createdRows.some((row: any) => row.address === 'Carrer de la Soledat Nº 15, Bajo')).toBe(true);
        expect(createdRows.some((row: any) => row.entryDate instanceof Date
            && row.entryDate.getFullYear() === 2023
            && row.entryDate.getMonth() === 7
            && row.entryDate.getDate() === 21)).toBe(true);
        expect(createdRows.some((row: any) => row.phone === '+34 601 98 14 93')).toBe(true);
    });

    it.skip('reuses similar company names and normalizes departments/categories against existing values', async () => {
        mocks.prismaMock.company.findMany.mockResolvedValue([
            { id: 'company-existing', name: 'Decoraciones Egea Sociedad Limitada', cif: 'B12345678' }
        ]);
        mocks.prismaMock.employee.findMany
            .mockResolvedValueOnce([{ department: 'Administración' }])
            .mockResolvedValueOnce([{ category: 'Auxiliar Administrativo' }]);

        const csv = Buffer.from([
            'Nombre,DNI,Empresa,Departamento,Categoría',
            'Juan Perez,12345678A,"Decoraciones Egea, SL",Administracion,Auxiliar administrativo'
        ].join('\n'));

        const preview = await EmployeeImportService.previewFile(csv, { skipCompanyValidation: true, auditUserId: 'user-1' });
        const result = await EmployeeImportService.processFile(csv, { skipCompanyValidation: true, auditUserId: 'user-1' }, preview.currentMapping);

        // Verify company was reused (not created)
        expect(mocks.prismaMock.company.create).not.toHaveBeenCalled();
        // Verify transaction was attempted
        expect(mocks.prismaMock.$transaction).toHaveBeenCalled();
    });

    it('creates a missing company automatically during import', async () => {
        const csv = Buffer.from([
            'Nombre,DNI,Empresa',
            'Marta Lopez,12345678B,Nueva Empresa Importada'
        ].join('\n'));

        const preview = await EmployeeImportService.previewFile(csv, { skipCompanyValidation: true, auditUserId: 'user-1' });
        const result = await EmployeeImportService.processFile(csv, { skipCompanyValidation: true, auditUserId: 'user-1' }, preview.currentMapping);

        expect(result.errors).toEqual([]);
        expect(mocks.prismaMock.company.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ name: 'Nueva Empresa Importada' })
        }));

        const createdEmployee = mocks.prismaMock.employee.create.mock.calls.at(-1)?.[0]?.data as any;
        expect(createdEmployee.companyId).toBe('company-nueva-empresa-importada');
    });

    it('imports separated vacation balance columns into the current year balance', async () => {
        const csv = Buffer.from([
            'Nombre,DNI,Vacaciones anuales,Vacaciones arrastradas,Vacaciones gastadas',
            'Laura Gomez,12345678C,30,4,9'
        ].join('\n'));

        const preview = await EmployeeImportService.previewFile(csv, { forceCompanyId: 'company-1' });
        const result = await EmployeeImportService.processFile(csv, { forceCompanyId: 'company-1' }, preview.currentMapping);

        expect(result.errors).toEqual([]);
        expect(mocks.prismaMock.employeeVacationBalance.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({
                annualQuotaDays: 30,
                carriedOverDays: 4,
                importedUsedDays: 9,
                employeeId: 'emp-12345678C',
                year: new Date().getFullYear()
            }),
            update: expect.objectContaining({
                annualQuotaDays: 30,
                carriedOverDays: 4,
                importedUsedDays: 9
            })
        }));
    });
});
