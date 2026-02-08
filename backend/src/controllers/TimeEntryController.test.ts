import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { TimeEntryController } from './TimeEntryController';
import { prisma } from '../lib/prisma';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
    prisma: {
        timeEntry: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn()
        },
        employee: {
            findUnique: vi.fn()
        },
        alert: {
            create: vi.fn()
        }
    }
}));

// Mock services
vi.mock('../services/AnomalyService', () => ({
    AnomalyService: {
        detectTimeEntry: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../services/AuditService', () => ({
    AuditService: {
        log: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../services/LoggerService', () => ({
    createLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }),
    loggers: {
        api: { info: vi.fn(), error: vi.fn() }
    }
}));

// Helper to create mock request/response
const mockRequest = (options: { user?: any; params?: any; body?: any; query?: any }) => ({
    params: options.params || {},
    body: options.body || {},
    query: options.query || {},
    user: options.user
}) as unknown as Request;

const mockResponse = () => {
    const res: Partial<Response> = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
    };
    return res as Response;
};

describe('TimeEntryController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getStatus', () => {
        it('should return OFF status when no entries exist', async () => {
            const req = mockRequest({
                user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' }
            });
            const res = mockResponse();

            (prisma.timeEntry.findFirst as any).mockResolvedValue(null);

            await TimeEntryController.getStatus(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: { status: 'OFF', lastEntry: null }
            }));
        });

        it('should return WORKING status after clock IN', async () => {
            const req = mockRequest({
                user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' }
            });
            const res = mockResponse();

            const lastEntry = { id: 'e1', type: 'IN', timestamp: new Date() };
            (prisma.timeEntry.findFirst as any).mockResolvedValue(lastEntry);

            await TimeEntryController.getStatus(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: 'WORKING' })
            }));
        });

        it('should return BREAK status after break start', async () => {
            const req = mockRequest({
                user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' }
            });
            const res = mockResponse();

            const lastEntry = { id: 'e1', type: 'BREAK_START', timestamp: new Date() };
            (prisma.timeEntry.findFirst as any).mockResolvedValue(lastEntry);

            await TimeEntryController.getStatus(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: 'BREAK' })
            }));
        });

        it('should reject user without employeeId', async () => {
            const req = mockRequest({
                user: { id: 'admin-1', role: 'admin' } // No employeeId
            });
            const res = mockResponse();

            await TimeEntryController.getStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('clock', () => {
        it('should create a new time entry for clock IN', async () => {
            const req = mockRequest({
                user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' },
                body: { type: 'IN', location: 'Office' }
            });
            const res = mockResponse();

            const createdEntry = { id: 'e1', type: 'IN', employeeId: 'emp-1' };
            (prisma.timeEntry.create as any).mockResolvedValue(createdEntry);

            await TimeEntryController.clock(req, res);

            expect(prisma.timeEntry.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    employeeId: 'emp-1',
                    type: 'IN'
                })
            }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true
            }));
        });

        it('should reject invalid clock type', async () => {
            const req = mockRequest({
                user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' },
                body: { type: 'INVALID_TYPE' }
            });
            const res = mockResponse();

            await TimeEntryController.clock(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getHistory', () => {
        it('should return time entry history for employee', async () => {
            const req = mockRequest({
                user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' },
                query: {}
            });
            const res = mockResponse();

            const entries = [
                { id: 'e1', type: 'IN', timestamp: new Date() },
                { id: 'e2', type: 'OUT', timestamp: new Date() }
            ];
            (prisma.timeEntry.findMany as any).mockResolvedValue(entries);

            await TimeEntryController.getHistory(req, res);

            expect(prisma.timeEntry.findMany).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: entries
            }));
        });
    });
});
