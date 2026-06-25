import { describe, expect, it } from 'vitest';
import {
    EMPTY_PREVIEW_CONTEXT,
    extractTemplateVariables,
    isKnownVariable,
    partitionVariables,
    resolveTemplateContent
} from './templateVariables';

describe('resolveTemplateContent', () => {
    it('replaces known placeholders with the value from the context', () => {
        const result = resolveTemplateContent('Hola {{empleado.nombreCompleto}}', {
            'empleado.nombreCompleto': 'Ana Hany'
        });
        expect(result).toBe('Hola Ana Hany');
    });

    it('keeps the placeholder visible when the variable is missing', () => {
        const result = resolveTemplateContent('{{empleado.dni}}', {});
        expect(result).toBe('{{empleado.dni}}');
    });

    it('tolerates whitespace inside the braces', () => {
        const result = resolveTemplateContent('{{ empleado.nombre }}', { 'empleado.nombre': 'Ana' });
        expect(result).toBe('Ana');
    });

    it('walks nested paths', () => {
        const result = resolveTemplateContent('{{empresa.direccion}}', {
            empresa: { direccion: 'Calle 1' }
        });
        expect(result).toBe('Calle 1');
    });

    it('keeps unknown variables intact instead of throwing', () => {
        const result = resolveTemplateContent('{{foo.bar}} - {{empleado.dni}}', { 'empleado.dni': 'X' });
        expect(result).toBe('{{foo.bar}} - X');
    });
});

describe('extractTemplateVariables', () => {
    it('returns unique variable keys in document order', () => {
        const result = extractTemplateVariables('{{a}} {{b}} {{a}} {{c.d}}');
        expect(result).toEqual(['a', 'b', 'c.d']);
    });

    it('returns an empty list when there are no placeholders', () => {
        expect(extractTemplateVariables('Hola mundo')).toEqual([]);
    });
});

describe('partitionVariables', () => {
    it('splits referenced variables into known and unknown buckets', () => {
        const { known, unknown } = partitionVariables('{{empleado.dni}} {{foo.bar}}');
        expect(known).toEqual(['empleado.dni']);
        expect(unknown).toEqual(['foo.bar']);
    });
});

describe('isKnownVariable', () => {
    it('recognises every variable declared in AVAILABLE_VARIABLES', () => {
        expect(isKnownVariable('empleado.dni')).toBe(true);
        expect(isKnownVariable('empresa.cif')).toBe(true);
    });

    it('rejects unknown variables', () => {
        expect(isKnownVariable('empleado.fooBar')).toBe(false);
    });
});

describe('EMPTY_PREVIEW_CONTEXT', () => {
    it('exposes a stable placeholder for every known variable', () => {
        expect(EMPTY_PREVIEW_CONTEXT['empleado.nombreCompleto']).toBeTruthy();
        expect(EMPTY_PREVIEW_CONTEXT['empresa.cif']).toBeTruthy();
        expect(EMPTY_PREVIEW_CONTEXT['fechaActual']).toBeTruthy();
    });
});
