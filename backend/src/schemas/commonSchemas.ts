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

/**
 * Schema para rutas anidadas bajo /:employeeId/.../:id
 * Valida TANTO el employeeId como el id del sub-recurso (medical-review, training, etc).
 * Esto es crítico: si solo se valida employeeId, validateResource sobreescribe
 * req.params y PIERDE el :id, rompiendo el controller (ver PR 2026-07-22 fix).
 */
export const employeeIdAndIdParamSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid("ID de empleado inválido (debe ser UUID)"),
    id: z.string().min(1, "ID del recurso es requerido"),
  }),
});
