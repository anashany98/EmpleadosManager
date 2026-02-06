import { z } from 'zod';

export const createEmployeeSchema = z.object({
    body: z.object({
        dni: z.string().min(1, "El DNI es obligatorio"),
        name: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email("Email inválido").optional().nullable().or(z.literal('')),
        subaccount465: z.string().optional().nullable(), // Now optional
        weeklyHours: z.union([z.string(), z.number()]).optional().nullable(), // Handle string from formdata
        emergencyContacts: z.array(z.object({
            name: z.string(),
            phone: z.string(),
            relationship: z.string().optional().nullable()
        })).optional().nullable()
    }),
});

export const updateEmployeeSchema = z.object({
    body: z.object({
        name: z.string().optional(),
        email: z.string().email("Email inválido").optional().nullable().or(z.literal('')),
        subaccount465: z.string().optional().nullable(),
        weeklyHours: z.union([z.string(), z.number()]).optional().nullable(),
        emergencyContacts: z.array(z.object({
            name: z.string(),
            phone: z.string(),
            relationship: z.string().optional().nullable()
        })).optional().nullable()
    }),
});
