import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { TimeEntryIdempotencyService } from '../services/TimeEntryIdempotencyService';
import { RedisRateLimiter } from '../services/RedisRateLimiter';
import { resolveAuthorizedCompanyId } from '../utils/companyAccess';
import type { AuthenticatedRequest } from '../types/express';

const PIN_ATTEMPT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const PIN_ATTEMPT_LIMIT = 5;
const CLOCK_REQUEST_TTL_SECONDS = 15 * 60; // 15 minutes

function getRequesterIp(req: Request): string {
    // ALT-1: NO leer el header X-Forwarded-For crudo — la entrada de la
    // izquierda la puede inventar el cliente y se evadiría el rate-limit
    // de intentos de PIN (5 por IP+empleado). Con `trust proxy = 1`,
    // Express ya calcula `req.ip` correctamente.
    return req.ip || 'unknown';
}

function getPinAttemptKey(employeeId: string, ip: string): string {
    return `kiosk:pin:${employeeId}:${ip}`;
}

async function assertPinAttemptAllowed(employeeId: string, ip: string): Promise<void> {
    const result = await RedisRateLimiter.hit(
        getPinAttemptKey(employeeId, ip),
        PIN_ATTEMPT_LIMIT,
        PIN_ATTEMPT_WINDOW_SECONDS
    );
    if (!result.allowed) {
        throw new AppError(
            `Too many failed PIN attempts. Try again in ${result.retryAfterSeconds} seconds.`,
            429
        );
    }
}

async function clearPinAttempts(employeeId: string, ip: string): Promise<void> {
    await RedisRateLimiter.reset(getPinAttemptKey(employeeId, ip));
}

function parseClockTimestamp(value: string | undefined): Date {
    if (!value) {
        return new Date();
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new AppError('Invalid kiosk timestamp', 400);
    }
    const now = Date.now();
    if (date.getTime() > now + 5 * 60 * 1000) {
        throw new AppError('Future kiosk timestamps are not allowed', 400);
    }
    if (now - date.getTime() > 60 * 60 * 1000) {
        throw new AppError('Kiosk timestamps older than 1 hour are not allowed', 400);
    }
    return date;
}

async function findProcessedClockEntry(clientRequestId?: string) {
    if (!clientRequestId) {
        return null;
    }
    const dedupeKey = `kiosk:clock:${clientRequestId}`;
    const { firstTime, existing } = await RedisRateLimiter.dedupe(dedupeKey, CLOCK_REQUEST_TTL_SECONDS);
    if (firstTime) {
        return null;
    }
    // We had this request before. Try to find the persisted entry.
    if (existing && existing !== '1') {
        const existingEntry = await prisma.timeEntry.findUnique({ where: { id: existing } });
        if (existingEntry) {
            return existingEntry;
        }
    }
    return null;
}

async function rememberProcessedClockRequest(clientRequestId: string | undefined, entryId: string): Promise<void> {
    if (!clientRequestId) {
        return;
    }
    const dedupeKey = `kiosk:clock:${clientRequestId}`;
    // Set the dedupe key with the entry id as value so subsequent calls
    // can locate the existing row. We bypass the `dedupe` helper because
    // we already have a specific value to store.
    const { redis } = await import('../config/redis');
    await redis.set(`dedupe:${dedupeKey}`, entryId, 'EX', CLOCK_REQUEST_TTL_SECONDS);
}

export const KioskController = {
    authenticateKiosk: async (req: Request, res: Response) => {
        const { secret } = req.body;
        const configuredSecret = process.env.KIOSK_DEVICE_SECRET || process.env.KIOSK_SECRET;
        if (configuredSecret) {
            const provided = typeof secret === 'string' ? secret : '';
            const bufA = Buffer.from(provided);
            const bufB = Buffer.from(configuredSecret);
            const sameLength = bufA.length === bufB.length;
            if (!sameLength || !crypto.timingSafeEqual(bufA, bufB)) {
                throw new AppError('Kiosk Unauthorized', 401);
            }
        }
        return ApiResponse.success(res, { status: 'authorized' });
    },

    clockIn: async (req: Request, res: Response) => {
        const { employeeId, pin, latitude, longitude, timestamp, clientRequestId } = req.body;
        const requestIp = getRequesterIp(req);
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true }
        });

        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        // Pre-check (counter is incremented on every attempt; we only
        // roll it back if the PIN is valid, see `clearPinAttempts`).
        await assertPinAttemptAllowed(employeeId, requestIp);

        if (!pin) {
            throw new AppError('PIN requerido', 400);
        }

        const user = await prisma.user.findFirst({
            where: { employeeId },
            select: { id: true, password: true }
        });

        if (!user) {
            throw new AppError('PIN not set up', 400);
        }

        const valid = await bcrypt.compare(pin, user.password);
        if (!valid) {
            throw new AppError('Invalid PIN', 401);
        }

        // PIN OK: clear the counter so a single bad attempt followed by
        // a good one does not lock the user out for the full window.
        await clearPinAttempts(employeeId, requestIp);

        const effectiveTimestamp = parseClockTimestamp(timestamp);
        const cachedEntry = await findProcessedClockEntry(clientRequestId);
        if (cachedEntry) {
            await rememberProcessedClockRequest(clientRequestId, cachedEntry.id);
            return ApiResponse.success(
                res,
                { entry: cachedEntry, deduplicated: true, dedupedBy: 'clientRequestId' },
                `Clocked ${cachedEntry.type} successfully`
            );
        }

        const lastEntry = await prisma.timeEntry.findFirst({
            where: { employeeId },
            orderBy: { timestamp: 'desc' }
        });

        const type = (!lastEntry || lastEntry.type === 'OUT' || lastEntry.type === 'LUNCH_START' || lastEntry.type === 'BREAK_START')
            ? 'IN'
            : 'OUT';

        const result = await TimeEntryIdempotencyService.create({
            employeeId,
            type,
            timestamp: effectiveTimestamp,
            location: 'Kiosk',
            device: 'Tablet Kiosk (pin)',
            latitude,
            longitude,
            clientRequestId
        });

        await rememberProcessedClockRequest(clientRequestId, result.entry.id);

        return ApiResponse.success(
            res,
            {
                entry: result.entry,
                deduplicated: result.deduplicated,
                dedupedBy: result.dedupedBy
            },
            `Clocked ${result.entry.type} successfully`
        );
    },

    getKioskActivity: async (req: Request, res: Response) => {
        // MED-2: acotar por empresa. `resolveAuthorizedCompanyId` es la
        // variante estricta: para usuarios con empresa devuelve SU companyId
        // (el query param solo lo puede usar un admin global) y lanza 403
        // si un usuario sin empresa intenta acceder.
        const { user } = req as AuthenticatedRequest;
        const companyId = resolveAuthorizedCompanyId(user, req.query.companyId as string | undefined);

        const activity = await prisma.timeEntry.findMany({
            where: {
                device: {
                    startsWith: 'Tablet Kiosk'
                },
                ...(companyId ? { employee: { companyId } } : {})
            },
            take: 10,
            orderBy: { timestamp: 'desc' },
            include: {
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                        name: true
                    }
                }
            }
        });

        const formatted = activity.map((entry) => ({
            id: entry.id,
            employeeName: (entry.employee.firstName && entry.employee.lastName)
                ? `${entry.employee.firstName} ${entry.employee.lastName}`
                : (entry.employee.name || 'Empleado'),
            type: entry.type,
            timestamp: entry.timestamp,
            method: 'PIN'
        }));

        return ApiResponse.success(res, formatted);
    }
};
