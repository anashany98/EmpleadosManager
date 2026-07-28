import { z } from 'zod';

const emptyToNull = (value: unknown) =>
    typeof value === 'string' && value.trim() === '' ? null : value;

const nullableText = (maxLength: number) =>
    z.preprocess(emptyToNull, z.string().trim().max(maxLength).nullable().optional());

const nullableEmail = z.preprocess(
    emptyToNull,
    z.string().trim().email('El correo electrónico no es válido').max(254).nullable().optional()
);

const nullableUrl = z.preprocess(
    emptyToNull,
    z.string().trim().url('La URL del logotipo no es válida').max(2048).nullable().optional()
);

const nullableCoordinate = (minimum: number, maximum: number, label: string) =>
    z.preprocess(
        (value) => {
            if (value === '' || value === null) return null;
            if (typeof value === 'string') return Number(value);
            return value;
        },
        z.number({ invalid_type_error: `${label} debe ser un número` })
            .finite()
            .min(minimum)
            .max(maximum)
            .nullable()
            .optional()
    );

const nullableRadius = z.preprocess(
    (value) => {
        if (value === '' || value === null) return null;
        if (typeof value === 'string') return Number(value);
        return value;
    },
    z.number({ invalid_type_error: 'El radio permitido debe ser un número entero' })
        .int()
        .min(10, 'El radio mínimo es de 10 metros')
        .max(100_000, 'El radio máximo es de 100 km')
        .nullable()
        .optional()
);

const companyFields = {
    name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
    cif: z.string()
        .trim()
        .toUpperCase()
        .min(3, 'El CIF/NIF es demasiado corto')
        .max(20, 'El CIF/NIF es demasiado largo')
        .regex(/^[A-Z0-9][A-Z0-9 -]*$/, 'El CIF/NIF contiene caracteres no válidos'),
    logoUrl: nullableUrl,
    legalRep: nullableText(200),
    address: nullableText(300),
    postalCode: nullableText(20),
    city: nullableText(100),
    province: nullableText(100),
    country: nullableText(100),
    email: nullableEmail,
    phone: nullableText(30),
    officeLatitude: nullableCoordinate(-90, 90, 'La latitud'),
    officeLongitude: nullableCoordinate(-180, 180, 'La longitud'),
    allowedRadius: nullableRadius,
};

const companyIdParams = z.object({
    id: z.string().uuid('ID de empresa inválido'),
}).strict();

export const companyCreateSchema = z.object({
    body: z.object(companyFields).strict(),
});

export const companyUpdateSchema = z.object({
    params: companyIdParams,
    body: z.object(companyFields)
        .partial()
        .strict()
        .refine((body) => Object.keys(body).length > 0, {
            message: 'Debe indicarse al menos un campo para actualizar',
        }),
});

export const companyIdParamSchema = z.object({
    params: companyIdParams,
});
