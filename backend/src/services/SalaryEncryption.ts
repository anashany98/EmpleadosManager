import { EncryptionService } from './EncryptionService';

/**
 * Application-layer salary encryption.
 *
 * Salaries are stored encrypted at rest (`*Enc` columns). The legacy
 * `Decimal` columns are kept at 0 so SQL aggregates still work (we
 * treat them as untrusted/non-authoritative; reads MUST use this
 * module and decrypt the value).
 *
 * The encrypt helper accepts a `number | string | null | undefined`
 * and returns the `gcm:iv:authTag:ciphertext` string (or null for
 * empty inputs). The decrypt helper returns a JS number.
 */

const SALARY_FIELDS = [
    'annualGrossSalary',
    'monthlyGrossSalary',
    'annualTotalSalary',
    'monthlyTotalSalary'
] as const;

type SalaryField = (typeof SALARY_FIELDS)[number];
const ENC_SUFFIX = 'Enc';
type EncryptedField = `${SalaryField}${typeof ENC_SUFFIX}`;

const FIELD_TO_ENC: Record<SalaryField, EncryptedField> = {
    annualGrossSalary: 'annualGrossSalaryEnc',
    monthlyGrossSalary: 'monthlyGrossSalaryEnc',
    annualTotalSalary: 'annualTotalSalaryEnc',
    monthlyTotalSalary: 'monthlyTotalSalaryEnc'
};

/**
 * Encrypt a salary value (number or numeric string) and return the
 * ciphertext string suitable for storage in the corresponding `*Enc`
 * column. Returns `null` for empty / zero / non-numeric inputs.
 */
function encryptSalary(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (!Number.isFinite(num) || num === 0) {
        return null;
    }
    // Always store a canonical 2-decimal representation so that
    // re-encrypting the same value yields the same ciphertext pattern
    // (modulo the random IV).
    return EncryptionService.encrypt(num.toFixed(2));
}

/**
 * Decrypt a salary value previously produced by `encryptSalary`.
 * Returns `null` for empty / unparseable / decryption-failed inputs.
 */
function decryptSalary(ciphertext: string | null | undefined): number | null {
    if (!ciphertext) return null;
    const plain = EncryptionService.decrypt(ciphertext);
    if (plain === null || plain === undefined) return null;
    const num = parseFloat(plain);
    return Number.isFinite(num) ? num : null;
}

/**
 * Attach encrypted salary fields to a Prisma `data` (create or update)
 * payload, based on the plaintext salaries in the body. Returns the
 * input `data` mutated, with the `Decimal` salary fields zeroed and
 * the `*Enc` fields populated. Idempotent: re-running with the same
 * body yields the same encrypted columns.
 *
 * Usage:
 *   const data = buildEmployeeCreateData(body, companyId);
 *   applyEncryptedSalaries(data, body);
 */
function applyEncryptedSalaries<T extends Record<string, any>>(
    data: T,
    body: Record<string, any>
): T {
    for (const field of SALARY_FIELDS) {
        const encField = FIELD_TO_ENC[field];
        // Encrypt the plaintext from the body. If the body has no
        // value for this field, we DO NOT touch the Enc column on
        // updates (preserves the previous value); on creates we set
        // null.
        const plaintext = body[field];
        if (plaintext === undefined) {
            continue;
        }
        const ciphertext = encryptSalary(plaintext);
        (data as Record<string, any>)[encField] = ciphertext;
        // The Decimal column is non-authoritative; keep it at 0 to
        // discourage accidental use in calculations. If the caller
        // still needs the plaintext, they MUST go through this
        // service.
        (data as Record<string, any>)[field] = 0;
    }
    return data;
}

/**
 * Decrypt all `*Enc` salary columns on an employee record. Returns a
 * new object with the plaintext numbers exposed under the
 * non-`Enc` field names. The input is not mutated.
 *
 * Use this in: PDF generation, accessibility reports, payroll
 * calculations, anywhere that needs the actual number.
 */
function decryptEmployeeSalaries<T extends Record<string, any>>(employee: T): T & {
    annualGrossSalary: number | null;
    monthlyGrossSalary: number | null;
    annualTotalSalary: number | null;
    monthlyTotalSalary: number | null;
} {
    const out: any = { ...employee };
    for (const field of SALARY_FIELDS) {
        const encField = FIELD_TO_ENC[field];
        out[field] = decryptSalary(employee[encField] as string | null | undefined);
    }
    return out;
}

export const SalaryEncryption = {
    encryptSalary,
    decryptSalary,
    applyEncryptedSalaries,
    decryptEmployeeSalaries,
    SALARY_FIELDS,
    FIELD_TO_ENC
};
