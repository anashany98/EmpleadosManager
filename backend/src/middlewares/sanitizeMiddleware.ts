import { Request, Response, NextFunction } from 'express';
import { sanitizeText } from '../utils/sanitize';

/**
 * Middleware que sanitiza todos los campos de texto en req.body
 * para prevenir XSS almacenado.
 *
 * Solo sanitiza strings. No toca números, booleanos, arrays u objetos.
 * Los arrays y objetos se recorren recursivamente.
 */
function sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
        return sanitizeText(value);
    }

    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }

    if (value && typeof value === 'object') {
        return sanitizeObject(value as Record<string, unknown>);
    }

    return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeValue(value);
    }
    return sanitized;
}

/**
 * Sanitiza req.body para prevenir XSS en campos de texto libre.
 * Se aplica a POST, PUT, PATCH requests.
 */
export function sanitizeBodyMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const method = req.method.toUpperCase();

    if (['POST', 'PUT', 'PATCH'].includes(method) && req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }

    next();
}
