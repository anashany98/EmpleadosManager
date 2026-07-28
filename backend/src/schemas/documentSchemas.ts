import { z } from 'zod';
import { employeeIdParamSchema, idParamSchema, uuidParamSchema } from './commonSchemas';

/**
 * Schemas for the document routes. The body for upload is multipart
 * (file + form fields), so we only validate the form fields here.
 * File presence and magic bytes are validated separately in
 * `multer` + `fileValidation` middleware.
 */

export const documentUploadMetadataSchema = z.object({
    body: z.object({
        employeeId: z.string().uuid("ID de empleado inválido"),
        name: z.string().min(1, "Nombre es requerido").max(255),
        category: z.string().min(1, "Categoría es requerida").max(100),
        description: z.string().max(1000).optional(),
        expiryDate: z.string().datetime().optional()
    })
});

export const documentEmployeeParamSchema = employeeIdParamSchema;
export const documentIdParamSchema = uuidParamSchema;
export const documentDownloadSchema = idParamSchema;

/**
 * Schema for `POST /document-templates/save`. Validates:
 *  - `type`: alphanumeric identifier (matches the editor's BACKEND_CATALOG_TEMPLATE_TYPES).
 *  - `name`: human label (max 120 chars).
 *  - `content`: JSON string of the canvas layout. We parse the string here so a
 *    broken payload never reaches the persistence layer.
 *  - `variables`: array of `dot.path` strings referenced in the content.
 *  - `scope`: `'company'` (default) or `'global'`.
 */
export const documentTemplateTypeSchema = z
    .string()
    .min(1, "type es obligatorio")
    .max(64, "type demasiado largo")
    .regex(/^[A-Z0-9_]+$/, "type debe estar en MAYÚSCULAS con guiones bajos");

const variablePathSchema = z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z][\w.-]*$/, "variable inválida");

const layoutElementSchema = z
    .object({
        id: z.string().min(1),
        type: z.enum(['text', 'variable', 'box', 'logo', 'qr', 'line', 'image']),
        x: z.number().finite(),
        y: z.number().finite(),
        w: z.number().nonnegative().optional(),
        h: z.number().nonnegative().optional(),
        zIndex: z.number().int().nonnegative().optional(),
        text: z.string().optional(),
        variable: variablePathSchema.optional(),
        prefix: z.string().optional(),
        suffix: z.string().optional(),
        fallback: z.string().optional(),
        fontSize: z.number().positive().optional(),
        fontWeight: z.enum(['normal', 'bold']).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        align: z.enum(['left', 'center', 'right', 'justify']).optional(),
        lineHeight: z.number().positive().optional(),
        fillColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        borderColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        borderWidth: z.number().nonnegative().optional(),
        radius: z.number().nonnegative().optional(),
        source: z.enum(['company', 'default', 'custom']).optional(),
        url: z.string().optional(),
        fit: z.enum(['contain', 'cover']).optional(),
        dataSource: z.enum(['document', 'custom', 'variable']).optional(),
        value: z.string().optional(),
        backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        opacity: z.number().min(0).max(1).optional()
    })
    .passthrough();

const layoutTemplateSchema = z.object({
    kind: z.literal('layout-template'),
    version: z.literal(1),
    page: z
        .object({
            backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
            showGrid: z.boolean().optional()
        })
        .optional(),
    elements: z.array(layoutElementSchema).max(500, "demasiados elementos")
});

export const documentTemplateSaveSchema = z.object({
    body: z.object({
        type: documentTemplateTypeSchema,
        name: z.string().min(1, "name es obligatorio").max(120),
        content: z
            .string()
            .min(2, "content es obligatorio")
            .max(2_000_000, "content demasiado grande")
            .superRefine((raw, ctx) => {
                let parsed: unknown;
                try {
                    parsed = JSON.parse(raw);
                } catch {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "content debe ser JSON válido"
                    });
                    return;
                }
                const layoutResult = layoutTemplateSchema.safeParse(parsed);
                if (layoutResult.success) return;

                // Legacy payloads (objects with `kind`/`elements`, or plain arrays)
                // are accepted for backwards compatibility, but still capped at
                // 500 elements to protect the persistence layer.
                const elementsCount = Array.isArray(parsed)
                    ? parsed.length
                    : Array.isArray((parsed as { elements?: unknown[] })?.elements)
                      ? ((parsed as { elements: unknown[] }).elements.length)
                      : 0;
                if (elementsCount > 500) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "demasiados elementos"
                    });
                    return;
                }

                const legacyObject = z
                    .object({
                        kind: z.string().optional(),
                        elements: z.array(layoutElementSchema.passthrough()).optional()
                    })
                    .passthrough()
                    .safeParse(parsed);

                const acceptsLegacyArray = Array.isArray(parsed)
                    ? parsed.every((item) => typeof item === 'object' && item !== null)
                    : false;

                if (!legacyObject.success && !acceptsLegacyArray) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "content no coincide con layout-template ni con un layout conocido"
                    });
                }
            }),
        variables: z.array(variablePathSchema).max(200).optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        scope: z.enum(['company', 'global']).optional()
    })
});

export const documentTemplateGenerateSchema = z.object({
    body: z.object({
        type: documentTemplateTypeSchema.optional(),
        templateType: documentTemplateTypeSchema.optional(),
        employeeId: z.string().min(1, "employeeId es obligatorio"),
        authorName: z.string().max(120).optional(),
        extraContext: z.record(z.unknown()).optional(),
        data: z.record(z.unknown()).optional()
    }).refine((body) => Boolean(body.type) || Boolean(body.templateType), {
        message: "type o templateType es obligatorio",
        path: ['type']
    })
});

export const documentTemplatePreviewSchema = z.object({
    body: z.object({
        type: documentTemplateTypeSchema.optional(),
        employeeId: z.string().min(1, "employeeId es obligatorio"),
        content: z.string().min(1).optional(),
        includePayroll: z.boolean().optional(),
        includeVacations: z.boolean().optional(),
        authorName: z.string().max(120).optional(),
        extraContext: z.record(z.unknown()).optional()
    })
});
