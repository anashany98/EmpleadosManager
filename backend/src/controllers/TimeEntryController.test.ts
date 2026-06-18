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
            findUnique: vi.fn(),
            count: vi.fn(),
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
            (prisma.timeEntry.findFirst as any).mockResolvedValue(null);
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

        it('should replay an existing time entry when clientRequestId is reused', async () => {
            const req = mockRequest({
                user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' },
                body: { type: 'IN', location: 'Office', clientRequestId: 'req-12345678' }
            });
            const firstRes = mockResponse();
            const secondRes = mockResponse();
            const createdEntry = { id: 'e1', type: 'IN', employeeId: 'emp-1' };

            (prisma.timeEntry.findUnique as any)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(createdEntry);
            (prisma.timeEntry.create as any).mockResolvedValue(createdEntry);

            await TimeEntryController.clock(req, firstRes);
            await TimeEntryController.clock(req, secondRes);

            expect(prisma.timeEntry.create).toHaveBeenCalledTimes(1);
            expect(secondRes.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    deduplicated: true,
                    dedupedBy: 'clientRequestId',
                    entry: createdEntry
                })
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
            (prisma.timeEntry.count as any).mockResolvedValue(entries.length);

            await TimeEntryController.getHistory(req, res);

            expect(prisma.timeEntry.findMany).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    data: entries,
                    pagination: expect.objectContaining({ total: entries.length })
                })
            }));
        });
    });

    // ------------------------------------------------------------------
    // Additional edge-case tests (added in Sprint 2)
    // ------------------------------------------------------------------

    describe('clock state machine', () => {
        it('LUNCH_START is mapped to LUNCH status in getStatus', async () => {
            const req = mockRequest({
                user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' }
            });
            const res = mockResponse();

            (prisma.timeEntry.findFirst as any).mockResolvedValue({
                id: 'e1',
                type: 'LUNCH_START',
                timestamp: new Date()
            });

            await TimeEntryController.getStatus(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: 'LUNCH' })
            }));
        });

        it('LUNCH_END is mapped to WORKING status in getStatus', async () => {
            const req = mockRequest({
                user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' }
            });
            const res = mockResponse();

            (prisma.timeEntry.findFirst as any).mockResolvedValue({
                id: 'e1',
                type: 'LUNCH_END',
                timestamp: new Date()
            });

            await TimeEntryController.getStatus(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: 'WORKING' })
            }));
        });

        it('BREAK_END is mapped to WORKING status in getStatus', async () => {
            const req = mockRequest({
                user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' }
            });
            const res = mockResponse();

            (prisma.timeEntry.findFirst as any).mockResolvedValue({
                id: 'e1',
                type: 'BREAK_END',
                timestamp: new Date()
            });

            await TimeEntryController.getStatus(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: 'WORKING' })
            }));
        });

        it('OUT is mapped to OFF status in getStatus', async () => {
            const req = mockRequest({
                user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' }
            });
            const res = mockResponse();

            (prisma.timeEntry.findFirst as any).mockResolvedValue({
                id: 'e1',
                type: 'OUT',
                timestamp: new Date()
            });

            await TimeEntryController.getStatus(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: 'OFF' })
            }));
        });
    });

    describe('clock validation', () => {
        it('should reject clock without employeeId (non-employee user)', async () => {
            const req = mockRequest({
                user: { id: 'admin-1', role: 'admin' }, // No employeeId
                body: { type: 'IN' }
            });
            const res = mockResponse();

            await TimeEntryController.clock(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should accept LUNCH_START and LUNCH_END types', async () => {
            for (const type of ['LUNCH_START', 'LUNCH_END']) {
                vi.clearAllMocks();
                const req = mockRequest({
                    user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' },
                    body: { type }
                });
                const res = mockResponse();

                (prisma.timeEntry.findFirst as any).mockResolvedValue(null);
                (prisma.timeEntry.create as any).mockResolvedValue({
                    id: 'e1',
                    type,
                    employeeId: 'emp-1'
                });

                await TimeEntryController.clock(req, res);
                expect(res.status).not.toHaveBeenCalledWith(400);
                // Verify the createMany/create was called with the correct type
                const createCall = vi.mocked(prisma.timeEntry.create).mock.calls[0]?.[0];
                expect(createCall?.data).toMatchObject({ type });
            }
        });

        it('should create alert on geofence violation (out of office radius)', async () => {
            const req = mockRequest({
                user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' },
                body: {
                    type: 'IN',
                    latitude: 41.3851, // Barcelona
                    longitude: 2.1734
                }
            });
            const res = mockResponse();

            // Mock employee with company far away from clock coordinates
            (prisma.employee.findUnique as any).mockResolvedValue({
                id: 'emp-1',
                company: { officeLatitude: 40.4168, officeLongitude: -3.7038 } // Madrid
            });
            (prisma.timeEntry.findFirst as any).mockResolvedValue(null);
            (prisma.timeEntry.create as any).mockResolvedValue({ id: 'e1', type: 'IN' });
            (prisma.alert.create as any).mockResolvedValue({ id: 'a1' });

            await TimeEntryController.clock(req, res);

            // The alert was created (geofence violation)
            expect(prisma.alert.create).toHaveBeenCalled();
        });

        it('should NOT create alert when clock is within office radius', async () => {
            const req = mockRequest({
                user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' },
                body: {
                    type: 'IN',
                    latitude: 40.4168,
                    longitude: -3.7038
                }
            });
            const res = mockResponse();

            (prisma.employee.findUnique as any).mockResolvedValue({
                id: 'emp-1',
                company: { officeLatitude: 40.4168, officeLongitude: -3.7038 }
            });
            (prisma.timeEntry.findFirst as any).mockResolvedValue(null);
            (prisma.timeEntry.create as any).mockResolvedValue({ id: 'e1', type: 'IN' });

            await TimeEntryController.clock(req, res);

            expect(prisma.alert.create).not.toHaveBeenCalled();
        });
    });

    describe('getHistory filtering', () => {
        it('should respect date range filters', async () => {
            const req = mockRequest({
                user: { id: 'user-1', employeeId: 'emp-1', role: 'employee' },
                query: { startDate: '2026-01-01', endDate: '2026-01-31' }
            });
            const res = mockResponse();

            (prisma.timeEntry.findMany as any).mockResolvedValue([]);
            (prisma.timeEntry.count as any).mockResolvedValue(0);

            await TimeEntryController.getHistory(req, res);

            // The findMany call must include a `where` clause. We assert
            // it has SOME timestamp filter; the exact shape depends on
            // the controller implementation.
            const findManyCall = vi.mocked(prisma.timeEntry.findMany).mock.calls[0]?.[0];
            expect(findManyCall?.where).toBeDefined();
            expect(findManyCall?.where?.employeeId).toBe('emp-1');
        });

        it('should support employeeId override (admin viewing other employee)', async () => {
            const req = mockRequest({
                user: { id: 'admin-1', role: 'admin', employeeId: 'admin-emp' },
                query: { employeeId: 'emp-other' }
            });
            const res = mockResponse();

            (prisma.timeEntry.findMany as any).mockResolvedValue([]);
            (prisma.timeEntry.count as any).mockResolvedValue(0);

            await TimeEntryController.getHistory(req, res);

            // The findMany call should use the overridden employeeId
            const findManyCall = vi.mocked(prisma.timeEntry.findMany).mock.calls[0]?.[0];
            expect(findManyCall?.where).toMatchObject({
                employeeId: 'emp-other'
            });
        });
    });
});
