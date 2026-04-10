import { z } from 'zod';

export const expenseCreateSchema = z.object({
    body: z.object({
        employeeId: z.string().min(1, 'ID de empleado requerido'),
        category: z.enum(['MEALS', 'TRANSPORT', 'ACCOMMODATION', 'SUPPLIES', 'EQUIPMENT', 'OTHER']),
        description: z.string().min(1, 'Descripción requerida').max(500),
        amount: z.number().positive('El monto debe ser positivo').max(10000, 'Monto máximo 10000€'),
        date: z.string().refine(val => !isNaN(Date.parse(val)), {
            message: 'Fecha inválida'
        }),
        currency: z.enum(['EUR', 'USD', 'GBP']).default('EUR'),
        receipt: z.string().optional(),
    }),
});

export const expenseUpdateSchema = z.object({
    body: z.object({
        category: z.enum(['MEALS', 'TRANSPORT', 'ACCOMMODATION', 'SUPPLIES', 'EQUIPMENT', 'OTHER']).optional(),
        description: z.string().min(1).max(500).optional(),
        amount: z.number().positive().max(10000).optional(),
        date: z.string().refine(val => !isNaN(Date.parse(val))).optional(),
        currency: z.enum(['EUR', 'USD', 'GBP']).optional(),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
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