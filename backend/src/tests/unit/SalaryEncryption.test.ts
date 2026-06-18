import { describe, it, expect, beforeAll } from 'vitest';

// Ensure a 32-byte encryption key is set BEFORE importing the service.
// EncryptionService.validateKey() will fail fast otherwise.
beforeAll(() => {
    process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
    process.env.JWT_SECRET = 'test-jwt-secret-for-ci-with-enough-length';
    process.env.NODE_ENV = 'test';
});

describe('SalaryEncryption', () => {
    let SalaryEncryption: typeof import('../../services/SalaryEncryption').SalaryEncryption;
    let EncryptionService: typeof import('../../services/EncryptionService').EncryptionService;

    beforeAll(async () => {
        const enc = await import('../../services/EncryptionService');
        EncryptionService = enc.EncryptionService;
        EncryptionService.validateKey();
        const sal = await import('../../services/SalaryEncryption');
        SalaryEncryption = sal.SalaryEncryption;
    });

    it('encrypts a number value to a non-empty ciphertext', () => {
        const ct = SalaryEncryption.encryptSalary(28000);
        expect(ct).toBeTruthy();
        expect(ct).toMatch(/^gcm:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });

    it('encrypts a numeric string identically after canonicalisation', () => {
        // 28000.00 canonicalises to "28000.00"; same plaintext -> same
        // ciphertext pattern (IV aside).
        const ct1 = SalaryEncryption.encryptSalary('28000');
        const ct2 = SalaryEncryption.encryptSalary(28000);
        const p1 = SalaryEncryption.decryptSalary(ct1);
        const p2 = SalaryEncryption.decryptSalary(ct2);
        expect(p1).toBe(28000);
        expect(p2).toBe(28000);
    });

    it('returns null for zero, null, undefined, and empty string', () => {
        expect(SalaryEncryption.encryptSalary(0)).toBeNull();
        expect(SalaryEncryption.encryptSalary(null)).toBeNull();
        expect(SalaryEncryption.encryptSalary(undefined)).toBeNull();
        expect(SalaryEncryption.encryptSalary('')).toBeNull();
    });

    it('returns null for non-numeric values', () => {
        expect(SalaryEncryption.encryptSalary('not a number')).toBeNull();
        expect(SalaryEncryption.encryptSalary(NaN)).toBeNull();
    });

    it('decrypts round-trip correctly', () => {
        const original = 1234.56;
        const ct = SalaryEncryption.encryptSalary(original);
        const back = SalaryEncryption.decryptSalary(ct);
        expect(back).toBe(original);
    });

    it('decrypts null/undefined/empty as null', () => {
        expect(SalaryEncryption.decryptSalary(null)).toBeNull();
        expect(SalaryEncryption.decryptSalary(undefined)).toBeNull();
        expect(SalaryEncryption.decryptSalary('')).toBeNull();
    });

    it('decrypts garbage as null (does not throw)', () => {
        // Decryption must NEVER throw; it returns null on parse failure.
        expect(SalaryEncryption.decryptSalary('not-encrypted-data')).toBeNull();
        expect(SalaryEncryption.decryptSalary('gcm:bad:bad:bad')).toBeNull();
    });

    it('applyEncryptedSalaries zeroes Decimal columns and populates Enc columns', () => {
        const data: Record<string, any> = {};
        const body = {
            annualGrossSalary: 30000,
            monthlyGrossSalary: 2500,
            annualTotalSalary: 30000,
            monthlyTotalSalary: 2500
        };
        SalaryEncryption.applyEncryptedSalaries(data, body);
        // Decimal columns are zeroed
        expect(data.annualGrossSalary).toBe(0);
        expect(data.monthlyGrossSalary).toBe(0);
        // Enc columns are populated
        expect(data.annualGrossSalaryEnc).toMatch(/^gcm:/);
        expect(data.monthlyGrossSalaryEnc).toMatch(/^gcm:/);
        expect(data.annualTotalSalaryEnc).toMatch(/^gcm:/);
        expect(data.monthlyTotalSalaryEnc).toMatch(/^gcm:/);
    });

    it('applyEncryptedSalaries only touches provided fields (partial update)', () => {
        const data: Record<string, any> = {
            // Pretend the other fields are already set
            annualTotalSalaryEnc: 'gcm:existing:tag:ciphertext',
            monthlyTotalSalaryEnc: 'gcm:existing:tag:ciphertext'
        };
        const body = { annualGrossSalary: 30000 };
        SalaryEncryption.applyEncryptedSalaries(data, body);
        // Updated field
        expect(data.annualGrossSalaryEnc).toMatch(/^gcm:/);
        expect(data.annualGrossSalary).toBe(0);
        // Unset fields left untouched
        expect(data.annualTotalSalaryEnc).toBe('gcm:existing:tag:ciphertext');
    });

    it('decryptEmployeeSalaries exposes plaintext under non-Enc names', () => {
        const employee = {
            id: 'emp-1',
            annualGrossSalary: 0,
            annualGrossSalaryEnc: SalaryEncryption.encryptSalary(30000),
            monthlyGrossSalary: 0,
            monthlyGrossSalaryEnc: SalaryEncryption.encryptSalary(2500),
            annualTotalSalary: 0,
            annualTotalSalaryEnc: null,
            monthlyTotalSalary: 0,
            monthlyTotalSalaryEnc: null
        };
        const out = SalaryEncryption.decryptEmployeeSalaries(employee);
        expect(out.annualGrossSalary).toBe(30000);
        expect(out.monthlyGrossSalary).toBe(2500);
        expect(out.annualTotalSalary).toBeNull();
        expect(out.monthlyTotalSalary).toBeNull();
    });
});
