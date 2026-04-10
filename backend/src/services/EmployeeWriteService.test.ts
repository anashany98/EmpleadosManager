import { describe, expect, it, vi } from 'vitest';
import { buildCompanyEmployeeUpdateData, buildEmployeeCreateData } from './EmployeeWriteService';

vi.mock('./EncryptionService', () => ({
    EncryptionService: {
        encrypt: vi.fn((value) => value ? `encrypted_${value}` : null)
    }
}));

describe('EmployeeWriteService', () => {
    it('builds create payloads with encryption and capped emergency contacts', () => {
        const payload = buildEmployeeCreateData({
            dni: '12345678A',
            firstName: 'Ana',
            lastName: 'Gómez',
            socialSecurityNumber: '123',
            iban: 'ES00',
            emergencyContacts: Array.from({ length: 6 }).map((_, index) => ({
                name: `Contacto ${index}`,
                phone: `60000000${index}`,
                relationship: 'Familia'
            }))
        }, 'company-1');

        expect(payload.companyId).toBe('company-1');
        expect(payload.socialSecurityNumber).toBe('encrypted_123');
        expect(payload.iban).toBe('encrypted_ES00');
        expect(payload.emergencyContacts.create).toHaveLength(5);
        expect(payload.name).toBe('Ana Gómez');
    });

    it('builds company update payloads with encrypted sensitive fields and replace semantics for contacts', () => {
        const payload = buildCompanyEmployeeUpdateData({
            socialSecurityNumber: '321',
            iban: 'ES99',
            annualGrossSalary: '24000',
            monthlyGrossSalary: '2000',
            emergencyContacts: [{ name: 'Contacto', phone: '600', relationship: 'Padre' }],
            lowDate: ''
        });

        expect(payload.socialSecurityNumber).toBe('encrypted_321');
        expect(payload.iban).toBe('encrypted_ES99');
        expect(payload.annualGrossSalary).toBe(24000);
        expect(payload.monthlyGrossSalary).toBe(2000);
        expect(payload.lowDate).toBeNull();
        expect(payload.emergencyContacts).toEqual({
            deleteMany: {},
            create: [{ name: 'Contacto', phone: '600', relationship: 'Padre' }]
        });
    });
});

