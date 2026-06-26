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

export function resolveTemplateContent(content: string, context: Record<string, unknown>): string {
    if (!content) return '';
    const matches = matchVariables(content);
    if (matches.length === 0) return content;

    const lookup = (key: string): unknown => {
        if (Object.prototype.hasOwnProperty.call(context, key)) return context[key];
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
        const value = lookup(match[1]);
        result += (value !== undefined && value !== null) ? String(value) : `{{${match[1]}}}`;
        cursor = match.index + match[0].length;
    }
    return result + content.slice(cursor);
}

export function extractTemplateVariables(content: string): string[] {
    if (!content) return [];
    const matches = matchVariables(content);
    const unique = new Set<string>();
    matches.forEach((match) => unique.add(match[1]));
    return Array.from(unique);
}

export function partitionVariables(content: string): { known: string[]; unknown: string[] } {
    const all = extractTemplateVariables(content);
    const known: string[] = [];
    const unknown: string[] = [];
    all.forEach((v) => {
        if ((AVAILABLE_VARIABLES as readonly string[]).includes(v)) known.push(v);
        else unknown.push(v);
    });
    return { known, unknown };
}

export function isKnownVariable(variable: string): boolean {
    return (AVAILABLE_VARIABLES as readonly string[]).includes(variable);
}

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
    'empleado.salarioBrutoAnual': '24.000,00 EUR',
    'empleado.salarioBrutoMensual': '2.000,00 EUR',
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
