import { describe, expect, it } from 'vitest';
import { canAccessPolicy, normalizeRole } from '../../../shared/authz';

describe('shared authz policies', () => {
    it('normalizes legacy roles to canonical roles', () => {
        expect(normalizeRole('USER')).toBe('employee');
        expect(normalizeRole('ADMIN')).toBe('admin');
    });

    it('keeps admin access global for company-scoped policies', () => {
        expect(
            canAccessPolicy(
                'payroll.read',
                { role: 'admin' },
                { employeeId: 'emp-1', companyId: 'company-1' }
            )
        ).toBe(true);
    });

    it('allows managers to manage expense flows only inside their company', () => {
        expect(
            canAccessPolicy(
                'expense.manage',
                { role: 'manager', companyId: 'company-1' },
                { employeeId: 'emp-2', companyId: 'company-1' }
            )
        ).toBe(true);

        expect(
            canAccessPolicy(
                'expense.manage',
                { role: 'manager', companyId: 'company-1' },
                { employeeId: 'emp-2', companyId: 'company-2' }
            )
        ).toBe(false);
    });

    it('keeps employee self-write constrained to the same employee', () => {
        expect(
            canAccessPolicy(
                'employee.write.self',
                { role: 'employee', employeeId: 'emp-1' },
                { employeeId: 'emp-1', companyId: 'company-1' }
            )
        ).toBe(true);

        expect(
            canAccessPolicy(
                'employee.write.self',
                { role: 'employee', employeeId: 'emp-1' },
                { employeeId: 'emp-2', companyId: 'company-1' }
            )
        ).toBe(false);
    });
});
