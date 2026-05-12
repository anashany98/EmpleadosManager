import { describe, expect, it } from 'vitest';
import {
    BACKEND_CATALOG_TEMPLATE_TYPES,
    DEFAULT_TEMPLATES,
    TEMPLATE_PRESETS,
    createElementsForTemplate,
    mergeTemplatesWithDefaults,
    resolveTemplatesByType,
    serializeTemplateContent
} from './templateBases';

const fixedId = (index: number) => `fixed-${index}`;
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

describe('template bases', () => {
    it('provides an editable visual base for every backend catalog template type', () => {
        BACKEND_CATALOG_TEMPLATE_TYPES.forEach((type) => {
            expect(TEMPLATE_PRESETS[type], type).toBeDefined();

            const elements = createElementsForTemplate({ type, name: type }, fixedId);
            expect(elements.length, type).toBeGreaterThan(0);
            expect(elements.some((element) => element.content.includes('{{')), type).toBe(true);
        });
    });

    it('keeps saved JSON canvas layouts unchanged', () => {
        const savedElements = [
            {
                id: 'saved-1',
                type: 'text',
                x: 12,
                y: 24,
                width: 180,
                height: 40,
                content: 'Texto guardado',
                fontSize: 16,
                fontWeight: 'normal',
                color: '#111827',
                textAlign: 'left'
            }
        ];

        const elements = createElementsForTemplate({
            type: 'NDA',
            name: 'NDA guardado',
            content: JSON.stringify(savedElements)
        }, fixedId);

        expect(elements).toEqual(savedElements);
    });

    it('serializes canvas elements as a backend renderable layout template', () => {
        const content = serializeTemplateContent([
            {
                id: 'title',
                type: 'text',
                x: 79.4,
                y: 112.3,
                width: 635.2,
                height: 56.15,
                content: 'Hola {{empleado.nombreCompleto}}',
                fontSize: 18,
                fontWeight: 'bold',
                color: '#111827',
                textAlign: 'center'
            },
            {
                id: 'employee',
                type: 'variable',
                x: 79.4,
                y: 224.6,
                width: 238.2,
                height: 33.69,
                content: '{{empleado.dni}}',
                fontSize: 11
            }
        ]);

        const parsed = JSON.parse(content);
        expect(parsed).toMatchObject({
            kind: 'layout-template',
            version: 1
        });
        expect(parsed.elements[0]).toMatchObject({
            id: 'title',
            type: 'text',
            x: 10,
            y: 10,
            w: 80,
            h: 5,
            text: 'Hola {{empleado.nombreCompleto}}'
        });
        expect(parsed.elements[1]).toMatchObject({
            id: 'employee',
            type: 'variable',
            variable: 'empleado.dni'
        });
    });

    it('loads backend layout templates back into editable canvas elements', () => {
        const content = JSON.stringify({
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
                    align: 'center'
                },
                {
                    id: 'employee',
                    type: 'variable',
                    x: 10,
                    y: 20,
                    w: 30,
                    h: 3,
                    variable: 'empleado.dni'
                }
            ]
        });

        const elements = createElementsForTemplate({ type: 'CUSTOM_BACKEND', name: 'Backend', content }, fixedId);

        expect(elements[0]).toMatchObject({
            id: 'title',
            type: 'text',
            x: 79.4,
            y: 112.3,
            width: 635.2,
            height: 56.15,
            content: 'Hola {{empleado.nombreCompleto}}',
            textAlign: 'center'
        });
        expect(elements[1]).toMatchObject({
            id: 'employee',
            type: 'variable',
            content: '{{empleado.dni}}'
        });
    });

    it('converts unknown markdown backend templates into editable A4 elements', () => {
        const elements = createElementsForTemplate({
            type: 'CUSTOM_LEGAL',
            name: 'Documento Legal',
            content: '# Documento Legal\n\nHola {{empleado.nombreCompleto}}\n\nFirma: {{firma.autorizante}}'
        }, fixedId);

        expect(elements.length).toBeGreaterThanOrEqual(6);
        expect(elements[0]).toMatchObject({ type: 'text', content: 'DOCUMENTO LEGAL' });
        expect(elements.some((element) => element.content.includes('{{empleado.nombreCompleto}}'))).toBe(true);
        expect(elements.some((element) => element.content === 'Firma empresa')).toBe(true);
    });

    it('keeps the selector list aligned with the catalog templates', () => {
        const selectorTypes = DEFAULT_TEMPLATES.map((template) => template.type);

        BACKEND_CATALOG_TEMPLATE_TYPES.forEach((type) => {
            expect(selectorTypes).toContain(type);
        });
    });

    it('uses the full editable A4 page area without overflowing', () => {
        Object.keys(TEMPLATE_PRESETS).forEach((type) => {
            const elements = createElementsForTemplate({ type, name: type }, fixedId);
            const maxRight = Math.max(...elements.map((element) => element.x + element.width));
            const maxBottom = Math.max(...elements.map((element) => element.y + element.height));

            expect(maxRight, type).toBeGreaterThanOrEqual(A4_WIDTH_PX * 0.88);
            expect(maxRight, type).toBeLessThanOrEqual(A4_WIDTH_PX);
            expect(maxBottom, type).toBeGreaterThanOrEqual(A4_HEIGHT_PX * 0.92);
            expect(maxBottom, type).toBeLessThanOrEqual(A4_HEIGHT_PX);
        });
    });

    it('merges backend catalog templates while keeping stable selector ids', () => {
        const mergedTemplates = mergeTemplatesWithDefaults([
            {
                type: 'NDA',
                name: 'NDA backend',
                content: '# NDA backend'
            },
            {
                type: 'CUSTOM_BACKEND',
                name: 'Documento backend',
                content: '# Documento backend'
            }
        ] as unknown as Parameters<typeof mergeTemplatesWithDefaults>[0]);

        expect(mergedTemplates.find((template) => template.type === 'NDA')).toMatchObject({
            id: 'nda',
            name: 'NDA backend',
            content: '# NDA backend'
        });
        expect(mergedTemplates.find((template) => template.type === 'CUSTOM_BACKEND')).toMatchObject({
            id: 'custom_backend',
            name: 'Documento backend'
        });
    });

    it('prefers company templates over global or catalog variants of the same type', () => {
        const resolved = resolveTemplatesByType([
            {
                id: 'catalog-nda',
                type: 'NDA',
                name: 'Catalogo NDA',
                content: '# Catalogo'
            },
            {
                id: 'global-nda',
                type: 'NDA',
                name: 'Global NDA',
                content: '# Global',
                companyId: null,
                isDefault: true,
                updatedAt: '2026-01-10T10:00:00.000Z'
            },
            {
                id: 'company-nda',
                type: 'NDA',
                name: 'Empresa NDA',
                content: '# Empresa',
                companyId: 'company-1',
                updatedAt: '2026-01-01T10:00:00.000Z'
            }
        ]);

        expect(resolved).toHaveLength(1);
        expect(resolved[0]).toMatchObject({
            id: 'company-nda',
            name: 'Empresa NDA',
            companyId: 'company-1'
        });
    });

    it('does not expose non-visual official PDF templates in the visual editor', () => {
        const mergedTemplates = mergeTemplatesWithDefaults([
            {
                type: 'MODEL_145',
                name: 'Modelo 145 guardado',
                content: '# Modelo 145'
            }
        ] as unknown as Parameters<typeof mergeTemplatesWithDefaults>[0]);

        expect(mergedTemplates.map((template) => template.type)).not.toContain('MODEL_145');
    });
});
