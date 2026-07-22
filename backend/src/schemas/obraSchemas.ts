import { z } from 'zod';
import { OBRA_EXPENSE_TYPES, OBRA_EXPENSE_STATUS } from '../../../shared/obras';

const dateString = z.string().refine((v) => {
    if (v == null || v === '') return false;
    const d = new Date(v);
    return !isNaN(d.getTime());
}, { message: 'Fecha inválida' });

const dateQuery = z.string().refine((v) => {
    if (!v) return true;
    const d = new Date(v);
    return !isNaN(d.getTime());
}, { message: 'Fecha inválida' }).optional();

const obraExpenseTypeSchema = z.enum(OBRA_EXPENSE_TYPES);
const obraExpenseStatusSchema = z.enum(OBRA_EXPENSE_STATUS);

const positiveAmount = z.union([z.number(), z.string()]).transform((v, ctx) => {
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').trim());
    if (!Number.isFinite(n)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'amount debe ser numérico' });
        return z.NEVER;
    }
    if (n <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'amount debe ser > 0' });
        return z.NEVER;
    }
    return Math.round(n * 100) / 100;
});

const optionalText = z.union([z.string(), z.null(), z.undefined()]).transform((v) => {
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s.slice(0, 500);
});

const optionalTextShort = z.union([z.string(), z.null(), z.undefined()]).transform((v) => {
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s.slice(0, 100);
});

const optionalId = z.union([z.string(), z.null(), z.undefined()]).transform((v) => {
    if (v == null || v === '') return null;
    return String(v);
});

const uuidParam = z.object({
    id: z.string().min(1, 'ID requerido')
});

const uuidObraIdParam = z.object({
    obraId: z.string().min(1, 'obraId requerido')
});

export const obraCreateSchema = z.object({
    body: z.object({
        code: z.string().trim().min(1, 'code obligatorio').max(50),
        name: z.string().trim().min(1, 'name obligatorio').max(200),
        destination: optionalText,
        description: optionalText,
        clientName: optionalText,
        startDate: dateString.optional().nullable(),
        endDate: dateString.optional().nullable(),
        budget: z.union([z.number().positive(), z.string()]).optional().nullable(),
        managerId: optionalId
    })
});

export const obraUpdateSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1).max(200).optional(),
        destination: optionalText,
        description: optionalText,
        clientName: optionalText,
        startDate: dateString.optional().nullable(),
        endDate: dateString.optional().nullable(),
        budget: z.union([z.number().positive(), z.string()]).optional().nullable(),
        managerId: optionalId
    })
});

export const obraIdParamSchema = z.object({
    params: uuidParam
});

export const obraListQuerySchema = z.object({
    query: z.object({
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
        q: z.string().trim().min(1).max(100).optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional()
    })
});

export const obraExpenseCreateSchema = z.object({
    body: z.object({
        type: obraExpenseTypeSchema,
        date: dateString,
        amount: positiveAmount,
        currency: z.string().trim().min(1).max(8).optional(),
        description: optionalText,
        vendor: optionalTextShort,
        reference: optionalTextShort,
        origin: optionalTextShort,
        destination: optionalTextShort,
        employeeId: optionalId
    })
});

export const obraExpenseUpdateSchema = z.object({
    body: z.object({
        type: obraExpenseTypeSchema.optional(),
        date: dateString.optional(),
        amount: positiveAmount.optional(),
        currency: z.string().trim().min(1).max(8).optional(),
        description: optionalText,
        vendor: optionalTextShort,
        reference: optionalTextShort,
        origin: optionalTextShort,
        destination: optionalTextShort,
        employeeId: optionalId,
        status: obraExpenseStatusSchema.optional()
    })
});

export const obraExpenseListByObraSchema = z.object({
    params: uuidObraIdParam,
    query: z.object({
        type: obraExpenseTypeSchema.optional(),
        status: obraExpenseStatusSchema.optional(),
        employeeId: z.string().min(1).optional(),
        from: dateQuery,
        to: dateQuery
    })
});

export const obraExpenseListAllSchema = z.object({
    query: z.object({
        type: obraExpenseTypeSchema.optional(),
        obraId: z.string().min(1).optional(),
        from: dateQuery,
        to: dateQuery,
        limit: z.coerce.number().int().min(1).max(500).optional()
    })
});

export const obraExpenseIdParamSchema = z.object({
    params: uuidParam
});

export const obraImportMappingRulesSchema = z.object({
    body: z.object({
        mappingRules: z.record(z.string(), z.string()).optional(),
        rules: z.record(z.string(), z.string()).optional(),
        obraOverride: z.union([z.string(), z.null()]).optional()
    }).refine((v) => Boolean(v.mappingRules || v.rules || v.obraOverride), {
        message: 'mappingRules o obraOverride requerido'
    })
});

export const obraImportBatchIdParamSchema = z.object({
    params: uuidParam
});

export const employeeProjectWorkIdParamSchema = z.object({
    params: uuidParam
});

export const employeeProjectWorkCreateSchema = z.object({
    body: z.object({
        employeeId: z.string().min(1, 'employeeId requerido'),
        projectId: z.string().min(1, 'projectId requerido'),
        startDate: dateString,
        endDate: dateString,
        hours: z.union([z.number(), z.string()]).transform((v, ctx) => {
            const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').trim());
            if (!Number.isFinite(n) || n <= 0) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'hours debe ser > 0' });
                return z.NEVER;
            }
            return n;
        }),
        notes: optionalText
    })
});

export const employeeProjectWorkUpdateSchema = z.object({
    body: z.object({
        employeeId: z.string().min(1).optional(),
        projectId: z.string().min(1).optional(),
        startDate: dateString.optional(),
        endDate: dateString.optional(),
        hours: z.union([z.number(), z.string()]).optional().transform((v, ctx) => {
            if (v == null) return undefined;
            const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').trim());
            if (!Number.isFinite(n) || n <= 0) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'hours debe ser > 0' });
                return z.NEVER;
            }
            return n;
        }),
        notes: optionalText
    })
});
