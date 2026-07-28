import { describe, it, expect } from 'vitest';
import {
    ROLE_VALUES,
    PERMISSION_MODULES,
    isRole,
    normalizeRole,
    normalizePermissionLevel,
    comparePermissionLevels,
    maxPermissionLevel,
    getDefaultPermissionsForRole,
    getEffectivePermissions,
    normalizeActor,
    hasModuleAccess,
    canAccessFeature,
    canAccessPolicy,
    ROLE_LABELS,
    SELF_EDITABLE_EMPLOYEE_FIELDS
} from 'shared/authz';

describe('Authz - Role Utilities', () => {
    describe('isRole', () => {
        it('should return true for valid roles', () => {
            expect(isRole('admin')).toBe(true);
            expect(isRole('hr')).toBe(true);
            expect(isRole('manager')).toBe(true);
            expect(isRole('employee')).toBe(true);
        });

        it('should return false for invalid roles', () => {
            expect(isRole('superadmin')).toBe(false);
            expect(isRole('')).toBe(false);
            expect(isRole(null)).toBe(false);
            expect(isRole(undefined)).toBe(false);
        });
    });

    describe('normalizeRole', () => {
        it('should normalize valid roles', () => {
            expect(normalizeRole('admin')).toBe('admin');
            expect(normalizeRole('hr')).toBe('hr');
            expect(normalizeRole('manager')).toBe('manager');
            expect(normalizeRole('employee')).toBe('employee');
        });

        it('should normalize legacy role aliases', () => {
            expect(normalizeRole('user')).toBe('employee');
        });

        it('should normalize case-insensitively', () => {
            expect(normalizeRole('ADMIN')).toBe('admin');
            expect(normalizeRole('Hr')).toBe('hr');
        });

        it('should default invalid roles to employee', () => {
            expect(normalizeRole('superadmin')).toBe('employee');
            expect(normalizeRole('')).toBe('employee');
            expect(normalizeRole(null)).toBe('employee');
            expect(normalizeRole(undefined)).toBe('employee');
        });
    });

    describe('ROLE_LABELS', () => {
        it('should have labels for all roles', () => {
            ROLE_VALUES.forEach(role => {
                expect(ROLE_LABELS[role]).toBeDefined();
                expect(typeof ROLE_LABELS[role]).toBe('string');
            });
        });
    });
});

describe('Authz - Permission Utilities', () => {
    describe('normalizePermissionLevel', () => {
        it('should return valid levels as-is', () => {
            expect(normalizePermissionLevel('read')).toBe('read');
            expect(normalizePermissionLevel('write')).toBe('write');
            expect(normalizePermissionLevel('none')).toBe('none');
        });

        it('should convert admin to write', () => {
            expect(normalizePermissionLevel('admin')).toBe('write');
            expect(normalizePermissionLevel('ADMIN')).toBe('write');
        });

        it('should default invalid levels to none', () => {
            expect(normalizePermissionLevel('invalid')).toBe('none');
            expect(normalizePermissionLevel(null)).toBe('none');
            expect(normalizePermissionLevel(undefined)).toBe('none');
        });
    });

    describe('comparePermissionLevels', () => {
        it('should compare levels correctly', () => {
            expect(comparePermissionLevels('read', 'read')).toBe(0);
            expect(comparePermissionLevels('write', 'read')).toBeGreaterThan(0);
            expect(comparePermissionLevels('read', 'write')).toBeLessThan(0);
            expect(comparePermissionLevels('none', 'read')).toBeLessThan(0);
        });
    });

    describe('maxPermissionLevel', () => {
        it('should return the higher level', () => {
            expect(maxPermissionLevel('read', 'write')).toBe('write');
            expect(maxPermissionLevel('write', 'read')).toBe('write');
            expect(maxPermissionLevel('read', 'read')).toBe('read');
            expect(maxPermissionLevel('none', 'read')).toBe('read');
        });
    });
});

describe('Authz - Permission Maps', () => {
    describe('getDefaultPermissionsForRole', () => {
        it('should return permissions for admin role', () => {
            const perms = getDefaultPermissionsForRole('admin');
            expect(perms.employees).toBe('write');
            expect(perms.payroll).toBe('write');
            expect(perms.audit).toBeDefined();
        });

        it('should return permissions for employee role', () => {
            const perms = getDefaultPermissionsForRole('employee');
            expect(perms.dashboard).toBe('read');
            expect(perms.vacations).toBe('write');
            expect(perms.payroll).toBe('read');
        });

        it('should return different permissions for different roles', () => {
            const adminPerms = getDefaultPermissionsForRole('admin');
            const employeePerms = getDefaultPermissionsForRole('employee');
            expect(adminPerms.audit).not.toBe(employeePerms.audit);
        });
    });

    describe('getEffectivePermissions', () => {
        it('should return default permissions when no overrides', () => {
            const actor = { role: 'employee' };
            const perms = getEffectivePermissions(actor);
            expect(perms.dashboard).toBe('read');
        });

        it('should apply permission overrides', () => {
            const actor = {
                role: 'employee',
                permissions: { employees: 'write' }
            };
            const perms = getEffectivePermissions(actor);
            expect(perms.employees).toBe('write');
            expect(perms.dashboard).toBe('read');
        });

        it('should keep full permissions for global admin', () => {
            const actor = {
                role: 'admin',
                permissions: { employees: 'read' }
            };
            const perms = getEffectivePermissions(actor);
            expect(perms.employees).toBe('write');
        });
    });
});

describe('Authz - Actor Normalization', () => {
    describe('normalizeActor', () => {
        it('should normalize a complete actor', () => {
            const actor = {
                id: '123',
                email: 'test@example.com',
                role: 'admin',
                permissions: { employees: 'read' },
                employeeId: 'emp-1',
                companyId: 'comp-1'
            };
            const normalized = normalizeActor(actor);
            expect(normalized.id).toBe('123');
            expect(normalized.email).toBe('test@example.com');
            expect(normalized.role).toBe('admin');
            expect(normalized.permissions.employees).toBe('read');
        });

        it('should return null for null/undefined actor', () => {
            expect(normalizeActor(null)).toBeNull();
            expect(normalizeActor(undefined)).toBeNull();
        });

        it('should use defaults for missing fields', () => {
            const actor = { role: 'employee' };
            const normalized = normalizeActor(actor);
            expect(normalized.role).toBe('employee');
            expect(normalized.permissions).toBeDefined();
        });
    });
});

describe('Authz - Module Access', () => {
    describe('hasModuleAccess', () => {
        it('should grant read access to employee with read permission', () => {
            const actor = { role: 'employee' };
            expect(hasModuleAccess(actor, 'dashboard', 'read')).toBe(true);
        });

        it('should deny write access to employee without write permission', () => {
            const actor = { role: 'employee' };
            expect(hasModuleAccess(actor, 'payroll', 'write')).toBe(false);
        });

        it('should grant write access to admin', () => {
            const actor = { role: 'admin' };
            expect(hasModuleAccess(actor, 'payroll', 'write')).toBe(true);
        });

        it('should return false for null actor', () => {
            expect(hasModuleAccess(null, 'dashboard', 'read')).toBe(false);
        });
    });

    describe('canAccessFeature', () => {
        it('should grant access to dashboard for any authenticated user', () => {
            const actor = { role: 'employee' };
            expect(canAccessFeature('dashboard', actor)).toBe(true);
        });

        it('should deny analytics for employee role', () => {
            const actor = { role: 'employee' };
            expect(canAccessFeature('analytics', actor)).toBe(false);
        });

        it('should grant analytics for admin role', () => {
            const actor = { role: 'admin' };
            expect(canAccessFeature('analytics', actor)).toBe(true);
        });

        it('should require employeeId for self-service features', () => {
            const actorWithEmployee = { role: 'employee', employeeId: '123' };
            const actorWithoutEmployee = { role: 'employee' };
            expect(canAccessFeature('myDocuments', actorWithEmployee)).toBe(true);
            expect(canAccessFeature('myDocuments', actorWithoutEmployee)).toBe(false);
        });

        it('should expose fleet as its own feature access gate', () => {
            const fleetActor = { role: 'manager', permissions: { fleet: 'read' } };
            const assetActor = { role: 'manager', permissions: { assets: 'read', fleet: 'none' } };

            expect(canAccessFeature('fleet', fleetActor)).toBe(true);
            expect(canAccessFeature('fleet', assetActor)).toBe(false);
        });
    });
});

describe('Authz - Domain Policies', () => {
    describe('canAccessPolicy', () => {
        it('should allow admin to read employee list', () => {
            const admin = { role: 'admin', companyId: 'comp-1' };
            expect(canAccessPolicy('employee.read.list', admin, { companyId: 'comp-1' })).toBe(true);
        });

        it('should deny employee to read employee list', () => {
            const employee = { role: 'employee' };
            expect(canAccessPolicy('employee.read.list', employee)).toBe(false);
        });

        it('should allow self-access to employee data', () => {
            const actor = { role: 'employee', employeeId: 'emp-1' };
            const target = { employeeId: 'emp-1' };
            expect(canAccessPolicy('employee.read.detail', actor, target)).toBe(true);
        });

        it('should deny access to other employee data for employee role', () => {
            const actor = { role: 'employee', employeeId: 'emp-1' };
            const target = { employeeId: 'emp-2' };
            expect(canAccessPolicy('employee.read.detail', actor, target)).toBe(false);
        });

        it('should allow company staff to manage vacations', () => {
            const hr = { role: 'hr', companyId: 'comp-1' };
            const target = { companyId: 'comp-1' };
            expect(canAccessPolicy('vacation.manage', hr, target)).toBe(true);
        });

        it('should deny employee to manage payroll', () => {
            const employee = { role: 'employee' };
            expect(canAccessPolicy('payroll.manage', employee)).toBe(false);
        });
    });
});

describe('Authz - Constants', () => {
    describe('PERMISSION_MODULES', () => {
        it('should contain expected modules', () => {
            const expected = [
                'dashboard', 'employees', 'companies', 'calendar',
                'vacations', 'timesheet', 'expenses', 'documents',
                'payroll', 'assets', 'reports', 'analytics'
            ];
            expected.forEach(module => {
                expect(PERMISSION_MODULES).toContain(module);
            });
        });
    });

    describe('SELF_EDITABLE_EMPLOYEE_FIELDS', () => {
        it('should contain expected fields', () => {
            expect(SELF_EDITABLE_EMPLOYEE_FIELDS).toContain('phone');
            expect(SELF_EDITABLE_EMPLOYEE_FIELDS).toContain('address');
            expect(SELF_EDITABLE_EMPLOYEE_FIELDS).toContain('emergencyContacts');
        });
    });
});
