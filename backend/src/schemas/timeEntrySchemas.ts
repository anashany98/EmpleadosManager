import { z } from 'zod';

export const timeEntryClockSchema = z.object({
    body: z.object({
        type: z.enum(['IN', 'OUT', 'BREAK_START', 'BREAK_END', 'LUNCH_START', 'LUNCH_END'], {
            errorMap: () => ({ message: 'Tipo de fichaje inválido' })
        }),
        timestamp: z.string().datetime().optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        clientRequestId: z.string().min(1).max(255).optional()
    })
});

export const timeEntryHistoryQuerySchema = z.object({
    query: z.object({
        employeeId: z.string().uuid().optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(500).optional()
    })
});

export const timeEntryManualSchema = z.object({
    body: z.object({
        employeeId: z.string().uuid(),
        type: z.enum(['IN', 'OUT', 'BREAK_START', 'BREAK_END', 'LUNCH_START', 'LUNCH_END']),
        timestamp: z.string().datetime(),
        location: z.string().max(255).optional(),
        device: z.string().max(255).optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional()
    })
});

export const timeEntryIdParamSchema = z.object({
    params: z.object({
        id: z.string().min(1)
    })
});
