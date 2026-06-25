export const ROLE_VALUES = ['admin', 'hr', 'manager', 'employee'] as const;
export type Role = (typeof ROLE_VALUES)[number];

export const PERMISSION_LEVELS = ['none', 'read', 'write'] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const PERMISSION_MODULES = [
    'dashboard',
    'employees',
    'companies',
    'calendar',
    'vacations',
    'timesheet',
    'expenses',
    'documents',
    'payroll',
    'assets',
    'projects',
    'reports',
    'analytics',
    'performance',
    'audit',
    'inbox',
    'users',
    'settings',
    'kiosk',
    'cards',
    'fleet',
    'notifications',
    'onboarding',
    'offboarding'
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export type PermissionMap = Partial<Record<PermissionModule, PermissionLevel>>;

export interface AuthActor {
    id?: string;
    email?: string | null;
    role?: string | null;
    permissions?: Record<string, PermissionLevel | 'admin' | undefined> | null;
    employeeId?: string | null;
    companyId?: string | null;
}

export interface NormalizedAuthActor {
    id?: string;
    email?: string;
    role: Role;
    permissions: PermissionMap;
    employeeId?: string;
    companyId?: string;
}

export interface AccessTarget {
    employeeId?: string | null;
    companyId?: string | null;
}

type PolicyScope = 'global' | 'self' | 'company';

interface AccessGrant {
    scope: PolicyScope;
    roles?: readonly Role[];
    module?: PermissionModule;
    level?: PermissionLevel;
    requireEmployee?: boolean;
}

interface FeatureAccess {
    module?: PermissionModule;
    level?: PermissionLevel;
    roles?: readonly Role[];
    requireEmployee?: boolean;
}

const PERMISSION_RANK: Record<PermissionLevel, number> = {
    none: 0,
    read: 1,
    write: 2
};

const COMPANY_STAFF_ROLES: readonly Role[] = ['admin', 'hr', 'manager'];
const EMPLOYEE_SELF_ROLES: readonly Role[] = ['admin', 'hr', 'manager', 'employee'];

const ALL_MODULE_WRITE = PERMISSION_MODULES.reduce<PermissionMap>((acc, module) => {
    acc[module] = 'write';
    return acc;
}, {});

const COMPANY_STAFF_DEFAULTS: PermissionMap = {
    dashboard: 'read',
    employees: 'write',
    companies: 'write',
    calendar: 'write',
    vacations: 'write',
    timesheet: 'write',
    expenses: 'write',
    documents: 'write',
    payroll: 'write',
    assets: 'write',
    projects: 'write',
    reports: 'read',
    analytics: 'read',
    performance: 'write',
    inbox: 'write',
    kiosk: 'write',
    cards: 'write',
    fleet: 'write',
    notifications: 'read',
    onboarding: 'write',
    offboarding: 'write',
    audit: 'none',
    users: 'none',
    settings: 'none'
};

const EMPLOYEE_DEFAULTS: PermissionMap = {
    dashboard: 'read',
    employees: 'read',
    calendar: 'read',
    vacations: 'write',
    timesheet: 'write',
    expenses: 'write',
    documents: 'write',
    payroll: 'read',
    notifications: 'read'
};

const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionMap> = {
    admin: ALL_MODULE_WRITE,
    hr: COMPANY_STAFF_DEFAULTS,
    manager: COMPANY_STAFF_DEFAULTS,
    employee: EMPLOYEE_DEFAULTS
};

const LEGACY_ROLE_ALIASES: Record<string, Role> = {
    admin: 'admin',
    hr: 'hr',
    manager: 'manager',
    employee: 'employee',
    user: 'employee'
};

export const ROLE_LABELS: Record<Role, string> = {
    admin: 'Admin',
    hr: 'HR',
    manager: 'Manager',
    employee: 'Employee'
};

export const APP_FEATURES = {
    dashboard: { module: 'dashboard', level: 'read' },
    employees: { module: 'employees', level: 'read', roles: COMPANY_STAFF_ROLES },
    employeeDetail: { module: 'employees', level: 'read', roles: COMPANY_STAFF_ROLES },
    orgChart: { module: 'employees', level: 'read', roles: COMPANY_STAFF_ROLES },
    companies: { module: 'companies', level: 'read', roles: COMPANY_STAFF_ROLES },
    calendar: { module: 'calendar', level: 'read' },
    audit: { module: 'audit', level: 'read', roles: ['admin'] as const },
    assets: { module: 'assets', level: 'read', roles: COMPANY_STAFF_ROLES },
    fleet: { module: 'fleet', level: 'read', roles: COMPANY_STAFF_ROLES },
    cards: { module: 'cards', level: 'read', roles: COMPANY_STAFF_ROLES },
    reports: { module: 'reports', level: 'read', roles: COMPANY_STAFF_ROLES },
    timesheetManagement: { module: 'timesheet', level: 'read', roles: COMPANY_STAFF_ROLES },
    inbox: { module: 'inbox', level: 'read', roles: COMPANY_STAFF_ROLES },
    payrollImport: { module: 'payroll', level: 'read', roles: COMPANY_STAFF_ROLES },
    payrollBatch: { module: 'payroll', level: 'read', roles: COMPANY_STAFF_ROLES },
    myDocuments: { module: 'documents', level: 'read', requireEmployee: true },
    vacationsSelf: { module: 'vacations', level: 'read', requireEmployee: true },
    vacationsPortal: { module: 'vacations', level: 'read' },
    expensesSelf: { module: 'expenses', level: 'read', requireEmployee: true },
    expensesPortal: { module: 'expenses', level: 'read' },
    profileSelf: { module: 'employees', level: 'read', requireEmployee: true },
    anomalies: { module: 'timesheet', level: 'read', roles: COMPANY_STAFF_ROLES },
    reconciliation: { module: 'timesheet', level: 'read', roles: COMPANY_STAFF_ROLES },
    users: { module: 'users', level: 'read', roles: ['admin'] as const },
    settings: { module: 'settings', level: 'read', roles: ['admin'] as const },
    analytics: { module: 'analytics', level: 'read', roles: COMPANY_STAFF_ROLES },
    performance: { module: 'performance', level: 'read', roles: COMPANY_STAFF_ROLES }
} as const satisfies Record<string, FeatureAccess>;

export type AppFeatureKey = keyof typeof APP_FEATURES;

export const DOMAIN_POLICIES = {
    'employee.read.list': {
        grants: [{ scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'employees', level: 'read' }]
    },
    'employee.read.detail': {
        grants: [
            { scope: 'self', roles: EMPLOYEE_SELF_ROLES, module: 'employees', level: 'read', requireEmployee: true },
            { scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'employees', level: 'read' }
        ]
    },
    'employee.read.sensitive': {
        grants: [{ scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'employees', level: 'read' }]
    },
    'employee.write.company': {
        grants: [{ scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'employees', level: 'write' }]
    },
    'employee.write.self': {
        grants: [{ scope: 'self', roles: EMPLOYEE_SELF_ROLES, requireEmployee: true }]
    },
    'document.read': {
        grants: [
            { scope: 'self', roles: EMPLOYEE_SELF_ROLES, module: 'documents', level: 'read', requireEmployee: true },
            { scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'documents', level: 'read' }
        ]
    },
    'document.write': {
        grants: [
            { scope: 'self', roles: EMPLOYEE_SELF_ROLES, module: 'documents', level: 'write', requireEmployee: true },
            { scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'documents', level: 'write' }
        ]
    },
    'document.delete': {
        grants: [
            { scope: 'self', roles: EMPLOYEE_SELF_ROLES, module: 'documents', level: 'write', requireEmployee: true },
            { scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'documents', level: 'write' }
        ]
    },
    'vacation.read': {
        grants: [
            { scope: 'self', roles: EMPLOYEE_SELF_ROLES, module: 'vacations', level: 'read', requireEmployee: true },
            { scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'vacations', level: 'read' }
        ]
    },
    'vacation.write': {
        grants: [
            { scope: 'self', roles: EMPLOYEE_SELF_ROLES, module: 'vacations', level: 'write', requireEmployee: true },
            { scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'vacations', level: 'write' }
        ]
    },
    'vacation.manage': {
        grants: [{ scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'vacations', level: 'write' }]
    },
    'expense.read': {
        grants: [
            { scope: 'self', roles: EMPLOYEE_SELF_ROLES, module: 'expenses', level: 'read', requireEmployee: true },
            { scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'expenses', level: 'read' }
        ]
    },
    'expense.write': {
        grants: [
            { scope: 'self', roles: EMPLOYEE_SELF_ROLES, module: 'expenses', level: 'write', requireEmployee: true },
            { scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'expenses', level: 'write' }
        ]
    },
    'expense.manage': {
        grants: [{ scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'expenses', level: 'write' }]
    },
    'payroll.read': {
        grants: [
            { scope: 'self', roles: EMPLOYEE_SELF_ROLES, module: 'payroll', level: 'read', requireEmployee: true },
            { scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'payroll', level: 'read' }
        ]
    },
    'payroll.manage': {
        grants: [{ scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'payroll', level: 'write' }]
    },
    'timesheet.manage': {
        grants: [{ scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'timesheet', level: 'write' }]
    },
    'kiosk.manage': {
        grants: [{ scope: 'company', roles: COMPANY_STAFF_ROLES, module: 'kiosk', level: 'write' }]
    }
} as const satisfies Record<string, { grants: readonly AccessGrant[] }>;

export type DomainPolicyKey = keyof typeof DOMAIN_POLICIES;

export const SELF_EDITABLE_EMPLOYEE_FIELDS = [
    'phone',
    'address',
    'city',
    'postalCode',
    'province',
    'country',
    'emergencyContacts'
] as const;

export type SelfEditableEmployeeField = (typeof SELF_EDITABLE_EMPLOYEE_FIELDS)[number];

export function isRole(value: string | null | undefined): value is Role {
    return !!value && (ROLE_VALUES as readonly string[]).includes(value);
}

export function normalizeRole(value: string | null | undefined): Role {
    const normalized = String(value || '').trim().toLowerCase();
    return LEGACY_ROLE_ALIASES[normalized] || 'employee';
}

export function normalizePermissionLevel(value: PermissionLevel | 'admin' | string | null | undefined): PermissionLevel {
    if (value === 'write' || value === 'read' || value === 'none') return value;
    if (String(value || '').trim().toLowerCase() === 'admin') return 'write';
    return 'none';
}

export function comparePermissionLevels(left: PermissionLevel, right: PermissionLevel): number {
    return PERMISSION_RANK[left] - PERMISSION_RANK[right];
}

export function maxPermissionLevel(left: PermissionLevel, right: PermissionLevel): PermissionLevel {
    return comparePermissionLevels(left, right) >= 0 ? left : right;
}

export function coercePermissionMap(raw: AuthActor['permissions']): PermissionMap {
    const normalized: PermissionMap = {};

    if (!raw) {
        return normalized;
    }

    Object.entries(raw).forEach(([moduleKey, level]) => {
        if ((PERMISSION_MODULES as readonly string[]).includes(moduleKey)) {
            normalized[moduleKey as PermissionModule] = normalizePermissionLevel(level);
        }
    });

    return normalized;
}

export function getDefaultPermissionsForRole(role: Role): PermissionMap {
    return { ...DEFAULT_ROLE_PERMISSIONS[role] };
}

export function getEffectivePermissions(actor: AuthActor): PermissionMap {
    const role = normalizeRole(actor.role);
    const overrides = coercePermissionMap(actor.permissions);

    if (role === 'admin' && !actor.companyId) {
        return getDefaultPermissionsForRole('admin');
    }

    if (Object.keys(overrides).length > 0) {
        return { ...overrides };
    }

    return getDefaultPermissionsForRole(role);
}

export function normalizeActor(actor: AuthActor | null | undefined): NormalizedAuthActor | null {
    if (!actor) {
        return null;
    }

    return {
        id: actor.id || undefined,
        email: actor.email || undefined,
        role: normalizeRole(actor.role),
        permissions: getEffectivePermissions(actor),
        employeeId: actor.employeeId || undefined,
        companyId: actor.companyId || undefined
    };
}

export function hasModuleAccess(
    actor: AuthActor | NormalizedAuthActor | null | undefined,
    module: PermissionModule,
    level: PermissionLevel = 'read'
): boolean {
    const normalized = normalizeActor(actor);
    if (!normalized) {
        return false;
    }

    const current = normalized.permissions[module] || 'none';
    return comparePermissionLevels(current, level) >= 0;
}

export function canAccessFeature(
    featureKey: AppFeatureKey | string | null | undefined,
    actor: AuthActor | NormalizedAuthActor | null | undefined
): boolean {
    // Fail closed on any invalid input rather than crashing the UI. The
    // frontend used to throw "Cannot read properties of undefined (reading
    // 'requireEmployee')" when a caller passed a misspelled key (e.g.
    // 'vacations' instead of 'vacationsPortal'). Returning false silently
    // hides the item in the menu, which is the safer failure mode.
    if (typeof featureKey !== 'string' || featureKey.length === 0) {
        return false;
    }

    const feature: FeatureAccess | undefined = APP_FEATURES[featureKey as AppFeatureKey];
    if (!feature) {
        return false;
    }

    const normalized = normalizeActor(actor);

    if (!normalized) {
        return false;
    }

    if (feature.requireEmployee && !normalized.employeeId) {
        return false;
    }

    if (feature.roles && !feature.roles.includes(normalized.role)) {
        return false;
    }

    if (feature.module) {
        return hasModuleAccess(normalized, feature.module, feature.level || 'read');
    }

    return true;
}

function matchesScope(scope: PolicyScope, actor: NormalizedAuthActor, target?: AccessTarget | null): boolean {
    if (scope === 'global') {
        return true;
    }

    if (!target) {
        return false;
    }

    if (scope === 'self') {
        return !!actor.employeeId && !!target.employeeId && actor.employeeId === target.employeeId;
    }

    if (scope === 'company') {
        return !!actor.companyId && !!target.companyId && actor.companyId === target.companyId;
    }

    return false;
}

export function canAccessPolicy(
    policyKey: DomainPolicyKey,
    actor: AuthActor | NormalizedAuthActor | null | undefined,
    target?: AccessTarget | null
): boolean {
    const policy = DOMAIN_POLICIES[policyKey];
    const normalized = normalizeActor(actor);

    if (!policy || !normalized) {
        return false;
    }

    return policy.grants.some((grant) => {
        const accessGrant = grant as AccessGrant;

        if (grant.roles && !grant.roles.includes(normalized.role)) {
            return false;
        }

        if (accessGrant.requireEmployee && !normalized.employeeId) {
            return false;
        }

        if (accessGrant.module && !hasModuleAccess(normalized, accessGrant.module, accessGrant.level || 'read')) {
            return false;
        }

        if (normalized.role === 'admin' && !normalized.companyId) {
            return true;
        }

        return matchesScope(grant.scope, normalized, target);
    });
}

