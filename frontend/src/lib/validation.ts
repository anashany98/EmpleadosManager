import { z } from 'zod';

/**
 * Centralized Zod validation schemas for RRHH Frontend
 * Standardizes form validation across the app
 */

// ============== Auth Schemas ==============

export const loginSchema = z.object({
  email: z.string().min(1, 'El email es requerido').email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida').min(6, 'Mínimo 6 caracteres'),
});

export const registerSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido').max(50, 'Máximo 50 caracteres'),
  lastName: z.string().min(1, 'El apellido es requerido').max(50, 'Máximo 50 caracteres'),
  email: z.string().min(1, 'El email es requerido').email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida').min(6, 'Mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'El email es requerido').email('Email inválido'),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(1, 'La contraseña es requerida').min(6, 'Mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

// ============== Employee Schemas ==============

export const employeeSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido').max(50),
  lastName: z.string().min(1, 'El apellido es requerido').max(50),
  email: z.string().min(1, 'El email es requerido').email('Email inválido'),
  dni: z.string().min(1, 'El DNI es requerido').regex(/^\d{8}[A-Z]$/i, 'DNI inválido (8 dígitos + letra)'),
  phone: z.string().optional(),
  department: z.string().min(1, 'El departamento es requerido'),
  jobTitle: z.string().min(1, 'El puesto es requerido'),
  contractType: z.string().min(1, 'El tipo de contrato es requerido'),
  entryDate: z.string().min(1, 'La fecha de ingreso es requerida'),
});

// ============== Common Schemas ==============

export const dniSchema = z.string()
  .min(1, 'El DNI es requerido')
  .regex(/^\d{8}[A-Z]$/i, 'Formato: 8 dígitos + letra (ej: 12345678A)');

export const phoneSchema = z.string()
  .regex(/^\+?\d{9,15}$/, 'Teléfono inválido (ej: +34612345678)');

export const positiveNumberSchema = z.number()
  .positive('Debe ser un número positivo')
  .finite('Número inválido');

// ============== Filter Schemas ==============

export const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: 'La fecha inicial debe ser anterior a la final',
  path: ['endDate'],
});

// ============== Type Exports ==============

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type EmployeeFormData = z.infer<typeof employeeSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;