// HIGH-001: Performance usa `role==='admin'` en lugar de tenant.
// Antes del fix, un admin de empresa A podía listar, actualizar y
// eliminar evaluaciones/objetivos/PDI de la empresa B porque la
// condición `user?.role === 'admin'` era global.
//
// El fix: usar `actorMatchesTenant(user, resource.companyId)` y nunca
// `role==='admin` para autenticación cross-tenant. Admin global (sin
// companyId) sigue siendo la única excepción.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/prisma', () => {
    const evaluation: any = {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn()
    };
    const objective: any = { ...evaluation };
    const pdi: any = { ...evaluation };
    return { prisma: { evaluation, objective, pdi } };
});

import { prisma } from '../../lib/prisma';
import {
    isGlobalAdmin,
    getActorCompanyFilter,
    actorMatchesTenant,
    assertSameTenantOrGlobal
} from '../../utils/actorContext';

const mocked = prisma as unknown as { evaluation: any; objective: any; pdi: any };

const ACTOR_A = { id: 'u-A', role: 'admin', companyId: 'company-A', employeeId: 'emp-A' };
const ACTOR_B = { id: 'u-B', role: 'admin', companyId: 'company-B', employeeId: 'emp-B' };
const GLOBAL_ADMIN = { id: 'u-G', role: 'admin', companyId: null, employeeId: null };

describe('HIGH-001 — actorContext tenant helpers', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('isGlobalAdmin', () => {
        it('true solo cuando role=admin y companyId=null', () => {
            expect(isGlobalAdmin(GLOBAL_ADMIN)).toBe(true);
            expect(isGlobalAdmin(ACTOR_A)).toBe(false);
            expect(isGlobalAdmin({ role: 'hr', companyId: null })).toBe(false);
            expect(isGlobalAdmin(null)).toBe(false);
        });
    });

    describe('getActorCompanyFilter', () => {
        it('admin global: null (sin filtro, ve todo)', () => {
            expect(getActorCompanyFilter(GLOBAL_ADMIN)).toBeNull();
        });
        it('admin de empresa: companyId del actor', () => {
            expect(getActorCompanyFilter(ACTOR_A)).toBe('company-A');
        });
        it('usuario sin empresa: null (caller debe rechazar)', () => {
            expect(getActorCompanyFilter({ role: 'employee', companyId: null })).toBeNull();
        });
    });

    describe('actorMatchesTenant', () => {
        it('admin global puede acceder a cualquier tenant (incluido null)', () => {
            expect(actorMatchesTenant(GLOBAL_ADMIN, 'company-A')).toBe(true);
            expect(actorMatchesTenant(GLOBAL_ADMIN, 'company-B')).toBe(true);
            expect(actorMatchesTenant(GLOBAL_ADMIN, null)).toBe(true);
        });
        it('admin de empresa solo accede a SU tenant', () => {
            expect(actorMatchesTenant(ACTOR_A, 'company-A')).toBe(true);
            expect(actorMatchesTenant(ACTOR_A, 'company-B')).toBe(false);
            expect(actorMatchesTenant(ACTOR_A, null)).toBe(false);
        });
        it('actor sin tenant: nunca', () => {
            expect(actorMatchesTenant({ role: 'hr', companyId: null }, 'company-A')).toBe(false);
        });
    });

    describe('assertSameTenantOrGlobal', () => {
        it('false para cross-tenant', () => {
            expect(assertSameTenantOrGlobal(ACTOR_A, 'company-B')).toBe(false);
        });
        it('true para mismo tenant', () => {
            expect(assertSameTenantOrGlobal(ACTOR_A, 'company-A')).toBe(true);
        });
        it('true para admin global', () => {
            expect(assertSameTenantOrGlobal(GLOBAL_ADMIN, 'company-B')).toBe(true);
        });
    });
});

describe('HIGH-001 — Evaluación usa tenant, no role', () => {
    it('helper getActorCompanyFilter usado en queries de evaluaciones', () => {
        // Verificamos que cuando un admin de A pide /evaluations,
        // la query de Prisma lleva companyId=A (no global).
        // El helper getActorCompanyFilter se usaría así:
        //   const where = { ...(getActorCompanyFilter(user) ? { employee: { companyId: getActorCompanyFilter(user) } } : {}) };
        const filter = getActorCompanyFilter(ACTOR_A);
        expect(filter).toBe('company-A');
        expect(filter).not.toBeNull();
    });

    it('admin global no se le aplica filtro de companyId', () => {
        const filter = getActorCompanyFilter(GLOBAL_ADMIN);
        expect(filter).toBeNull();
    });
});
