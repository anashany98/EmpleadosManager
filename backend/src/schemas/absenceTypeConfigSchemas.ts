import { z } from 'zod';

export const absenceTypeCreateSchema = z.object({
    code: z.string().min(1).max(50).regex(/^[A-Z_]+$/, 'El código debe ser MAYÚSCULAS con guiones bajos'),
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color debe ser hex (#RRGGBB)').optional().default('#6366f1'),
    icon: z.string().max(50).optional().default('calendar'),
    description: z.string().max(500).optional().nullable(),
    annualLimitDays: z.number().int().min(0).max(365).optional().nullable(),
    countsForBalance: z.boolean().optional().default(false),
    requiresAttachment: z.boolean().optional().default(false),
    requiresApproval: z.boolean().optional().default(true),
});

export const absenceTypeUpdateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color debe ser hex (#RRGGBB)').optional(),
    icon: z.string().max(50).optional(),
    description: z.string().max(500).optional().nullable(),
    annualLimitDays: z.number().int().min(0).max(365).optional().nullable(),
    countsForBalance: z.boolean().optional(),
    requiresAttachment: z.boolean().optional(),
    requiresApproval: z.boolean().optional(),
    isActive: z.boolean().optional(),
});
