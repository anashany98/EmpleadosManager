import { describe, expect, it } from 'vitest';
import { normalizeApiCollection, normalizeApiItem } from './vehicleUtils';

describe('vehicle API normalizers', () => {
    it('normalizes collection responses from direct arrays, ApiResponse data and nested paginated data', () => {
        const direct = [{ id: 'vehicle-1' }];
        const wrapped = { data: [{ id: 'vehicle-2' }] };
        const paginated = { data: { data: [{ id: 'vehicle-3' }], meta: { total: 1 } } };

        expect(normalizeApiCollection(direct)).toEqual(direct);
        expect(normalizeApiCollection(wrapped)).toEqual(wrapped.data);
        expect(normalizeApiCollection(paginated)).toEqual(paginated.data.data);
    });

    it('normalizes item responses from direct objects and ApiResponse data', () => {
        const direct = { id: 'vehicle-1', plate: '1234ABC' };
        const wrapped = { data: { id: 'vehicle-2', plate: '5678DEF' } };

        expect(normalizeApiItem(direct)).toEqual(direct);
        expect(normalizeApiItem(wrapped)).toEqual(wrapped.data);
        expect(normalizeApiItem(null)).toBeNull();
    });
});
