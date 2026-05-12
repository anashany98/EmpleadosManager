import { describe, expect, it } from 'vitest';
import {
    assertCompanyAccess,
    assertGlobalAdmin,
    canAccessCompany,
    isGlobalAdmin,
    resolveAuthorizedCompanyId
} from './companyAccess';

describe('companyAccess', () => {
    it('recognizes a global admin only when no company scope exists', () => {
        expect(isGlobalAdmin({ id: '1', email: 'admin@test.com', role: 'admin' })).toBe(true);
        expect(isGlobalAdmin({ id: '2', email: 'scoped@test.com', role: 'admin', companyId: 'company-1' })).toBe(false);
        expect(isGlobalAdmin({ id: '3', email: 'hr@test.com', role: 'hr', companyId: 'company-1' })).toBe(false);
    });

    it('allows access to the same company and blocks cross-company access', () => {
        const scopedAdmin = { id: '1', email: 'admin@test.com', role: 'admin' as const, companyId: 'company-1' };

        expect(canAccessCompany(scopedAdmin, 'company-1')).toBe(true);
        expect(canAccessCompany(scopedAdmin, 'company-2')).toBe(false);
        expect(canAccessCompany(scopedAdmin, null)).toBe(false);
    });

    it('lets global admins bypass company scope assertions', () => {
        const globalAdmin = { id: '1', email: 'admin@test.com', role: 'admin' as const };

        expect(() => assertCompanyAccess(globalAdmin, 'company-2')).not.toThrow();
        expect(() => assertGlobalAdmin(globalAdmin)).not.toThrow();
    });

    it('throws when scoped users reach a foreign company or global-only action', () => {
        const scopedAdmin = { id: '1', email: 'admin@test.com', role: 'admin' as const, companyId: 'company-1' };

        expect(() => assertCompanyAccess(scopedAdmin, 'company-2')).toThrow('No autorizado');
        expect(() => assertGlobalAdmin(scopedAdmin)).toThrow('administrador global');
    });

    it('resolves requested company scope safely', () => {
        const globalAdmin = { id: '1', email: 'admin@test.com', role: 'admin' as const };
        const scopedAdmin = { id: '2', email: 'manager@test.com', role: 'manager' as const, companyId: 'company-1' };

        expect(resolveAuthorizedCompanyId(globalAdmin, 'company-2')).toBe('company-2');
        expect(resolveAuthorizedCompanyId(globalAdmin)).toBeUndefined();

        expect(resolveAuthorizedCompanyId(scopedAdmin)).toBe('company-1');
        expect(resolveAuthorizedCompanyId(scopedAdmin, 'company-1')).toBe('company-1');
        expect(() => resolveAuthorizedCompanyId(scopedAdmin, 'company-2')).toThrow('No autorizado');
    });

    it('rejects scoped users without assigned company when no explicit company is allowed', () => {
        const managerWithoutCompany = { id: '3', email: 'manager@test.com', role: 'manager' as const };

        expect(() => resolveAuthorizedCompanyId(managerWithoutCompany)).toThrow('Usuario sin empresa asignada');
    });
});
