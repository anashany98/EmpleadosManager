/**
 * Sanitiza un string para prevenir XSS almacenado.
 * Elimina tags HTML, event handlers, y URLs peligrosas.
 * NO elimina caracteres especiales del español (ñ, á, é, etc.)
 */
export function sanitizeText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return String(value).trim() || null;

    let sanitized = value.trim();
    if (!sanitized) return null;

    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Remove event handlers (onclick, onload, onerror, etc.)
    sanitized = sanitized.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/\bon\w+\s*=\s*[^\s>]*/gi, '');

    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript\s*:/gi, '');

    // Remove data: protocol (can be used for XSS)
    sanitized = sanitized.replace(/data\s*:/gi, '');

    // Remove vbscript: protocol
    sanitized = sanitized.replace(/vbscript\s*:/gi, '');

    // Decode HTML entities that might have been used to bypass filters
    sanitized = sanitized
        .replace(/&lt;/g, '')
        .replace(/&gt;/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');

    // Remove any remaining HTML tags after entity decoding
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    return sanitized.trim() || null;
}

/**
 * Sanitiza un objeto de texto libre antes de guardar en BD.
 * Aplica sanitizeText a todos los campos de string del objeto.
 */
export function sanitizeTextFields<T extends Record<string, any>>(
    obj: T,
    fields: (keyof T)[]
): T {
    const result = { ...obj };
    for (const field of fields) {
        if (typeof result[field] === 'string') {
            result[field] = sanitizeText(result[field]) as any;
        }
    }
    return result;
}
