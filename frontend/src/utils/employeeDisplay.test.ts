import { describe, expect, it } from 'vitest';
import { getEmployeeDisplayName, getEmployeeInitials } from './employeeDisplay';

describe('employeeDisplay', () => {
    it('prefers canonical name when present', () => {
        expect(getEmployeeDisplayName({
            name: 'Anas Hany Lahroudy',
            firstName: 'Anas Hany Lahroudy',
            lastName: null
        })).toBe('Anas Hany Lahroudy');
    });

    it('joins firstName and lastName without rendering nullish parts', () => {
        expect(getEmployeeDisplayName({
            firstName: 'Laura',
            lastName: null
        })).toBe('Laura');
    });

    it('builds initials from the resolved display name', () => {
        expect(getEmployeeInitials({
            name: 'Maria Gomez'
        })).toBe('MG');
    });
});
