import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { TimeEntryIdempotencyService } from '../services/TimeEntryIdempotencyService';

const FACE_MATCH_THRESHOLD = 0.5;
const CACHE_TTL_MS = 5 * 60 * 1000;
const PIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const PIN_ATTEMPT_LIMIT = 5;
const CLOCK_REQUEST_TTL_MS = 15 * 60 * 1000;

type CachedDescriptor = {
    id: string;
    name: string | null;
    jobTitle: string | null;
    faceDescriptor: number[];
};

let cachedDescriptors: CachedDescriptor[] | null = null;
let lastCacheUpdate = 0;

const pinAttempts = new Map<string, { count: number; expiresAt: number }>();
const processedClockRequests = new Map<string, { entryId: string; expiresAt: number }>();

async function getFaceDescriptors() {
    const now = Date.now();
    if (cachedDescriptors && now - lastCacheUpdate < CACHE_TTL_MS) {
        return cachedDescriptors;
    }

    const employees = await prisma.employee.findMany({
        where: {
            active: true,
            faceDescriptor: { not: Prisma.DbNull }
        },
        select: {
            id: true,
            name: true,
            jobTitle: true,
            faceDescriptor: true
        }
    });

    cachedDescriptors = employees.map((employee) => ({
        id: employee.id,
        name: employee.name,
        jobTitle: employee.jobTitle,
        faceDescriptor: employee.faceDescriptor as unknown as number[]
    }));
    lastCacheUpdate = now;

    return cachedDescriptors;
}

function getEuclideanDistance(face1: number[], face2: number[]): number {
    if (face1.length !== face2.length) {
        return 1;
    }

    return Math.sqrt(
        face1
            .map((value, index) => value - face2[index])
            .reduce((sum, difference) => sum + difference * difference, 0)
    );
}

function cleanupExpiringMaps(): void {
    const now = Date.now();

    pinAttempts.forEach((value, key) => {
        if (value.expiresAt <= now) {
            pinAttempts.delete(key);
        }
    });

    processedClockRequests.forEach((value, key) => {
        if (value.expiresAt <= now) {
            processedClockRequests.delete(key);
        }
    });
}

function getRequesterIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
        return forwardedFor.split(',')[0].trim();
    }

    return req.ip || 'unknown';
}

function getPinAttemptKey(employeeId: string, ip: string): string {
    return `${employeeId}:${ip}`;
}

function assertPinAttemptAllowed(employeeId: string, ip: string): void {
    cleanupExpiringMaps();
    const attempt = pinAttempts.get(getPinAttemptKey(employeeId, ip));

    if (attempt && attempt.count >= PIN_ATTEMPT_LIMIT && attempt.expiresAt > Date.now()) {
        throw new AppError('Too many failed PIN attempts. Try again later.', 429);
    }
}

function recordFailedPinAttempt(employeeId: string, ip: string): void {
    const key = getPinAttemptKey(employeeId, ip);
    const current = pinAttempts.get(key);
    const expiresAt = Date.now() + PIN_ATTEMPT_WINDOW_MS;

    pinAttempts.set(key, {
        count: (current?.count || 0) + 1,
        expiresAt
    });
}

function clearPinAttempts(employeeId: string, ip: string): void {
    pinAttempts.delete(getPinAttemptKey(employeeId, ip));
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

    if (now - date.getTime() > 7 * 24 * 60 * 60 * 1000) {
        throw new AppError('Stale kiosk timestamps are not allowed', 400);
    }

    return date;
}

async function findProcessedClockEntry(clientRequestId?: string) {
    cleanupExpiringMaps();

    if (clientRequestId) {
        const processed = processedClockRequests.get(clientRequestId);
        if (processed && processed.expiresAt > Date.now()) {
            const existingEntry = await prisma.timeEntry.findUnique({
                where: { id: processed.entryId }
            });

            if (existingEntry) {
                return existingEntry;
            }
        }
    }

    return null;
}

function rememberProcessedClockRequest(clientRequestId: string | undefined, entryId: string): void {
    if (!clientRequestId) {
        return;
    }

    processedClockRequests.set(clientRequestId, {
        entryId,
        expiresAt: Date.now() + CLOCK_REQUEST_TTL_MS
    });
}

export const KioskController = {
    authenticateKiosk: async (req: Request, res: Response) => {
        const { secret } = req.body;
        const configuredSecret = process.env.KIOSK_DEVICE_SECRET || process.env.KIOSK_SECRET;
        if (configuredSecret && secret !== configuredSecret) {
            throw new AppError('Kiosk Unauthorized', 401);
        }

        return ApiResponse.success(res, { status: 'authorized' });
    },

    identifyEmployee: async (req: Request, res: Response) => {
        const { descriptor } = req.body;
        const employees = await getFaceDescriptors();

        let bestMatch: CachedDescriptor | null = null;
        let minDistance = 1;

        for (const employee of employees) {
            const distance = getEuclideanDistance(descriptor, employee.faceDescriptor);
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = employee;
            }
        }

        if (bestMatch && minDistance < FACE_MATCH_THRESHOLD) {
            return ApiResponse.success(res, {
                identified: true,
                employee: {
                    id: bestMatch.id,
                    name: bestMatch.name,
                    jobTitle: bestMatch.jobTitle,
                    distance: minDistance
                }
            });
        }

        return ApiResponse.success(res, { identified: false }, 'No match found');
    },

    enrollFace: async (req: Request, res: Response) => {
        const { employeeId, descriptor } = req.body;

        await prisma.employee.update({
            where: { id: employeeId },
            data: { faceDescriptor: descriptor }
        });

        cachedDescriptors = null;

        return ApiResponse.success(res, null, 'Face enrolled successfully');
    },

    clockIn: async (req: Request, res: Response) => {
        const { employeeId, method, pin, descriptor, latitude, longitude, timestamp, clientRequestId } = req.body;
        const requestIp = getRequesterIp(req);
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                kioskPin: true,
                faceDescriptor: true
            }
        });

        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        if (method === 'pin') {
            assertPinAttemptAllowed(employeeId, requestIp);

            if (!employee.kioskPin) {
                throw new AppError('PIN not set up', 400);
            }

            const valid = await bcrypt.compare(pin, employee.kioskPin);
            if (!valid) {
                recordFailedPinAttempt(employeeId, requestIp);
                throw new AppError('Invalid PIN', 401);
            }

            clearPinAttempts(employeeId, requestIp);
        }

        if (method === 'face') {
            if (!employee.faceDescriptor) {
                throw new AppError('Employee does not have a registered face', 400);
            }

            const storedDescriptor = employee.faceDescriptor as unknown as number[];
            const distance = getEuclideanDistance(descriptor, storedDescriptor);
            if (distance > FACE_MATCH_THRESHOLD) {
                throw new AppError('Face verification failed on server', 401);
            }
        }

        const effectiveTimestamp = parseClockTimestamp(timestamp);
        const cachedEntry = await findProcessedClockEntry(clientRequestId);
        if (cachedEntry) {
            rememberProcessedClockRequest(clientRequestId, cachedEntry.id);
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
            device: `Tablet Kiosk (${method})`,
            latitude,
            longitude,
            clientRequestId
        });

        rememberProcessedClockRequest(clientRequestId, result.entry.id);

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

    getKioskActivity: async (_req: Request, res: Response) => {
        const activity = await prisma.timeEntry.findMany({
            where: {
                device: {
                    startsWith: 'Tablet Kiosk'
                }
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
            method: entry.device?.includes('(face)') ? 'Face' : 'PIN'
        }));

        return ApiResponse.success(res, formatted);
    }
};
