import { describe, expect, it } from 'vitest';
import {
    documentTemplateGenerateSchema,
    documentTemplatePreviewSchema,
    documentTemplateSaveSchema
} from './documentSchemas';

const wrap = <T>(data: T) => ({ body: data });

describe('documentTemplateSaveSchema', () => {
    const validLayout = JSON.stringify({
        kind: 'layout-template',
        version: 1,
        elements: [
            {
                id: 'title',
                type: 'text',
                x: 10,
                y: 10,
                w: 80,
                h: 5,
                text: 'Hola {{empleado.nombreCompleto}}',
                fontSize: 18,
                fontWeight: 'bold',
                color: '#111827',
                align: 'center'
            }
        ]
    });

    it('accepts a well-formed layout-template payload', () => {
        const result = documentTemplateSaveSchema.safeParse(
            wrap({
                type: 'NDA',
                name: 'Acuerdo de Confidencialidad',
                content: validLayout,
                variables: ['empleado.nombreCompleto']
            })
        );
        expect(result.success).toBe(true);
    });

    it('rejects empty type and name', () => {
        const result = documentTemplateSaveSchema.safeParse(
            wrap({ type: '', name: '', content: validLayout })
        );
        expect(result.success).toBe(false);
    });

    it('rejects lowercase or hyphenated type identifiers', () => {
        const result = documentTemplateSaveSchema.safeParse(
            wrap({ type: 'nda-1', name: 'X', content: validLayout })
        );
        expect(result.success).toBe(false);
    });

    it('rejects content that is not valid JSON', () => {
        const result = documentTemplateSaveSchema.safeParse(
            wrap({ type: 'NDA', name: 'X', content: 'not-json' })
        );
        expect(result.success).toBe(false);
        if (!result.success) {
            const issues = result.error.issues.map((issue) => issue.message);
            expect(issues.some((message) => message.includes('JSON'))).toBe(true);
        }
    });

    it('rejects layout payloads with invalid element types', () => {
        const broken = JSON.stringify({
            kind: 'layout-template',
            version: 1,
            elements: [{ id: 'x', type: 'unknown', x: 1, y: 2 }]
        });
        const result = documentTemplateSaveSchema.safeParse(
            wrap({ type: 'NDA', name: 'X', content: broken })
        );
        expect(result.success).toBe(false);
    });

    it('rejects variable names that contain whitespace', () => {
        const result = documentTemplateSaveSchema.safeParse(
            wrap({ type: 'NDA', name: 'X', content: validLayout, variables: ['bad variable'] })
        );
        expect(result.success).toBe(false);
    });

    it('rejects payloads with more than 500 elements (DoS guard)', () => {
        const huge = {
            kind: 'layout-template',
            version: 1,
            elements: Array.from({ length: 600 }).map((_, index) => ({
                id: `el-${index}`,
                type: 'text',
                x: 0,
                y: 0,
                text: 'x'
            }))
        };
        const result = documentTemplateSaveSchema.safeParse(
            wrap({ type: 'NDA', name: 'X', content: JSON.stringify(huge) })
        );
        expect(result.success).toBe(false);
    });

    it('still accepts legacy array-style content for backwards compatibility', () => {
        const legacy = JSON.stringify([
            { id: 'a', type: 'text', x: 0, y: 0, content: 'A' }
        ]);
        const result = documentTemplateSaveSchema.safeParse(
            wrap({ type: 'CUSTOM', name: 'Legacy', content: legacy })
        );
        expect(result.success).toBe(true);
    });
});

describe('documentTemplateGenerateSchema', () => {
    it('requires either type or templateType', () => {
        const result = documentTemplateGenerateSchema.safeParse(
            wrap({ employeeId: 'emp-1' })
        );
        expect(result.success).toBe(false);
    });

    it('accepts the canonical form with type and employeeId', () => {
        const result = documentTemplateGenerateSchema.safeParse(
            wrap({ type: 'NDA', employeeId: 'emp-1' })
        );
        expect(result.success).toBe(true);
    });
});

describe('documentTemplatePreviewSchema', () => {
    it('requires employeeId', () => {
        const result = documentTemplatePreviewSchema.safeParse(wrap({ content: '{}' }));
        expect(result.success).toBe(false);
    });
});
