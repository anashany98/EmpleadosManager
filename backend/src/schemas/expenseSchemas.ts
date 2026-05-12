import { z } from 'zod';

const expenseCategoryAliases: Record<string, string> = {
    DIETAS: 'MEALS',
    MEAL: 'MEALS',
    MEALS: 'MEALS',
    TRANSPORTE: 'TRANSPORT',
    TRAVEL: 'TRANSPORT',
    TRANSPORT: 'TRANSPORT',
    ALOJAMIENTO: 'ACCOMMODATION',
    ACCOMMODATION: 'ACCOMMODATION',
    MATERIAL: 'SUPPLIES',
    SUPPLIES: 'SUPPLIES',
    EQUIPMENT: 'EQUIPMENT',
    OTROS: 'OTHER',
    OTHER: 'OTHER'
};

const expenseCategorySchema = z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    return expenseCategoryAliases[value.trim().toUpperCase()] ?? value;
}, z.enum(['MEALS', 'TRANSPORT', 'ACCOMMODATION', 'SUPPLIES', 'EQUIPMENT', 'OTHER']));

const expenseAmountSchema = z.preprocess((value) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return value;

    const normalized = value.trim().replace(',', '.');
    return normalized === '' ? value : Number(normalized);
}, z.number().positive('El monto debe ser positivo').max(10000, 'Monto maximo 10000 EUR'));

const optionalTextSchema = z.preprocess((value) => {
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
}, z.string().max(500).optional());

const paymentMethodSchema = z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return 'CASH';
    return value;
}, z.enum(['CASH', 'COMPANY_CARD', 'CARD', 'PERSONAL_CARD', 'TRANSFER']));

export const expenseCreateSchema = z.object({
    body: z.object({
        employeeId: z.string().min(1, 'ID de empleado requerido'),
        category: expenseCategorySchema,
        description: optionalTextSchema,
        amount: expenseAmountSchema,
        date: z.string().refine(val => !isNaN(Date.parse(val)), {
            message: 'Fecha invalida'
        }),
        currency: z.enum(['EUR', 'USD', 'GBP']).default('EUR'),
        paymentMethod: paymentMethodSchema.default('CASH'),
        receipt: z.string().optional(),
    }),
});

export const expenseUpdateSchema = z.object({
    body: z.object({
        category: expenseCategorySchema.optional(),
        description: optionalTextSchema,
        amount: expenseAmountSchema.optional(),
        date: z.string().refine(val => !isNaN(Date.parse(val))).optional(),
        currency: z.enum(['EUR', 'USD', 'GBP']).optional(),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
        paymentMethod: paymentMethodSchema.optional(),
        receipt: z.string().optional(),
    }),
});

export const expenseApprovalSchema = z.object({
    body: z.object({
        status: z.enum(['APPROVED', 'REJECTED']),
        rejectionReason: z.string().max(500).optional(),
    }),
});

export const expenseIdParamSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'ID de gasto requerido'),
    }),
});

export const expenseEmployeeParamSchema = z.object({
    params: z.object({
        employeeId: z.string().min(1, 'ID de empleado requerido'),
    }),
});
