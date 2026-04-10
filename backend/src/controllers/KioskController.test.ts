import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { KioskController } from './KioskController';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

vi.mock('../lib/prisma', () => ({
    prisma: {
        employee: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn()
        },
        timeEntry: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn()
        }
    }
}));

vi.mock('bcryptjs', () => ({
    default: {
        compare: vi.fn()
    }
}));

const mockRequest = (options: { body?: any; headers?: any; ip?: string }) => ({
    body: options.body || {},
    headers: options.headers || {},
    ip: options.ip || '127.0.0.1'
}) as unknown as Request;

const mockResponse = () => {
    const res: Partial<Response> = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
    };
    return res as Response;
};

describe('KioskController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deduplicates repeated kiosk clock requests by clientRequestId', async () => {
        const timestamp = new Date().toISOString();
        const request = mockRequest({
            body: {
                employeeId: 'emp-1',
                method: 'face',
                descriptor: [0.1, 0.2, 0.3, 0.4],
                timestamp,
                clientRequestId: 'req-12345678'
            }
        });
        const firstResponse = mockResponse();
        const secondResponse = mockResponse();

        (prisma.employee.findUnique as any).mockResolvedValue({
            id: 'emp-1',
            faceDescriptor: [0.1, 0.2, 0.3, 0.4],
            kioskPin: null
        });
        (prisma.timeEntry.findFirst as any).mockResolvedValue(null);
        (prisma.timeEntry.findUnique as any)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: 'entry-1',
                employeeId: 'emp-1',
                type: 'IN',
                timestamp: new Date(timestamp)
            });
        (prisma.timeEntry.create as any).mockResolvedValue({
            id: 'entry-1',
            employeeId: 'emp-1',
            type: 'IN',
            timestamp: new Date(timestamp)
        });

        await KioskController.clockIn(request, firstResponse);
        await KioskController.clockIn(request, secondResponse);

        expect(prisma.timeEntry.create).toHaveBeenCalledTimes(1);
        expect(secondResponse.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                deduplicated: true,
                dedupedBy: 'clientRequestId'
            })
        }));
    });

    it('blocks repeated invalid PIN attempts', async () => {
        const request = mockRequest({
            body: {
                employeeId: 'pin-employee',
                method: 'pin',
                pin: '0000',
                timestamp: new Date().toISOString()
            },
            ip: '10.0.0.5'
        });

        (prisma.employee.findUnique as any).mockResolvedValue({
            id: 'pin-employee',
            kioskPin: 'hashed-pin',
            faceDescriptor: null
        });
        (bcrypt.compare as any).mockResolvedValue(false);

        for (let index = 0; index < 5; index += 1) {
            await expect(KioskController.clockIn(request, mockResponse())).rejects.toMatchObject({
                statusCode: 401
            });
        }

        await expect(KioskController.clockIn(request, mockResponse())).rejects.toMatchObject({
            statusCode: 429
        });
    });
});
