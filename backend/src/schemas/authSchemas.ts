import { z } from 'zod';

export const loginSchema = z.object({
    body: z.object({
        identifier: z.string().optional(),
        email: z.string().email("Email inválido").optional(),
        dni: z.string().optional(),
        password: z.string().min(1, "La contraseña es obligatoria"),
    }).refine(data => data.identifier || data.email || data.dni, {
        message: "Debe proporcionar un identificador (Email o DNI)",
        path: ["identifier"]
    }),
});

export const passwordResetRequestSchema = z.object({
    body: z.object({
        identifier: z.string().min(1, "DNI o Email requerido"),
    }),
});

export const passwordResetSchema = z.object({
    body: z.object({
        token: z.string().min(1, "Token requerido"),
        newPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    }),
});

export const generateAccessSchema = z.object({
    body: z.object({
        employeeId: z.string().min(1, "ID de empleado requerido"),
    }),
});
