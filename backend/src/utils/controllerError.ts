import { Prisma } from '@prisma/client';
import { Response } from 'express';
import crypto from 'crypto';
import { ZodError } from 'zod';
import { AppError } from './AppError';
import { ApiResponse } from './ApiResponse';
import { createLogger } from '../services/LoggerService';

const log = createLogger('ControllerError');

const IS_PRODUCTION = (): boolean => process.env.NODE_ENV === 'production';

export interface HandleControllerErrorOptions {
    /**
     * If true (default), expose the raw `error.message` in
     * NON-production environments for easier debugging. Set to
     * `false` to always censor (e.g. for demos to clients).
     */
    exposeMessageInDev?: boolean;
    /**
     * Override the generated correlation ID. Useful when the
     * caller already has a request ID (e.g. from middleware).
     */
    correlationId?: string;
}

/**
 * Centralized error handler for controllers. Replaces the
 * `catch (error) { return ApiResponse.error(res, error.message || 'fallback', 500); }`
 * pattern that was leaking Prisma error messages, file paths, and
 * stack details in 5xx responses.
 *
 * Behavior:
 *
 * - `AppError`: passes through with its own `message` and
 *   `statusCode`. `AppError` is the explicit contract for
 *   "I checked and this is a user-facing error", so its
 *   message is always safe to expose.
 *
 * - `ZodError` (schema validation): returns 400 with the
 *   field-level issues, matching `validateResource`. Keeps
 *   client validation errors from surfacing as 5xx (which
 *   also triggered client-side retries).
 *
 * - `Prisma.PrismaClientKnownRequestError` P2002 (unique
 *   constraint): returns 400 with a generic "duplicate" message.
 *   We deliberately do NOT include the constraint fields/columns
 *   because they leak schema details.
 *
 * - All other errors:
 *   - In production: returns the `fallback` message and a
 *     correlation ID. The full error is logged server-side so
 *     support can find it by correlation ID.
 *   - In development: returns the `error.message` for easier
 *     debugging (unless the caller opts out).
 *
 * - Correlation ID: generated UUID, returned in the response
 *   body (`correlationId`) and as the `X-Request-Id` header. The
 *   user can quote this when reporting an issue and the
 *   support team can grep the logs.
 *
 * Usage:
 *
 *   try {
 *       ...
 *   } catch (error) {
 *       return handleControllerError(res, error, 'Error al hacer X');
 *   }
 */
export function handleControllerError(
    res: Response,
    error: unknown,
    fallback: string,
    options: HandleControllerErrorOptions = {}
): Response {
    const correlationId = options.correlationId ?? crypto.randomUUID();
    const exposeInDev = options.exposeMessageInDev !== false; // default true

    // AppError: passthrough (its message is safe by contract).
    if (error instanceof AppError) {
        res.setHeader('X-Request-Id', correlationId);
        return ApiResponse.error(res, error.message, error.statusCode, null, correlationId);
    }

    // ZodError (validación de schemas): es un error del cliente, no del
    // servidor. Antes terminaba como 500 cuando un controller hacía
    // `.parse()` inline (p. ej. el guardado del control horario), lo que
    // además disparaba los reintentos del cliente. Se devuelve 400 con el
    // detalle de campos, igual que el middleware validateResource.
    if (error instanceof ZodError) {
        res.setHeader('X-Request-Id', correlationId);
        return ApiResponse.error(res, 'Error de validación', 400, error.errors, correlationId);
    }

    // Prisma unique constraint: translate to 400 with a generic
    // message. Don't expose the constraint fields.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        log.warn({ err: error, correlationId }, 'Prisma unique constraint violation');
        res.setHeader('X-Request-Id', correlationId);
        return ApiResponse.error(res, 'Ya existe un registro con esos datos únicos.', 400, null, correlationId);
    }

    // Everything else: log full server-side, expose generic
    // message to client.
    log.error(
        { err: error, fallback, correlationId },
        'Unexpected error in controller catch block'
    );

    // Best-effort status code detection: some errors (custom
    // Error subclasses) carry a `statusCode` property. We treat
    // any status >= 500 the same way (censor). 4xx non-AppError
    // is rare (callers should use AppError) but we still
    // prefer the fallback over leaking the raw message.
    const statusCode = isStatusCodeError(error)
        ? (error as { statusCode: number }).statusCode
        : 500;

    // En producción: SIEMPRE censurar (ni siquiera el correlation
    // ID; ya está en el header y en el body para reporte).
    // En dev: exponer el raw message para debugging, salvo que
    // el caller explícitamente pida censurar (exposeMessageInDev: false).
    const message = (!IS_PRODUCTION() && exposeInDev && error instanceof Error)
        ? error.message
        : fallback;

    res.setHeader('X-Request-Id', correlationId);
    return ApiResponse.error(res, message, statusCode, null, correlationId);
}

function isStatusCodeError(error: unknown): error is { statusCode: number } {
    return (
        typeof error === 'object'
        && error !== null
        && 'statusCode' in error
        && typeof (error as { statusCode: unknown }).statusCode === 'number'
    );
}
