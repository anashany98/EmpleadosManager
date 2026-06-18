import { z } from 'zod';

export const DNI_REGEX = /^\d{8}[A-Z]$/i;
export const NIE_REGEX = /^[XYZ]\d{7}[A-Z]$/i;
export const IBAN_REGEX = /^ES\d{22}$/i;
export const PHONE_REGEX = /^[\d\s+\-()]{6,20}$/;

export const dniValidator = z.string().regex(DNI_REGEX, 'DNI inválido (8 dígitos + letra)').optional();
export const nieValidator = z.string().regex(NIE_REGEX, 'NIE inválido').optional();
export const emailValidator = z.string().email('Email inválido').optional().nullable().or(z.literal(''));
export const phoneValidator = z.string().regex(PHONE_REGEX, 'Teléfono inválido').optional().nullable();
export const ibanValidator = z.string().regex(IBAN_REGEX, 'IBAN inválido (debe empezar por ES)').optional().nullable();

export const dniOrNieValidator = z.string().refine(
    (val) => DNI_REGEX.test(val) || NIE_REGEX.test(val),
    'DNI/NIE inválido'
).optional();

export function createDniValidator() {
    return z.string().refine(
        (val) => DNI_REGEX.test(val) || NIE_REGEX.test(val),
        'DNI/NIE inválido (formato: 12345678A o X/Y/Z + 7 dígitos + letra)'
    );
}

export function createIbanValidator() {
    return z.string().regex(IBAN_REGEX, 'IBAN inválido (ejemplo: ES9121000418450200051332)').optional().nullable().or(z.literal(''));
}

export function createEmailValidator() {
    return z.string().email('Email inválido').optional().nullable().or(z.literal(''));
}

export function createPhoneValidator() {
    return z.string().regex(PHONE_REGEX, 'Teléfono inválido (mínimo 6 caracteres)').optional().nullable().or(z.literal(''));
}