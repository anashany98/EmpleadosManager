import { AVAILABLE_VARIABLES } from './templateBases';

const VARIABLE_PATTERN = /\{\{\s*([\w.\-]+)\s*\}\}/g;

const matchVariables = (content: string): RegExpExecArray[] => {
    const pattern = new RegExp(VARIABLE_PATTERN.source, 'g');
    const matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
        matches.push(match);
    }
    return matches;
};

/**
 * Resolves `{{dot.path}}` placeholders against a context object.
 *
 * Behaviour matches the existing renderer in `templateBases.ts` and
 * `CanvaEditor.tsx`: missing values render as the literal `{{path}}` so
 * editors immediately spot broken references.
 */
export function resolveTemplateContent(
    content: string,
    context: Record<string, unknown>
): string {
    if (!content) return '';
    const matches = matchVariables(content);
    if (matches.length === 0) return content;

    const lookup = (key: string): unknown => {
        // 1) Try the flat key exactly as written (`empleado.nombreCompleto`).
        if (Object.prototype.hasOwnProperty.call(context, key)) {
            return context[key];
        }
        // 2) Walk nested path (`empleado.nombreCompleto` -> context.empleado.nombreCompleto).
        const segments = key.split('.');
        let current: unknown = context;
        for (const segment of segments) {
            if (current && typeof current === 'object') {
                current = (current as Record<string, unknown>)[segment];
            } else {
                return undefined;
            }
        }
        return current;
    };

    let result = '';
    let cursor = 0;
    for (const match of matches) {
        result += content.slice(cursor, match.index);
        const key = match[1];
        const value = lookup(key);
        if (value !== undefined && value !== null) {
            result += String(value);
        } else {
            result += `{{${key}}}`;
        }
        cursor = match.index + match[0].length;
    }
    result += content.slice(cursor);
    return result;
}

/**
 * Returns the list of variables referenced in a template content string.
 * Each entry is the raw `dot.path` (without the curly braces).
 */
export function extractTemplateVariables(content: string): string[] {
    if (!content) return [];
    const matches = matchVariables(content);
    const unique = new Set<string>();
    matches.forEach((match) => unique.add(match[1]));
    return Array.from(unique);
}

/**
 * Splits the variables referenced in `content` into known and unknown,
 * so the UI can highlight broken references without breaking the render.
 */
export function partitionVariables(content: string): {
    known: string[];
    unknown: string[];
} {
    const all = extractTemplateVariables(content);
    const known: string[] = [];
    const unknown: string[] = [];
    all.forEach((variable) => {
        if ((AVAILABLE_VARIABLES as readonly string[]).includes(variable)) {
            known.push(variable);
        } else {
            unknown.push(variable);
        }
    });
    return { known, unknown };
}

export function isKnownVariable(variable: string): boolean {
    return (AVAILABLE_VARIABLES as readonly string[]).includes(variable);
}

/**
 * Stable context used by the editor preview when the user has not yet
 * picked an employee. Values are intentionally obvious placeholders so
 * the editor can spot what is and is not bound.
 */
export const EMPTY_PREVIEW_CONTEXT: Record<string, string> = {
    'empleado.nombreCompleto': 'Nombre Apellido Apellido',
    'empleado.nombre': 'Nombre',
    'empleado.apellidos': 'Apellido Apellido',
    'empleado.dni': '00000000A',
    'empleado.email': 'empleado@empresa.test',
    'empleado.telefono': '+34 600 000 000',
    'empleado.direccion': 'Calle Ejemplo 1',
    'empleado.puesto': 'Puesto de trabajo',
    'empleado.fechaAlta': '2024-01-01',
    'empleado.tipoContrato': 'Indefinido',
    'empleado.nss': '00 0000000000',
    'empleado.iban': 'ES00 0000 0000 0000 0000 0000',
    'empleado.salarioBrutoAnual': '24.000,00 €',
    'empleado.salarioBrutoMensual': '2.000,00 €',
    'empresa.nombre': 'Empresa Demo S.L.',
    'empresa.cif': 'B12345678',
    'empresa.representanteLegal': 'Representante Legal',
    'empresa.direccion': 'Calle Empresa 1, 28001 Madrid',
    'empresa.codigoPostal': '28001',
    'empresa.ciudad': 'Madrid',
    'empresa.provincia': 'Madrid',
    'empresa.email': 'rrhh@empresa.test',
    'empresa.telefono': '+34 910 000 000',
    'firma.ciudad': 'Madrid',
    'firma.fecha': new Date().toLocaleDateString('es-ES'),
    'firma.autorizante': 'Director/a de RRHH',
    'fechaActual': new Date().toLocaleDateString('es-ES')
};
