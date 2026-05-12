type EmployeeNameLike = {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
};

function normalizeNamePart(value?: string | null): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const normalized = trimmed.toLowerCase();
    if (normalized === 'null' || normalized === 'undefined') {
        return null;
    }

    return trimmed;
}

export function getEmployeeDisplayName(employee?: EmployeeNameLike | null, fallback = 'Empleado'): string {
    if (!employee) {
        return fallback;
    }

    const canonicalName = normalizeNamePart(employee.name);
    if (canonicalName) {
        return canonicalName;
    }

    const parts = [normalizeNamePart(employee.firstName), normalizeNamePart(employee.lastName)].filter(Boolean) as string[];
    return parts.join(' ') || fallback;
}

export function getEmployeeInitials(employee?: EmployeeNameLike | null, fallback = '?'): string {
    const displayName = getEmployeeDisplayName(employee, '').trim();
    if (!displayName) {
        return fallback;
    }

    const parts = displayName.split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
    return initials || fallback;
}
