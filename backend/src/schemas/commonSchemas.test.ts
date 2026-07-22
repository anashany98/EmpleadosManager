import { describe, it, expect } from 'vitest';
import { employeeIdAndIdParamSchema } from './commonSchemas';

describe('employeeIdAndIdParamSchema', () => {
    it('parses when both employeeId and id are valid UUIDs/strings', () => {
        const result = employeeIdAndIdParamSchema.safeParse({
            params: {
                employeeId: '11111111-1111-1111-1111-111111111111',
                id: '22222222-2222-2222-2222-222222222222'
            }
        });
        expect(result.success).toBe(true);
        if (result.success) {
            // Crítico: ambos params deben sobrevivir, porque el controller lee req.params.id
            expect(result.data.params.employeeId).toBe('11111111-1111-1111-1111-111111111111');
            expect(result.data.params.id).toBe('22222222-2222-2222-2222-222222222222');
        }
    });

    it('rejects when employeeId is not a UUID', () => {
        const result = employeeIdAndIdParamSchema.safeParse({
            params: { employeeId: 'not-a-uuid', id: 'some-id' }
        });
        expect(result.success).toBe(false);
    });

    it('rejects when id is missing', () => {
        const result = employeeIdAndIdParamSchema.safeParse({
            params: { employeeId: '11111111-1111-1111-1111-111111111111' }
        });
        expect(result.success).toBe(false);
    });

    it('rejects when id is empty string', () => {
        const result = employeeIdAndIdParamSchema.safeParse({
            params: { employeeId: '11111111-1111-1111-1111-111111111111', id: '' }
        });
        expect(result.success).toBe(false);
    });
});
