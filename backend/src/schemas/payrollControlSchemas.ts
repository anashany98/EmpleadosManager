import { z } from 'zod';

const money = z.coerce.number().finite().min(-1_000_000).max(1_000_000);
const nonNegativeMoney = z.coerce.number().finite().min(0).max(1_000_000);

export const periodQuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    companyId: z.string().uuid().optional()
}).strict();

export const historyQuerySchema = z.object({
    companyId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(60).default(24)
}).strict();

export const updateRecordCellSchema = z.object({
    expectedVersion: z.coerce.number().int().positive(),
    overtimeRate: nonNegativeMoney.optional(),
    holidayOvertimeRate: nonNegativeMoney.optional(),
    overtimeHours: z.coerce.number().finite().min(0).max(1000).optional(),
    holidayOvertimeHours: z.coerce.number().finite().min(0).max(1000).optional(),
    totalOvertimeAmount: nonNegativeMoney.optional(),
    positiveVariable: nonNegativeMoney.optional(),
    negativeVariable: nonNegativeMoney.optional(),
    diets: nonNegativeMoney.optional(),
    irpf: z.coerce.number().finite().min(0).max(1).optional(),
    tgss: z.coerce.number().finite().min(0).max(1).optional(),
    availablePercentage: z.coerce.number().finite().min(0).max(1).optional(),
    gross: nonNegativeMoney.optional(),
    productivity: z.coerce.number().finite().min(0).max(1_000_000).optional(),
    hoursAmount: money.optional(),
    difference: money.optional(),
    // sanitizeBodyMiddleware convierte las cadenas vacías en null antes de la
    // validación; se acepta null y se normaliza a texto vacío para no bloquear
    // el guardado cuando el cliente limpia un campo.
    category: z.string().trim().max(100).nullable().transform((value) => value ?? '').optional(),
    department: z.string().trim().max(100).nullable().transform((value) => value ?? '').optional(),
    gestoriaCode: z.string().trim().max(50).nullable().optional(),
    observations: z.string().trim().max(2000).nullable().transform((value) => value ?? '').optional()
}).strict();

export const updateConceptValueSchema = z.object({
    expectedVersion: z.coerce.number().int().positive(),
    conceptConfigId: z.string().uuid(),
    value: money
}).strict();

export const restoreCellSchema = z.object({
    expectedVersion: z.coerce.number().int().positive(),
    fieldName: z.enum(['totalOvertimeAmount', 'availablePercentage', 'gross', 'productivity', 'hoursAmount', 'difference'])
}).strict();

export const updatePeriodStatusSchema = z.object({
    periodId: z.string().uuid(),
    status: z.enum(['IN_REVIEW', 'CLOSED', 'SENT_TO_AGENCY', 'REOPENED']),
    // El sanitizer convierte el motivo vacío en null; se deja pasar para que la
    // validación de negocio devuelva un 4xx claro en vez de un 500 de zod.
    reopenReason: z.string().trim().min(5).max(1000).nullable().optional()
}).strict().superRefine((value, context) => {
    if (value.status === 'REOPENED' && !value.reopenReason) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['reopenReason'], message: 'La reapertura requiere un motivo.' });
    }
});

export const employeeRecordBodySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12)
}).merge(updateRecordCellSchema).strict();

const timeValue = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable();

export const updateDailyEntriesSchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    expectedVersion: z.coerce.number().int().positive(),
    entries: z.array(z.object({
        workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        entryTime: timeValue,
        breakOutTime: timeValue,
        breakInTime: timeValue,
        exitTime: timeValue,
        discountHours: z.coerce.number().finite().min(0).max(24),
        scheduledHours: z.coerce.number().finite().min(0).max(24),
        isHoliday: z.boolean(),
        dietAmount: z.coerce.number().finite().min(0).max(10_000),
        // Los registros ya existentes pueden tener la nota almacenada como NULL.
        // Al volver a guardarlos, el cliente debe poder enviarlos sin bloquear
        // todo el mes; se normalizan a texto vacío para el servicio.
        notes: z.string().trim().max(1000).nullable().transform((value) => value ?? '')
    }).strict()).min(28).max(31)
}).strict();

export const timeSheetImportSchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    expectedVersion: z.coerce.number().int().positive().optional()
}).strict();

export const exportGestoriaSchema = z.object({ periodId: z.string().uuid() }).strict();

export const createConceptConfigSchema = z.object({
    companyId: z.string().uuid().optional(),
    key: z.string().trim().regex(/^[A-Z0-9_]+$/).max(80),
    label: z.string().trim().min(1).max(120),
    gestoriaCode: z.string().trim().regex(/^\d{3}$/).optional().nullable(),
    order: z.coerce.number().int().min(0).max(10_000).default(100)
}).strict();
