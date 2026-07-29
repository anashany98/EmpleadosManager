/**
 * Zod schemas for the Gestoría preparation module.
 *
 * Validación de entrada para los endpoints REST. Se mantienen
 * declarativos y separados del controller para que los tests
 * unitarios puedan importarlos directamente sin instanciar Express.
 *
 * Decimales: el modelo Prisma usa `Decimal(15, 4)` para celdas
 * numéricas. Aquí aceptamos strings o números (Zod coercion) y
 * validamos con un refinamiento que rechaza NaN, ±Infinity y
 * números fuera del rango Prisma.
 */
import { z } from 'zod';

// ============================================================
// Helpers reutilizables
// ============================================================

/**
 * Acepta string, number, null o undefined y lo normaliza a un
 * `number` o `null` (null si la entrada es null/undefined/""
 * o no parseable). Rejecta NaN/Infinity explícitamente.
 */
const decimalString = z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v, ctx) => {
        if (v === null || v === undefined || v === '') return null;
        const n = typeof v === 'number' ? v : parseFloat(v);
        if (!Number.isFinite(n)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valor numérico inválido' });
            return z.NEVER;
        }
        // Prisma Decimal(15, 4) admite hasta 11 dígitos enteros
        // con 4 decimales. Lo ampliamos a un techo seguro:
        // valor absoluto <= 1e12 con 4 decimales.
        if (Math.abs(n) > 1e12) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valor fuera de rango' });
            return z.NEVER;
        }
        return n;
    });

/**
 * Igual que decimalString pero rechaza null/undefined.
 */
const requiredDecimal = decimalString.refine((v) => v !== null, {
    message: 'Valor numérico obligatorio'
});
// requiredDecimal queda como builder reutilizable (no usado todavía
// pero se mantiene para callers que necesiten valor numérico
// obligatorio en vez de opcional).
void requiredDecimal;

/**
 * Año entre 2000 y 2100 (rango razonable para nóminas / gestoría).
 */
const yearSchema = z.coerce
    .number()
    .int()
    .min(2000, { message: 'Año inválido' })
    .max(2100, { message: 'Año inválido' });

/**
 * Mes 1..12.
 */
const monthSchema = z.coerce
    .number()
    .int()
    .min(1, { message: 'Mes inválido' })
    .max(12, { message: 'Mes inválido' });

/**
 * Tipos de concepto. Coincide EXACTAMENTE con el enum
 * `GestoriaConceptType` del schema Prisma (NO añadir valores
 * sin migrar la BD).
 */
export const GESTORIA_CONCEPT_TYPES = [
    'HOURS',
    'PRICE',
    'AMOUNT',
    'PERCENT',
    'BOOLEAN',
    'TEXT'
] as const;

const conceptTypeSchema = z.enum(GESTORIA_CONCEPT_TYPES);

/**
 * Código de concepto: 1-32 chars, alfanumérico + . _ -
 * Case-insensitive en validación: lo guardamos normalizado a UPPER.
 */
const conceptCodeSchema = z
    .string()
    .min(1, { message: 'Código obligatorio' })
    .max(32, { message: 'Código demasiado largo (máx 32)' })
    .regex(/^[A-Za-z0-9._-]+$/, { message: 'Código inválido: solo A-Z 0-9 . _ -' })
    .transform((v) => v.toUpperCase());

/**
 * Dirección de celda Excel estilo "A1" hasta "XFD1048576".
 * Validamos que sean letras (A-Z) seguidas de 1-7 dígitos.
 * Normalizamos a mayúsculas para que el operador pueda escribir
 * "b5" o "B5" indistintamente.
 */
const cellAddressSchema = z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(
        z.string().regex(/^[A-Z]{1,3}\d{1,7}$/, {
            message: 'Dirección de celda inválida (ej. B5, AA100)'
        })
    );

// ============================================================
// Periods
// ============================================================

/**
 * POST /companies/:companyId/periods
 * Crea un nuevo periodo (empresa + año + mes).
 */
export const createPeriodSchema = z.object({
    body: z.object({
        year: yearSchema,
        month: monthSchema,
        notes: z.string().max(2000).optional().nullable()
    }),
    params: z.object({
        companyId: z.string().min(1, { message: 'companyId obligatorio' })
    })
});

/**
 * PATCH /periods/:id
 * Edita el periodo (mapeo de exportación, notas).
 */
export const updatePeriodSchema = z.object({
    params: z.object({
        id: z.string().min(1)
    }),
    body: z.object({
        notes: z.string().max(2000).optional().nullable(),
        /**
         * Mapeo `código de concepto → dirección de celda`. Las claves
         * se normalizan a UPPER; los valores se validan con
         * cellAddressSchema.
         */
        exportMapping: z
            .record(conceptCodeSchema, cellAddressSchema)
            .nullable()
            .optional()
    })
});

/**
 * POST /periods/:id/close y /reopen
 */
export const periodIdParamSchema = z.object({
    params: z.object({
        id: z.string().min(1)
    })
});

export const reopenPeriodSchema = z.object({
    params: z.object({
        id: z.string().min(1)
    }),
    body: z.object({
        /**
         * Motivo obligatorio ≥ 5 chars. Se persiste en
         * `GestoriaPeriod.reopenReason` y en el audit log.
         */
        reason: z
            .string()
            .min(5, { message: 'Motivo obligatorio (mín. 5 caracteres)' })
            .max(500)
    })
});

// ============================================================
// Concepts
// ============================================================

/**
 * Codigos de plantilla .xls de gestoria soportados para auto-derivar
 * la direccion de celda. "null" = sin mapeo (no se exporta).
 * La columna del .xls esta hardcodeada en GestoriaExportService
 * (GESTORIA_COLUMN_MAP); aqui solo validamos que el codigo sea uno
 * conocido o null.
 */
export const gestoriaCodeSchema = z
    .string()
    .trim()
    .regex(/^(044|048|050|182|434|604|791)$/, 'Codigo de gestoria no soportado (usa 044, 048, 050, 182, 434, 604 o 791)')
    .nullable()
    .optional();

export const createConceptSchema = z.object({
    params: z.object({
        id: z.string().min(1) // periodId
    }),
    body: z.object({
        code: conceptCodeSchema,
        label: z.string().min(1).max(120),
        type: conceptTypeSchema,
        decimals: z.coerce.number().int().min(0).max(6).default(2),
        order: z.coerce.number().int().min(0).max(10000).optional(),
        gestoriaCode: gestoriaCodeSchema
    })
});

export const updateConceptSchema = z.object({
    params: z.object({
        id: z.string().min(1), // periodId
        conceptId: z.string().min(1)
    }),
    body: z.object({
        label: z.string().min(1).max(120).optional(),
        isVisible: z.boolean().optional(),
        order: z.coerce.number().int().min(0).max(10000).optional(),
        decimals: z.coerce.number().int().min(0).max(6).optional(),
        gestoriaCode: gestoriaCodeSchema
    })
});

export const conceptIdParamSchema = z.object({
    params: z.object({
        id: z.string().min(1), // periodId
        conceptId: z.string().min(1)
    })
});

// ============================================================
// Rows
// ============================================================

/**
 * POST /periods/:id/rows
 * Crea fila para un empleado (o varias si employeeIds es array).
 */
export const createRowSchema = z.object({
    params: z.object({
        id: z.string().min(1) // periodId
    }),
    body: z.object({
        employeeId: z.string().min(1)
    })
});

/**
 * PATCH /periods/:id/rows/:rowId
 */
export const updateRowSchema = z.object({
    params: z.object({
        id: z.string().min(1), // periodId
        rowId: z.string().min(1)
    }),
    body: z.object({
        observations: z.string().max(5000).nullable().optional(),
        isReviewed: z.boolean().optional()
    })
});

export const rowIdParamSchema = z.object({
    params: z.object({
        id: z.string().min(1), // periodId
        rowId: z.string().min(1)
    })
});

/**
 * PUT /periods/:id/rows/:rowId/cells
 * Reemplaza el conjunto de celdas de la fila. Atomicidad: dentro
 * de una transacción Prisma.
 */
export const putCellsSchema = z.object({
    params: z.object({
        id: z.string().min(1), // periodId
        rowId: z.string().min(1)
    }),
    body: z.object({
        /**
         * Mapa `conceptCode → valor`. numericValue o textValue se
         * infiere del type del concepto en el service.
         */
        cells: z.array(
            z.object({
                code: conceptCodeSchema,
                value: decimalString.or(z.string().max(2000)).or(z.boolean())
            })
        ).max(200)
    })
});

/**
 * POST /periods/:id/rows/bulk
 * Operaciones masivas. Tipos:
 *  - setCell { employeeId, code, value }
 *  - clearCell { employeeId, code }
 *  - setReviewed { employeeIds, isReviewed }
 *  - deleteRows { rowIds }
 */
export const bulkRowOpSchema = z.object({
    params: z.object({
        id: z.string().min(1) // periodId
    }),
    body: z
        .object({
            operation: z.enum(['setCell', 'clearCell', 'setReviewed', 'deleteRows'])
        })
        .and(
            z.union([
                z.object({
                    operation: z.literal('setCell'),
                    employeeId: z.string().min(1),
                    code: conceptCodeSchema,
                    value: decimalString.or(z.string().max(2000)).or(z.boolean())
                }),
                z.object({
                    operation: z.literal('clearCell'),
                    employeeId: z.string().min(1),
                    code: conceptCodeSchema
                }),
                z.object({
                    operation: z.literal('setReviewed'),
                    employeeIds: z.array(z.string().min(1)).min(1).max(500),
                    isReviewed: z.boolean()
                }),
                z.object({
                    operation: z.literal('deleteRows'),
                    rowIds: z.array(z.string().min(1)).min(1).max(500)
                })
            ])
        )
});

// ============================================================
// Views
// ============================================================

export const upsertViewSchema = z.object({
    params: z.object({
        id: z.string().min(1) // periodId
    }),
    body: z.object({
        viewName: z.string().min(1).max(120),
        columnOrder: z.array(conceptCodeSchema).max(200),
        hiddenConcepts: z.array(conceptCodeSchema).max(200),
        isDefault: z.boolean().optional()
    })
});

// ============================================================
// Export
// ============================================================

export const previewExportSchema = z.object({
    params: z.object({
        id: z.string().min(1) // periodId
    }),
    body: z.object({
        /**
         * Si true, no persiste `GestoriaExportLog` (modo dry-run).
         */
        dryRun: z.boolean().default(true),
        /**
         * Si true, fuerza la regeneración aunque la plantilla esté
         * cifrada y no haya contraseña (útil para el preview).
         */
        ignoreMissingPassword: z.boolean().default(false)
    })
});

export const downloadExportQuerySchema = z.object({
    params: z.object({
        id: z.string().min(1) // periodId
    }),
    query: z.object({
        logId: z.string().min(1).optional()
    })
});

/**
 * Query params para listar filas (filtros / paginación).
 */
export const listRowsQuerySchema = z.object({
    params: z.object({
        id: z.string().min(1) // periodId
    }),
    query: z.object({
        isReviewed: z
            .union([z.literal('true'), z.literal('false')])
            .optional()
            .transform((v) => (v === undefined ? undefined : v === 'true')),
        department: z.string().max(120).optional(),
        category: z.string().max(120).optional(),
        search: z.string().max(120).optional()
    })
});

// =====================================================================
// Import from Excel template
// =====================================================================

const importConceptSchema = z.object({
    code: z.string().min(1).max(50),
    label: z.string().min(1).max(100),
    type: z.enum([...GESTORIA_CONCEPT_TYPES] as [string, ...string[]]),
    is_system: z.boolean().optional().default(false),
    decimals: z.number().int().min(0).max(4).optional().default(2)
});

const importEmployeeSchema = z.object({
    employeeId: z.string().optional(),
    employeeName: z.string().min(1).max(200),
    department: z.string().max(120).optional(),
    category: z.string().max(120).optional(),
    cells: z.array(z.object({
        conceptCode: z.string().min(1),
        numericValue: decimalString.optional(),
        textValue: z.string().optional()
    })).optional()
});

export const importFromExcelSchema = z.object({
    params: z.object({
        companyId: z.string().min(1)
    }),
    body: z.object({
        year: yearSchema,
        month: monthSchema,
        notes: z.string().max(500).optional(),
        concepts: z.array(importConceptSchema).min(1).max(50),
        employees: z.array(importEmployeeSchema).optional(),
        festivos: z.array(z.string()).optional(),
        config: z.object({
            descanso_minutos: z.number().optional(),
            horas_laborables: z.number().optional(),
            limite_h_ext: z.number().optional(),
            limite_h_ext_festivos: z.number().optional()
        }).optional()
    })
});
