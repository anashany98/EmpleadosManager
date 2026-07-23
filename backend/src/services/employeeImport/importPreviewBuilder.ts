import {
    IMPORT_FIELDS,
    FIELD_MAP,
    PREVIEW_ROW_LIMIT,
    EmployeeImportFieldKey,
    ImportFieldDefinition,
    ParsedImportFile,
    FieldSuggestion,
    ImportOptions,
    ImportPreviewRow
} from './importTypes';
import {
    collectSampleValues,
    isLikelyEmail,
    isLikelyPhone,
    isLikelyDni,
    parseDate,
    parseMoney,
    parseBool,
    formatPreviewDate
} from './valueParsers';
import { normalizeString } from './csvParser';

export function getMappedRawValue(
    row: Record<string, any>,
    mapping: Partial<Record<EmployeeImportFieldKey, string>>,
    fieldKey: EmployeeImportFieldKey
): any {
    const header = mapping[fieldKey];
    return header ? row[header] : undefined;
}

export function getMappedString(
    row: Record<string, any>,
    mapping: Partial<Record<EmployeeImportFieldKey, string>>,
    fieldKey: EmployeeImportFieldKey
): string {
    const raw = getMappedRawValue(row, mapping, fieldKey);
    if (raw === null || raw === undefined) return '';
    return String(raw).replace(/\s+/g, ' ').trim();
}

export function formatPreviewFieldValue(field: ImportFieldDefinition, rawValue: any): string {
    if (rawValue === null || rawValue === undefined || rawValue === '') return '';

    if (field.valueType === 'date') {
        const parsed = parseDate(rawValue);
        return parsed ? formatPreviewDate(parsed) : String(rawValue).replace(/\s+/g, ' ').trim();
    }

    if (field.valueType === 'money') {
        const parsed = parseMoney(rawValue);
        return parsed === null ? String(rawValue).replace(/\s+/g, ' ').trim() : String(parsed);
    }

    if (field.valueType === 'boolean') {
        return parseBool(rawValue) ? 'Si' : 'No';
    }

    return String(rawValue).replace(/\s+/g, ' ').trim();
}

export function buildPreviewRowWarnings(
    row: Record<string, any>,
    rowNumber: number,
    mapping: Partial<Record<EmployeeImportFieldKey, string>>
): string[] {
    const warnings: string[] = [];
    const dni = getMappedString(row, mapping, 'dni');
    const fullName = getMappedString(row, mapping, 'fullName') || [
        getMappedString(row, mapping, 'firstName'),
        getMappedString(row, mapping, 'lastName')
    ].filter(Boolean).join(' ');

    if (!dni) warnings.push(`Fila ${rowNumber}: falta DNI / NIE.`);
    else if (!isLikelyDni(dni)) warnings.push(`Fila ${rowNumber}: el DNI / NIE parece invalido.`);

    if (!fullName) warnings.push(`Fila ${rowNumber}: falta nombre.`);

    for (const field of IMPORT_FIELDS) {
        const rawValue = getMappedRawValue(row, mapping, field.key);
        const textValue = String(rawValue || '').replace(/\s+/g, ' ').trim();
        if (!textValue) continue;

        if (field.valueType === 'date' && !parseDate(rawValue)) {
            warnings.push(`Fila ${rowNumber}: ${field.label} no tiene una fecha valida.`);
        }

        if (field.valueType === 'money' && parseMoney(rawValue) === null) {
            warnings.push(`Fila ${rowNumber}: ${field.label} no es numerico.`);
        }

        if (field.valueType === 'email' && !isLikelyEmail(textValue)) {
            warnings.push(`Fila ${rowNumber}: ${field.label} no parece un email valido.`);
        }

        if (field.valueType === 'phone' && !isLikelyPhone(textValue)) {
            warnings.push(`Fila ${rowNumber}: ${field.label} no parece un telefono valido.`);
        }

        if (field.key === 'managerId' && textValue) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(textValue)) {
                warnings.push(`Fila ${rowNumber}: el responsable no es un ID valido, se ignorara al importar.`);
            }
        }
    }

    return warnings;
}

export function buildPreviewRows(
    rows: Record<string, any>[],
    mapping: Partial<Record<EmployeeImportFieldKey, string>>
): ImportPreviewRow[] {
    const mappedFields = IMPORT_FIELDS.filter((field) => !!mapping[field.key]);

    return rows.slice(0, PREVIEW_ROW_LIMIT).map((row, index) => {
        const mapped: Partial<Record<EmployeeImportFieldKey, string>> = {};
        mappedFields.forEach((field) => {
            const rawValue = getMappedRawValue(row, mapping, field.key);
            const formatted = formatPreviewFieldValue(field, rawValue);
            if (formatted) {
                mapped[field.key] = formatted;
            }
        });

        return {
            rowNumber: index + 2,
            mapped,
            warnings: buildPreviewRowWarnings(row, index + 2, mapping)
        };
    });
}

export function buildPreviewWarnings(
    parsed: ParsedImportFile,
    mapping: Partial<Record<EmployeeImportFieldKey, string>>,
    previewRows: ImportPreviewRow[],
    suggestions: FieldSuggestion[],
    options: ImportOptions
): string[] {
    const warnings: string[] = [];
    const mappedHeaders = new Set(Object.values(mapping));
    const suggestedMap = new Map(suggestions.map((suggestion) => [suggestion.fieldKey, suggestion]));

    if (!mapping.dni) {
        warnings.push('No se ha asignado la columna de DNI / NIE. Sin ella no se puede importar.');
    }

    if (!mapping.fullName && !mapping.firstName) {
        warnings.push('No se ha asignado ninguna columna de nombre.');
    }

    suggestions.forEach((suggestion) => {
        if (suggestion.confidence === 'low' && mapping[suggestion.fieldKey] === suggestion.header) {
            const field = FIELD_MAP.get(suggestion.fieldKey);
            warnings.push(`Revisa ${field?.label || suggestion.fieldKey}: la deteccion automatica es baja.`);
        }
    });

    if (mapping.companyName && options.forceCompanyId) {
        warnings.push('La empresa viene fija por el usuario actual; la columna Empresa se ignorara al confirmar.');
    }

    if (parsed.meta.encoding) {
        warnings.push(`Archivo ${parsed.source.toUpperCase()} detectado con codificacion ${parsed.meta.encoding}.`);
    }

    if (parsed.meta.delimiter) {
        warnings.push(`Separador CSV detectado: ${parsed.meta.delimiter}.`);
    }

    const rowsWithWarnings = previewRows.filter((row) => row.warnings.length > 0).length;
    if (rowsWithWarnings > 0) {
        warnings.push(`${rowsWithWarnings} fila(s) de la previsualizacion tienen avisos.`);
    }

    const unmappedHeaders = parsed.headers.filter((header) => !mappedHeaders.has(header));
    if (unmappedHeaders.length > 0) {
        warnings.push(`${unmappedHeaders.length} columna(s) del archivo aun no se usan en la importacion.`);
    }

    if (mapping.dni) {
        const dniSuggestion = suggestedMap.get('dni');
        if (!dniSuggestion) {
            warnings.push('La columna de DNI se ha asignado manualmente. Conviene revisar la vista previa antes de confirmar.');
        }
    }

    return warnings;
}

export function isExampleRow(dni: string, fullName: string, privateNotes: string = ''): boolean {
    const normalizedDni = normalizeString(dni);
    const normalizedName = normalizeString(fullName);
    const normalizedNotes = normalizeString(privateNotes);

    const placeholderDnis = new Set([
        '12345678A', '87654321B', 'X0000000A', '00000000A',
        '11111111A', '99999999A', 'X1234567A'
    ]);
    if (placeholderDnis.has(dni.toUpperCase())) return true;
    if (/\d{6,}/.test(dni.replace(/\D/g, '')) && /^[A-Z]?0{4,}/i.test(dni)) return true;

    return normalizedDni.includes('ejemplo')
        || normalizedName.includes('ejemplo')
        || normalizedNotes.includes('ejemplo');
}
