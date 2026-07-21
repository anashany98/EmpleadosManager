// HIGH-002: Anomalies, time entries y calendar verifican tenant.
// Antes, un admin de A podía ver/actualizar anomalías de B
// (where: {}), crear fichajes manuales para empleados de B
// (chequeo solo para admin+companyId), y editar/borrar eventos
// de calendario de B (service sin filtro).
//
// El fix: los controllers usan `assertSameTenantOrGlobal(user, target.companyId)`
// antes de cualquier lectura/mutación, y las queries se filtran
// por `employee.companyId` o `companyId` cuando el actor no es global.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertSameTenantOrGlobal, isGlobalAdmin, getActorCompanyFilter } from '../../utils/actorContext';

const ACTOR_A = { id: 'u-A', role: 'admin', companyId: 'company-A' };
const ACTOR_B = { id: 'u-B', role: 'admin', companyId: 'company-B' };
const ACTOR_HR_B = { id: 'u-HR-B', role: 'hr', companyId: 'company-B' };
const GLOBAL_ADMIN = { id: 'u-G', role: 'admin', companyId: null };

describe('HIGH-002 — actor context para anomalías/fichajes/calendario', () => {
    beforeEach(() => vi.clearAllMocks());

    it('cross-tenant manual time entry queda bloqueado', () => {
        // TimeEntryController.createManual antes validaba solo
        // `role==='admin' && companyId`. Ahora cualquier actor
        // (admin/HR/manager) debe pertenecer al mismo tenant.
        expect(assertSameTenantOrGlobal(ACTOR_B, 'company-A')).toBe(false);
        expect(assertSameTenantOrGlobal(ACTOR_HR_B, 'company-A')).toBe(false);
    });

    it('HR del mismo tenant puede crear fichajes manuales', () => {
        expect(assertSameTenantOrGlobal(ACTOR_HR_B, 'company-B')).toBe(true);
    });

    it('admin global puede cruzar tenants', () => {
        expect(assertSameTenantOrGlobal(GLOBAL_ADMIN, 'company-A')).toBe(true);
        expect(assertSameTenantOrGlobal(GLOBAL_ADMIN, 'company-B')).toBe(true);
        expect(assertSameTenantOrGlobal(GLOBAL_ADMIN, null)).toBe(true);
    });

    it('recurso huérfano (null companyId) solo para global', () => {
        expect(assertSameTenantOrGlobal(ACTOR_A, null)).toBe(false);
        expect(assertSameTenantOrGlobal(GLOBAL_ADMIN, null)).toBe(true);
    });

    it('getActorCompanyFilter retorna null para global, companyId para tenant', () => {
        expect(getActorCompanyFilter(GLOBAL_ADMIN)).toBeNull();
        expect(getActorCompanyFilter(ACTOR_A)).toBe('company-A');
        expect(getActorCompanyFilter(ACTOR_HR_B)).toBe('company-B');
        expect(getActorCompanyFilter({ role: 'employee', companyId: null })).toBeNull();
    });

    it('isGlobalAdmin distingue admin de tenant de admin global', () => {
        expect(isGlobalAdmin(GLOBAL_ADMIN)).toBe(true);
        expect(isGlobalAdmin(ACTOR_A)).toBe(false);
        expect(isGlobalAdmin(ACTOR_HR_B)).toBe(false);
    });
});
