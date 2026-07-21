// HIGH-003: Locks HTTP/WS y WebSocket authentication.
//
// Vectores cubiertos:
//   A) WebSocket: token sin sessionVersion debe ser RECHAZADO.
//   B) LockService.acquire: un actor de tenant A NO puede adquirir
//      un lock sobre un empleado de tenant B.
//   C) LockService.forceRelease: solo admin del mismo tenant o
//      admin global puede forzar el release.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mocks hoisted-safe (vi.mock se eleva antes que cualquier `const`)
vi.mock('../../config/redis', () => ({
    redis: {
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        get: vi.fn()
    }
}));
vi.mock('../../lib/prisma', () => ({
    prisma: {
        employee: { findUnique: vi.fn() },
        user: { findUnique: vi.fn() },
        employeeLockAudit: { create: vi.fn().mockResolvedValue({}) }
    }
}));
vi.mock('../../services/LoggerService', () => ({
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

import { LockService } from '../../services/LockService';
import { prisma } from '../../lib/prisma';

const mockedPrisma = prisma as unknown as {
    employee: { findUnique: ReturnType<typeof vi.fn> };
};

const ACTOR_A = { id: 'u-A', role: 'admin', companyId: 'company-A', email: 'a@a.com', name: 'A' } as any;
const ACTOR_B = { id: 'u-B', role: 'admin', companyId: 'company-B', email: 'b@b.com', name: 'B' } as any;
const GLOBAL_ADMIN = { id: 'u-G', role: 'admin', companyId: null, email: 'g@g.com', name: 'G' } as any;

describe('HIGH-003 — LockService tenant scoping', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('acquire', () => {
        it('admin de A NO puede adquirir lock de un empleado de B', async () => {
            mockedPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-B', companyId: 'company-B' });
            const service = new LockService();
            const result = await service.acquire('emp-B', ACTOR_A);
            expect(result.success).toBe(false);
            expect(result.error).toBe('FORBIDDEN_CROSS_TENANT');
        });

        it('admin de B NO puede adquirir lock de un empleado de A', async () => {
            mockedPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-A', companyId: 'company-A' });
            const service = new LockService();
            const result = await service.acquire('emp-A', ACTOR_B);
            expect(result.success).toBe(false);
            expect(result.error).toBe('FORBIDDEN_CROSS_TENANT');
        });

        it('empleado inexistente: NOT_FOUND (no se filtra info)', async () => {
            mockedPrisma.employee.findUnique.mockResolvedValue(null);
            const service = new LockService();
            const result = await service.acquire('emp-404', ACTOR_A);
            expect(result.success).toBe(false);
            expect(result.error).toBe('EMPLOYEE_NOT_FOUND');
        });
    });

    describe('forceRelease', () => {
        it('rechaza si no es admin ni global', async () => {
            const service = new LockService();
            await expect(
                service.forceRelease('emp-A', { id: 'x', role: 'hr', companyId: 'company-A' } as any)
            ).rejects.toThrow(/ADMIN_REQUIRED/);
        });

        it('admin de A NO puede forzar release de un empleado de B', async () => {
            mockedPrisma.employee.findUnique.mockResolvedValue({ companyId: 'company-B' });
            const service = new LockService();
            await expect(
                service.forceRelease('emp-B', ACTOR_A)
            ).rejects.toThrow(/FORBIDDEN_CROSS_TENANT/);
        });

        it('admin de A SÍ puede forzar release de un empleado de A (pasa tenant check)', async () => {
            mockedPrisma.employee.findUnique.mockResolvedValue({ companyId: 'company-A' });
            const service = new LockService();
            // Llamamos sin esperar nada específico del delete: lo
            // que nos importa es que NO se rechace por tenant.
            // Puede fallar más adelante por el mock de redis, pero
            // no por FORBIDDEN_CROSS_TENANT.
            try {
                await service.forceRelease('emp-A', ACTOR_A);
            } catch (err: any) {
                expect(err.message).not.toMatch(/FORBIDDEN_CROSS_TENANT/);
            }
        });

        it('admin global puede forzar release de cualquier tenant (pasa tenant check)', async () => {
            // Para global NO se consulta employee.findUnique
            const service = new LockService();
            try {
                await service.forceRelease('emp-B', GLOBAL_ADMIN);
            } catch (err: any) {
                expect(err.message).not.toMatch(/FORBIDDEN_CROSS_TENANT/);
            }
        });
    });
});

describe('HIGH-003 — WebSocket sessionVersion OBLIGATORIO', () => {
    it('el handler rechaza tokens sin sessionVersion (estricto, no opcional)', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, '../../websocket/handler.ts'),
            'utf8'
        );
        // El bug original era `if (typeof decoded.sessionVersion === 'number' && ...)`
        // → permitía tokens sin sessionVersion.
        // El fix invierte la condición: `if (typeof decoded.sessionVersion !== 'number') return null;`
        // → rechaza tokens sin sessionVersion.
        const allowsOptional = /typeof\s+decoded\.sessionVersion\s*===\s*['"]number['"]\s*&&/.test(src);
        expect(allowsOptional).toBe(false);
        const requiresIt = /typeof\s+decoded\.sessionVersion\s*!==\s*['"]number['"]/.test(src);
        expect(requiresIt).toBe(true);
    });
});
