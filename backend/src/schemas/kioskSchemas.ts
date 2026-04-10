import { z } from 'zod';

const descriptorSchema = z.array(z.number().finite()).min(64).max(256);

export const kioskIdentifySchema = z.object({
    body: z.object({
        descriptor: descriptorSchema
    })
});

export const kioskAuthSchema = z.object({
    body: z.object({
        secret: z.string().min(1, 'Secret requerido')
    })
});

export const kioskEnrollSchema = z.object({
    body: z.object({
        employeeId: z.string().min(1, 'Empleado requerido'),
        descriptor: descriptorSchema
    })
});

export const kioskClockSchema = z.object({
    body: z.object({
        employeeId: z.string().min(1, 'Empleado requerido'),
        method: z.enum(['pin', 'face']),
        pin: z.string().min(1).max(12).optional(),
        descriptor: descriptorSchema.optional(),
        latitude: z.number().finite().nullable().optional(),
        longitude: z.number().finite().nullable().optional(),
        timestamp: z.string().datetime().optional(),
        clientRequestId: z.string().min(8).max(120).optional()
    }).superRefine((body, ctx) => {
        if (body.method === 'pin' && !body.pin) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'PIN requerido para fichaje por pin',
                path: ['pin']
            });
        }

        if (body.method === 'face' && !body.descriptor) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Descriptor requerido para fichaje facial',
                path: ['descriptor']
            });
        }
    })
});
