import { describe, expect, it, vi } from 'vitest';
import { buildCompanyEmployeeUpdateData, buildEmployeeCreateData } from './EmployeeWriteService';

vi.mock('./EncryptionService', () => ({
    EncryptionService: {
        encrypt: vi.fn((value) => value ? `encrypted_${value}` : null)
    }
}));

describe('EmployeeWriteService', () => {
    it('builds create payloads with searchable DNI, encrypted PII and capped emergency contacts', () => {
        const payload = buildEmployeeCreateData({
            dni: '12345678a',
            firstName: 'Ana',
            lastName: 'Gómez',
            socialSecurityNumber: '123 45-6',
            iban: 'es00 1234',
            emergencyContacts: Array.from({ length: 6 }).map((_, index) => ({
                name: `Contacto ${index}`,
                phone: `60000000${index}`,
                relationship: 'Familia'
            }))
        }, 'company-1');

        expect(payload.companyId).toBe('company-1');
        expect(payload.dni).toBe('12345678A');
        expect(payload.dniEnc).toBe('encrypted_12345678A');
        expect(payload.socialSecurityNumber).toBe('encrypted_123456');
        expect(payload.socialSecurityNumberEnc).toBe('encrypted_123456');
        expect(payload.iban).toBe('encrypted_ES001234');
        expect(payload.ibanEnc).toBe('encrypted_ES001234');
        expect(payload.emergencyContacts.create).toHaveLength(5);
        expect(payload.name).toBe('Ana Gómez');
    });

    it('builds create payloads without appending null to the name', () => {
        const payload = buildEmployeeCreateData({
            dni: '12345678A',
            firstName: 'Anas Hany Lahroudy',
            lastName: null
        }, 'company-1');

        expect(payload.name).toBe('Anas Hany Lahroudy');
        expect(payload.firstName).toBe('Anas Hany Lahroudy');
        expect(payload.lastName).toBeNull();
    });

    it('builds company update payloads with encrypted sensitive fields and replace semantics for contacts', () => {
        const payload = buildCompanyEmployeeUpdateData({
            dni: ' 12345678a ',
            socialSecurityNumber: '321 00-9',
            iban: 'es99 0000',
            annualGrossSalary: '24000',
            monthlyGrossSalary: '2000',
            emergencyContacts: [{ name: 'Contacto', phone: '600', relationship: 'Padre' }],
            lowDate: ''
        });

        expect(payload.dni).toBe('12345678A');
        expect(payload.dniEnc).toBe('encrypted_12345678A');
        expect(payload.socialSecurityNumber).toBe('encrypted_321009');
        expect(payload.socialSecurityNumberEnc).toBe('encrypted_321009');
        expect(payload.iban).toBe('encrypted_ES990000');
        expect(payload.ibanEnc).toBe('encrypted_ES990000');
        expect(payload.annualGrossSalary).toBe(0);
        expect(payload.monthlyGrossSalary).toBe(0);
        expect(payload.annualGrossSalaryEnc).toBe('encrypted_24000.00');
        expect(payload.monthlyGrossSalaryEnc).toBe('encrypted_2000.00');
        expect(payload.lowDate).toBeNull();
        expect(payload.emergencyContacts).toEqual({
            deleteMany: {},
            create: [{ name: 'Contacto', phone: '600', relationship: 'Padre' }]
        });
    });

    it('recomputes the canonical name when firstName or lastName change', () => {
        const payload = buildCompanyEmployeeUpdateData({
            firstName: 'Anas Hany Lahroudy',
            lastName: null
        }, {
            name: 'Anas Hany Lahroudy null',
            firstName: 'Anas Hany Lahroudy',
            lastName: 'null'
        });

        expect(payload.name).toBe('Anas Hany Lahroudy');
        expect(payload.firstName).toBe('Anas Hany Lahroudy');
        expect(payload.lastName).toBeNull();
    });
});
