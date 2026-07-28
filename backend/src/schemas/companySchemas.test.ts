import { describe, expect, it } from 'vitest';
import {
    companyCreateSchema,
    companyIdParamSchema,
    companyUpdateSchema,
} from './companySchemas';

const companyId = '1d0d8de9-6a9f-40e0-a353-cbabefb94427';

describe('companySchemas', () => {
    it('normaliza los campos de creación antes de llegar al controlador', () => {
        const result = companyCreateSchema.parse({
            body: {
                name: '  Empresa Norte  ',
                cif: ' b12345678 ',
                email: '',
                officeLatitude: '40.4168',
                officeLongitude: '-3.7038',
                allowedRadius: '250',
            },
        });

        expect(result.body).toMatchObject({
            name: 'Empresa Norte',
            cif: 'B12345678',
            email: null,
            officeLatitude: 40.4168,
            officeLongitude: -3.7038,
            allowedRadius: 250,
        });
    });

    it.each([
        [{ email: 'correo-invalido' }, 'email'],
        [{ officeLatitude: 91 }, 'latitude'],
        [{ officeLongitude: -181 }, 'longitude'],
        [{ allowedRadius: 2.5 }, 'radius'],
        [{ unexpected: 'field' }, 'unknown field'],
    ])('rechaza entradas inválidas: %s (%s)', (fields) => {
        expect(() => companyCreateSchema.parse({
            body: {
                name: 'Empresa Norte',
                cif: 'B12345678',
                ...fields,
            },
        })).toThrow();
    });

    it('permite actualizaciones parciales sin inventar valores ausentes', () => {
        const result = companyUpdateSchema.parse({
            params: { id: companyId },
            body: { city: 'Madrid' },
        });

        expect(result.body).toEqual({ city: 'Madrid' });
        expect(result.body).not.toHaveProperty('allowedRadius');
        expect(result.body).not.toHaveProperty('officeLatitude');
    });

    it('rechaza actualizaciones vacías e identificadores no UUID', () => {
        expect(() => companyUpdateSchema.parse({
            params: { id: companyId },
            body: {},
        })).toThrow();

        expect(() => companyIdParamSchema.parse({
            params: { id: 'empresa-1' },
        })).toThrow();
    });
});
