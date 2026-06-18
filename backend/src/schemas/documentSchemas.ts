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
        employeeId: z.string().uuid("ID de empleado inválido").optional(),
        name: z.string().min(1, "Nombre es requerido").max(255),
        category: z.string().min(1, "Categoría es requerida").max(100),
        description: z.string().max(1000).optional(),
        expiryDate: z.string().datetime().optional()
    })
});

export const documentEmployeeParamSchema = employeeIdParamSchema;
export const documentIdParamSchema = uuidParamSchema;
export const documentDownloadSchema = idParamSchema;
