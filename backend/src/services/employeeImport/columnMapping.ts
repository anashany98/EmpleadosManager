import { normalizeString, compactNormalize } from './csvParser';
import {
    IMPORT_FIELDS,
    FIELD_MAP,
    EmployeeImportFieldKey,
    ImportFieldDefinition,
    ParsedImportFile,
    FieldSuggestion,
    MatchConfidence
} from './importTypes';
import {
    collectSampleValues,
    isLikelyEmail,
    isLikelyPhone,
    isLikelyDni,
    parseDate,
    parseMoney
} from './valueParsers';

export function detectValueBonus(field: ImportFieldDefinition, sampleValues: string[]): number {
    if (sampleValues.length === 0) return 0;
    const matchCount = sampleValues.filter((value) => {
        if (field.valueType === 'email') return isLikelyEmail(value);
        if (field.valueType === 'phone') return isLikelyPhone(value);
        if (field.valueType === 'dni') return isLikelyDni(value);
        if (field.valueType === 'date') return !!parseDate(value);
        if (field.valueType === 'money') return parseMoney(value) !== null;
        if (field.valueType === 'boolean') return ['si', 'no', 'yes', 'true', 'false', '1', '0'].includes(normalizeString(value));
        return false;
    }).length;

    const ratio = matchCount / sampleValues.length;
    if (ratio >= 1) return 25;
    if (ratio >= 0.66) return 16;
    if (ratio >= 0.33) return 8;
    return 0;
}

export function scoreFieldAgainstHeader(
    field: ImportFieldDefinition,
    header: string,
    sampleValues: string[],
    context: { hasLastNameHeader: boolean }
): { score: number; reason: string } {
    const normalizedHeader = normalizeString(header);
    const compactHeader = compactNormalize(header);

    let bestAliasScore = 0;
    let bestAlias = '';

    for (const alias of field.aliases) {
        const normalizedAlias = normalizeString(alias);
        const compactAlias = compactNormalize(alias);

        if (!normalizedAlias) continue;

        let score = 0;
        if (normalizedHeader === normalizedAlias || compactHeader === compactAlias) {
            score = 85;
        } else if (normalizedHeader.includes(normalizedAlias) || normalizedAlias.includes(normalizedHeader)) {
            score = 70;
        } else {
            const headerTokens = new Set(normalizedHeader.split(' ').filter(Boolean));
            const aliasTokens = normalizedAlias.split(' ').filter(Boolean);
            const overlap = aliasTokens.filter((token) => headerTokens.has(token)).length;
            if (overlap > 0) {
                score = 48 + overlap * 8;
            }
        }

        if (score > bestAliasScore) {
            bestAliasScore = score;
            bestAlias = alias;
        }
    }

    if (field.key === 'fullName' && normalizedHeader === 'nombre' && context.hasLastNameHeader) {
        bestAliasScore -= 18;
    }

    if (field.key === 'firstName' && normalizedHeader === 'nombre' && !context.hasLastNameHeader) {
        bestAliasScore -= 18;
    }

    if (field.key === 'phone' && ['movil', 'móvil'].includes(normalizedHeader)) {
        bestAliasScore += 10;
    }

    if (field.key === 'companyPhone' && ['movil', 'móvil', 'telefono', 'teléfono'].includes(normalizedHeader)) {
        bestAliasScore -= 10;
    }

    if (field.key === 'companyName' && normalizedHeader === 'empresa') {
        bestAliasScore += 12;
    }

    const valueBonus = detectValueBonus(field, sampleValues);
    const finalScore = bestAliasScore + valueBonus;
    const reason = bestAliasScore > 0
        ? `Coincide con "${bestAlias}"`
        : valueBonus > 0
            ? 'Detectado por el tipo de dato'
            : '';

    return { score: finalScore, reason };
}

export function buildSuggestions(parsed: ParsedImportFile): FieldSuggestion[] {
    const headerSamples = new Map(parsed.headers.map((header) => [header, collectSampleValues(parsed.rows, header)]));
    const hasLastNameHeader = parsed.headers.some((header) => {
        const normalized = normalizeString(header);
        return normalized === 'apellido' || normalized === 'apellidos';
    });

    const candidates: Array<{
        fieldKey: EmployeeImportFieldKey;
        header: string;
        score: number;
        reason: string;
    }> = [];

    for (const field of IMPORT_FIELDS) {
        for (const header of parsed.headers) {
            const { score, reason } = scoreFieldAgainstHeader(field, header, headerSamples.get(header) || [], { hasLastNameHeader });
            if (score >= 52) {
                candidates.push({ fieldKey: field.key, header, score, reason });
            }
        }
    }

    candidates.sort((left, right) => right.score - left.score);

    const assignedFields = new Set<EmployeeImportFieldKey>();
    const assignedHeaders = new Set<string>();
    const suggestions: FieldSuggestion[] = [];

    for (const candidate of candidates) {
        if (assignedFields.has(candidate.fieldKey) || assignedHeaders.has(candidate.header)) continue;

        assignedFields.add(candidate.fieldKey);
        assignedHeaders.add(candidate.header);

        const confidence: MatchConfidence = candidate.score >= 88
            ? 'high'
            : candidate.score >= 70
                ? 'medium'
                : 'low';

        suggestions.push({
            fieldKey: candidate.fieldKey,
            header: candidate.header,
            confidence,
            score: candidate.score,
            reason: candidate.reason || 'Coincidencia aproximada'
        });
    }

    return suggestions.sort((left, right) => IMPORT_FIELDS.findIndex((field) => field.key === left.fieldKey) - IMPORT_FIELDS.findIndex((field) => field.key === right.fieldKey));
}

export function sanitizeMapping(
    providedMapping: Partial<Record<EmployeeImportFieldKey, string>> | undefined,
    headers: string[]
): Partial<Record<EmployeeImportFieldKey, string>> {
    if (!providedMapping) return {};

    const headerLookup = new Map<string, string>();
    for (const header of headers) {
        headerLookup.set(normalizeString(header), header);
    }

    const sanitized: Partial<Record<EmployeeImportFieldKey, string>> = {};

    for (const [fieldKey, header] of Object.entries(providedMapping)) {
        if (!FIELD_MAP.has(fieldKey as EmployeeImportFieldKey)) continue;
        if (!header) continue;
        const canonicalHeader = headerLookup.get(normalizeString(header));
        if (!canonicalHeader) continue;
        sanitized[fieldKey as EmployeeImportFieldKey] = canonicalHeader;
    }

    return sanitized;
}

export function buildCurrentMapping(
    parsed: ParsedImportFile,
    providedMapping?: Partial<Record<EmployeeImportFieldKey, string>>
): {
    currentMapping: Partial<Record<EmployeeImportFieldKey, string>>;
    suggestions: FieldSuggestion[];
} {
    const suggestions = buildSuggestions(parsed);

    if (providedMapping !== undefined) {
        return {
            currentMapping: sanitizeMapping(providedMapping, parsed.headers),
            suggestions
        };
    }

    const currentMapping: Partial<Record<EmployeeImportFieldKey, string>> = {};
    suggestions.forEach((suggestion) => {
        currentMapping[suggestion.fieldKey] = suggestion.header;
    });

    return { currentMapping, suggestions };
}
