import { z } from 'zod';

export const kioskAuthSchema = z.object({
    body: z.object({
        secret: z.string().min(1, 'Secret requerido')
    })
});

export const kioskClockSchema = z.object({
    body: z.object({
        employeeId: z.string().min(1, 'Empleado requerido'),
        pin: z.string().min(1, 'PIN requerido').max(12),
        latitude: z.number().finite().nullable().optional(),
        longitude: z.number().finite().nullable().optional(),
        timestamp: z.string().datetime().optional(),
        clientRequestId: z.string().min(8).max(120).optional()
    })
});
