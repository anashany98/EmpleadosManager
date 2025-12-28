import { z } from 'zod';

export const createEmployeeSchema = z.object({
    body: z.object({
        dni: z.string().min(1, "El DNI es obligatorio"),
        name: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email("Email inválido").optional().nullable(),
        subaccount465: z.string().min(1, "La subcuenta 465 es obligatoria"),
        weeklyHours: z.number().min(0).max(40).optional().nullable(),
    }),
});

export const updateEmployeeSchema = z.object({
    body: z.object({
        name: z.string().optional(),
        email: z.string().email("Email inválido").optional().nullable(),
        weeklyHours: z.number().min(0).max(40).optional().nullable(),
    }),
});
