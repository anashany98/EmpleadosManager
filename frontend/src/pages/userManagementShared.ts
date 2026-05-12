import {
    PERMISSION_MODULES,
    ROLE_VALUES,
    getDefaultPermissionsForRole,
    getEffectivePermissions,
    type AuthActor,
    type PermissionMap,
    type PermissionModule,
    type Role
} from '@shared/authz';

export const MODULE_LABELS: Record<PermissionModule, string> = {
    dashboard: 'Dashboard',
    employees: 'Empleados',
    companies: 'Empresas',
    calendar: 'Calendario',
    vacations: 'Vacaciones',
    timesheet: 'Fichaje',
    expenses: 'Gastos',
    documents: 'Documentos',
    payroll: 'Nominas',
    assets: 'Activos',
    projects: 'Proyectos',
    reports: 'Reportes',
    analytics: 'Analytics',
    performance: 'Rendimiento',
    audit: 'Auditoria',
    inbox: 'Inbox',
    users: 'Usuarios',
    settings: 'Configuracion',
    kiosk: 'Kiosco',
    cards: 'Tarjetas',
    fleet: 'Flota',
    notifications: 'Notificaciones',
    onboarding: 'Onboarding',
    offboarding: 'Offboarding'
};

export const ROLE_LABELS: Record<Role, string> = {
    admin: 'Administrador',
    hr: 'RRHH',
    manager: 'Manager',
    employee: 'Empleado'
};

export const ROLE_BADGE_STYLES: Record<Role, string> = {
    admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    hr: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    manager: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    employee: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
};

export const ROLE_OPTIONS: Array<{ value: Role; label: string; description: string }> = ROLE_VALUES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
    description:
        role === 'admin'
            ? 'Control total global'
            : role === 'hr'
                ? 'Gestión operativa de RRHH'
                : role === 'manager'
                    ? 'Supervisión y coordinación'
                    : 'Autoservicio y acceso personal'
}));

export const ORDERED_PERMISSION_MODULES = [...PERMISSION_MODULES];

export function countEnabledPermissions(permissions: PermissionMap = {}) {
    return Object.values(permissions).filter((level) => level && level !== 'none').length;
}

export function getEnabledModules(permissions: PermissionMap = {}) {
    return ORDERED_PERMISSION_MODULES.filter((module) => permissions[module] && permissions[module] !== 'none');
}

export function getRoleDefaults(role: Role): PermissionMap {
    return getDefaultPermissionsForRole(role);
}

export function getDisplayPermissions(actor: Pick<AuthActor, 'role' | 'permissions'>): PermissionMap {
    return getEffectivePermissions({ role: actor.role, permissions: actor.permissions });
}

export function parseApiError(error: unknown, fallback: string) {
    if (error instanceof Error) {
        try {
            const parsed = JSON.parse(error.message) as { message?: string; error?: string };
            return parsed.message || parsed.error || fallback;
        } catch {
            return error.message || fallback;
        }
    }

    return fallback;
}
