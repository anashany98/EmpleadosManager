export const OBRA_EXPENSE_TYPES = ['PER_DIEM', 'LODGING', 'FLIGHT', 'TRANSPORT', 'CAR_RENTAL', 'OTHER'] as const;

export type ObraExpenseType = typeof OBRA_EXPENSE_TYPES[number];

export const OBRA_EXPENSE_STATUS = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export type ObraExpenseStatus = typeof OBRA_EXPENSE_STATUS[number];

export const OBRA_STATUS = ['ACTIVE', 'INACTIVE'] as const;

export type ObraStatus = typeof OBRA_STATUS[number];

export const OBRA_IMPORT_BATCH_STATUS = ['UPLOADED', 'MAPPED', 'COMMITTED', 'FAILED'] as const;

export type ObraImportBatchStatus = typeof OBRA_IMPORT_BATCH_STATUS[number];

export const OBRA_IMPORT_WARNINGS = [
    'MISSING_OBRA_CODE',
    'OBRA_NOT_FOUND',
    'OBRA_INACTIVE',
    'INVALID_TYPE',
    'INVALID_DATE',
    'INVALID_AMOUNT',
    'EMPLOYEE_NOT_FOUND'
] as const;

export type ObraImportWarning = typeof OBRA_IMPORT_WARNINGS[number];

export const OBRA_TYPE_LABELS: Record<ObraExpenseType, string> = {
    PER_DIEM: 'Dietas',
    LODGING: 'Hospedaje',
    FLIGHT: 'Vuelo',
    TRANSPORT: 'Transporte',
    CAR_RENTAL: 'Alquiler de coche',
    OTHER: 'Otros'
};

export function isObraExpenseType(value: unknown): value is ObraExpenseType {
    return typeof value === 'string' && (OBRA_EXPENSE_TYPES as readonly string[]).includes(value);
}

export function isObraExpenseStatus(value: unknown): value is ObraExpenseStatus {
    return typeof value === 'string' && (OBRA_EXPENSE_STATUS as readonly string[]).includes(value);
}
