import { z } from 'zod';

export const uuidParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID inválido (debe ser UUID)"),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, "ID es requerido"),
  }),
});

export const employeeIdParamSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid("ID de empleado inválido (debe ser UUID)"),
  }),
});
