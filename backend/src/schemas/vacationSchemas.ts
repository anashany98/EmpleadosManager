import { z } from 'zod';

export const vacationCreateSchema = z.object({
    body: z.object({
        employeeId: z.string().min(1, 'ID de empleado requerido'),
        startDate: z.string().refine(val => !isNaN(Date.parse(val)), {
            message: 'Fecha de inicio inválida'
        }),
        endDate: z.string().refine(val => !isNaN(Date.parse(val)), {
            message: 'Fecha de fin inválida'
        }),
        type: z.enum(['VACATION', 'SICK_LEAVE', 'PERSONAL_DAY', 'MATERNITY', 'PATERNITY', 'UNPAID']).optional(),
        notes: z.string().max(1000).optional(),
    }).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
        message: 'La fecha de inicio debe ser anterior a la fecha de fin',
        path: ['endDate']
    }),
});

export const vacationUpdateSchema = z.object({
    body: z.object({
        startDate: z.string().refine(val => !isNaN(Date.parse(val)), {
            message: 'Fecha de inicio inválida'
        }).optional(),
        endDate: z.string().refine(val => !isNaN(Date.parse(val)), {
            message: 'Fecha de fin inválida'
        }).optional(),
        type: z.enum(['VACATION', 'SICK_LEAVE', 'PERSONAL_DAY', 'MATERNITY', 'PATERNITY', 'UNPAID']).optional(),
        notes: z.string().max(1000).optional(),
    }).refine(data => {
        if (data.startDate && data.endDate) {
            return new Date(data.startDate) <= new Date(data.endDate);
        }
        return true;
    }, {
        message: 'La fecha de inicio debe ser anterior a la fecha de fin',
        path: ['endDate']
    }),
});

export const vacationStatusUpdateSchema = z.object({
    body: z.object({
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']),
        rejectionReason: z.string().max(500).optional(),
    }),
});

export const vacationIdParamSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'ID de vacaciones requerido'),
        employeeId: z.string().min(1, 'ID de empleado requerido').optional(),
    }),
});