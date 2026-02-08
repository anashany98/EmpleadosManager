import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import bcrypt from 'bcryptjs';

// Simple Euclidean distance for face descriptors (128-float array)
// Threshold is usually 0.6 for dlib/face-api, but 0.5 is safer.
const FACE_MATCH_THRESHOLD = 0.5;

// In-memory cache for face descriptors
let cachedDescriptors: { id: string, name: string | null, jobTitle: string | null, faceDescriptor: number[] }[] | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getFaceDescriptors() {
    const now = Date.now();
    if (cachedDescriptors && (now - lastCacheUpdate < CACHE_TTL)) {
        return cachedDescriptors;
    }

    const employees = await prisma.employee.findMany({
        where: {
            active: true,
            faceDescriptor: { not: Prisma.DbNull }
        },
        select: { id: true, name: true, faceDescriptor: true, jobTitle: true }
    });

    cachedDescriptors = employees.map(emp => ({
        id: emp.id,
        name: emp.name,
        jobTitle: emp.jobTitle,
        faceDescriptor: emp.faceDescriptor as unknown as number[]
    }));
    lastCacheUpdate = now;
    return cachedDescriptors;
}

function getEuclideanDistance(face1: number[], face2: number[]): number {
    if (face1.length !== face2.length) return 1.0;
    return Math.sqrt(
        face1
            .map((val, i) => val - face2[i])
            .reduce((sum, diff) => sum + diff * diff, 0)
    );
}

export const KioskController = {
    // Authenticate the Kiosk Device itself (optional, simple secret for now)
    // In production, use a dedicated token or client cert.
    authenticateKiosk: async (req: Request, res: Response) => {
        const { secret } = req.body;
        // Simple hardcoded check or env var
        if (secret !== process.env.KIOSK_SECRET) {
            throw new AppError('Kiosk Unauthorized', 401);
        }
        return ApiResponse.success(res, { status: 'authorized' });
    },

    // Get all minimal employee data (active only) to cache in Kiosk
    // This allows the kiosk to do recognition mostly offline or fast
    // BUT for security, we might want to send the descriptor to server.
    // Let's do Server-Side verification for security (Plan B in plan).
    // Plan A was "Client side". Let's support Server Side matching for "Smart Kiosk".
    // Actually, transmitting face descriptor is safer than downloading ALL IDs to the tablet.
    // So: Tablet sends descriptor -> Server finds match.
    identifyEmployee: async (req: Request, res: Response) => {
        const { descriptor } = req.body; // Array of numbers

        if (!descriptor || !Array.isArray(descriptor)) {
            throw new AppError('Invalid face descriptor', 400);
        }

        const employees = await getFaceDescriptors();

        let bestMatch = null;
        let minDistance = 1.0;

        for (const emp of employees) {
            const dist = getEuclideanDistance(descriptor, emp.faceDescriptor);

            if (dist < minDistance) {
                minDistance = dist;
                bestMatch = emp;
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

    // Save/Enroll Face
    enrollFace: async (req: Request, res: Response) => {
        const { employeeId, descriptor } = req.body;

        if (!descriptor || !Array.isArray(descriptor)) {
            throw new AppError('Invalid face descriptor', 400);
        }

        await prisma.employee.update({
            where: { id: employeeId },
            data: { faceDescriptor: descriptor }
        });

        // Invalidate cache
        cachedDescriptors = null;

        return ApiResponse.success(res, null, 'Face enrolled successfully');
    },

    // Clock In/Out via Kiosk
    clockIn: async (req: Request, res: Response) => {
        const { employeeId, method, pin, descriptor, latitude, longitude } = req.body;

        const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee) throw new AppError('Employee not found', 404);

        // Verification
        if (method === 'pin') {
            if (!employee.kioskPin) throw new AppError('PIN not set up', 400);
            const valid = await bcrypt.compare(pin, employee.kioskPin);
            if (!valid) throw new AppError('Invalid PIN', 401);
        } else if (method === 'face') {
            if (!descriptor || !Array.isArray(descriptor)) {
                throw new AppError('Face descriptor is required for biometric clock-in', 400);
            }
            if (!employee.faceDescriptor) {
                throw new AppError('Employee does not have a registered face', 400);
            }

            const stored = employee.faceDescriptor as unknown as number[];
            const dist = getEuclideanDistance(descriptor, stored);

            if (dist > FACE_MATCH_THRESHOLD) {
                throw new AppError('Face verification failed on server', 401);
            }
        } else {
            throw new AppError('Invalid clock-in method', 400);
        }

        // Determine if IN or OUT? 
        // Usually Kiosks toggle. Find last entry.
        const lastEntry = await prisma.timeEntry.findFirst({
            where: { employeeId },
            orderBy: { timestamp: 'desc' }
        });

        const type = (!lastEntry || lastEntry.type === 'OUT' || lastEntry.type === 'LUNCH_START' || lastEntry.type === 'BREAK_START')
            ? 'IN' : 'OUT'; // Simplified logic

        const entry = await prisma.timeEntry.create({
            data: {
                employeeId,
                type,
                location: 'Kiosk',
                device: 'Tablet Kiosk',
                latitude,
                longitude
            }
        });

        return ApiResponse.success(res, { entry }, `Clocked ${type} successfully`);
    },

    // Get recent kiosk activity for dashboard
    getKioskActivity: async (req: Request, res: Response) => {
        const activity = await prisma.timeEntry.findMany({
            where: {
                device: 'Tablet Kiosk'
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

        interface ActivityResponse {
            id: string;
            employeeName: string;
            type: string;
            timestamp: Date;
            method: string;
        }

        // Format for dashboard
        const formatted: ActivityResponse[] = activity.map(entry => ({
            id: entry.id,
            employeeName: (entry.employee.firstName && entry.employee.lastName)
                ? `${entry.employee.firstName} ${entry.employee.lastName}`
                : (entry.employee.name || 'Empleado'),
            type: entry.type,
            timestamp: entry.timestamp,
            method: entry.location === 'Kiosk' ? 'Face' : 'PIN/Manual' // Approximating based on location string
        }));

        return ApiResponse.success(res, formatted);
    }
};
