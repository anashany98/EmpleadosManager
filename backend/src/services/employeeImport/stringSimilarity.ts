import { compactNormalize, normalizeString, cleanText } from './csvParser';
import { uniqueValues } from './valueParsers';

export function toBigrams(value: string): string[] {
    const normalized = compactNormalize(value);
    if (normalized.length < 2) return normalized ? [normalized] : [];

    const grams: string[] = [];
    for (let index = 0; index < normalized.length - 1; index += 1) {
        grams.push(normalized.slice(index, index + 2));
    }
    return grams;
}

export function diceCoefficient(left: string, right: string): number {
    if (!left || !right) return 0;
    if (left === right) return 1;

    const leftBigrams = toBigrams(left);
    const rightBigrams = toBigrams(right);

    if (leftBigrams.length === 0 || rightBigrams.length === 0) return 0;

    const rightPool = [...rightBigrams];
    let matches = 0;

    leftBigrams.forEach((gram) => {
        const matchIndex = rightPool.indexOf(gram);
        if (matchIndex >= 0) {
            matches += 1;
            rightPool.splice(matchIndex, 1);
        }
    });

    return (2 * matches) / (leftBigrams.length + rightBigrams.length);
}

export function tokenOverlapScore(left: string, right: string): number {
    const leftTokens = normalizeString(left).split(' ').filter(Boolean);
    const rightTokens = normalizeString(right).split(' ').filter(Boolean);
    if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

    const rightSet = new Set(rightTokens);
    const matches = leftTokens.filter((token) => rightSet.has(token)).length;
    return matches / Math.max(leftTokens.length, rightTokens.length);
}

export function similarityScore(left: string, right: string): number {
    const normalizedLeft = normalizeString(left);
    const normalizedRight = normalizeString(right);
    if (!normalizedLeft || !normalizedRight) return 0;
    if (normalizedLeft === normalizedRight) return 1;
    if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return 0.94;
    return Math.max(diceCoefficient(normalizedLeft, normalizedRight), tokenOverlapScore(normalizedLeft, normalizedRight));
}

export function normalizeCompanyName(value: string): string {
    return normalizeString(value)
        .replace(/\bsociedad limitada unipersonal\b/g, ' ')
        .replace(/\bsociedad limitada nueva empresa\b/g, ' ')
        .replace(/\bsociedad limitada laboral\b/g, ' ')
        .replace(/\bsociedad limitada\b/g, ' ')
        .replace(/\bsociedad anonima\b/g, ' ')
        .replace(/\bsociedad cooperativa\b/g, ' ')
        .replace(/\bslu\b/g, ' ')
        .replace(/\bsll\b/g, ' ')
        .replace(/\bslne\b/g, ' ')
        .replace(/\bsl\b/g, ' ')
        .replace(/\bsa\b/g, ' ')
        .replace(/\bcoop\b/g, ' ')
        .replace(/\bsc\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function findBestExistingValue(rawValue: string, existingValues: string[], threshold: number): string | null {
    const cleanValue = cleanText(rawValue);
    if (!cleanValue || existingValues.length === 0) return null;

    const normalizedValue = normalizeString(cleanValue);
    const exact = existingValues.find((value) => normalizeString(value) === normalizedValue);
    if (exact) return exact;

    let bestMatch: string | null = null;
    let bestScore = 0;

    existingValues.forEach((candidate) => {
        const score = similarityScore(cleanValue, candidate);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = candidate;
        }
    });

    return bestScore >= threshold ? bestMatch : null;
}

export function createTextValueResolver(existingValues: string[], threshold: number) {
    const knownValues = uniqueValues(existingValues);

    return {
        resolve(rawValue: string): string {
            const cleanValue = cleanText(rawValue);
            if (!cleanValue) return '';

            const matched = findBestExistingValue(cleanValue, knownValues, threshold);
            if (matched) return matched;

            knownValues.push(cleanValue);
            return cleanValue;
        }
    };
}
