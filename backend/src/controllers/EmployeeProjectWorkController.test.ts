import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { employeeProjectWorkController } from './EmployeeProjectWorkController';

vi.mock('../lib/prisma', () => ({
    prisma: {
        employee: { findUnique: vi.fn() },
        vacation: { findFirst: vi.fn() },
        absenceTypeConfig: { findFirst: vi.fn() },
        employeeProjectWork: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        }
    }
}));

vi.mock('../policies/employeeAccess', () => ({
    canManageEmployee: vi.fn(() => true),
    canReadEmployeeDetail: vi.fn(() => true)
}));

import { prisma } from '../lib/prisma';

const json = vi.fn();
const status = vi.fn(() => ({ json }));
const res = { status, json } as unknown as Response;

function makeReq(overrides: Record<string, unknown> = {}): Request {
    return {
        user: { id: 'user-1', role: 'admin', companyId: 'comp-1' },
        params: {},
        body: {},
        query: {},
        ...overrides
    } as unknown as Request;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('EmployeeProjectWorkController — bloqueo por ausencia aprobada', () => {
    it('rechaza imputar horas a obra en un día con baja médica aprobada (422) y no crea nada', async () => {
        (prisma.employee.findUnique as any).mockResolvedValue({ id: 'emp-1', companyId: 'comp-1' });
        (prisma.vacation.findFirst as any).mockResolvedValue({
            type: 'SICK',
            startDate: new Date('2026-08-10T00:00:00.000Z'),
            endDate: new Date('2026-08-14T00:00:00.000Z')
        });
        (prisma.absenceTypeConfig.findFirst as any).mockResolvedValue({ name: 'Baja médica' });

        await employeeProjectWorkController.create(makeReq({
            body: {
                employeeId: 'emp-1',
                projectId: 'proj-1',
                startDate: '2026-08-12',
                endDate: '2026-08-12',
                hours: 8,
                notes: null
            }
        }), res);

        expect(status).toHaveBeenCalledWith(422);
        expect(prisma.employeeProjectWork.create).not.toHaveBeenCalled();
        const payload = json.mock.calls[0][0] as { message: string };
        expect(payload.message).toMatch(/Baja médica/);
    });

    it('rechaza también permisos aprobados (tipo no vacacional)', async () => {
        (prisma.employee.findUnique as any).mockResolvedValue({ id: 'emp-1', companyId: 'comp-1' });
        (prisma.vacation.findFirst as any).mockResolvedValue({
            type: 'MARRIAGE',
            startDate: new Date('2026-08-26T00:00:00.000Z'),
            endDate: new Date('2026-08-26T00:00:00.000Z')
        });
        (prisma.absenceTypeConfig.findFirst as any).mockResolvedValue({ name: 'Boda' });

        await employeeProjectWorkController.create(makeReq({
            body: {
                employeeId: 'emp-1',
                projectId: 'proj-1',
                startDate: '2026-08-26',
                endDate: '2026-08-26',
                hours: 8
            }
        }), res);

        expect(status).toHaveBeenCalledWith(422);
        const payload = json.mock.calls[0][0] as { message: string };
        expect(payload.message).toMatch(/Boda/);
    });

    it('permite imputar cuando no hay ausencia aprobada que cubra el día', async () => {
        (prisma.employee.findUnique as any).mockResolvedValue({ id: 'emp-1', companyId: 'comp-1' });
        (prisma.vacation.findFirst as any).mockResolvedValue(null);
        (prisma.employeeProjectWork.create as any).mockResolvedValue({ id: 'entry-1' });

        await employeeProjectWorkController.create(makeReq({
            body: {
                employeeId: 'emp-1',
                projectId: 'proj-1',
                startDate: '2026-08-12',
                endDate: '2026-08-12',
                hours: 8
            }
        }), res);

        expect(status).toHaveBeenCalledWith(201);
        expect(prisma.employeeProjectWork.create).toHaveBeenCalled();
    });

    it('bloquea también la edición cuando el rango cae en una ausencia aprobada', async () => {
        (prisma.employeeProjectWork.findUnique as any).mockResolvedValue({
            id: 'entry-1',
            employeeId: 'emp-1',
            startDate: new Date('2026-08-12T00:00:00.000Z'),
            endDate: new Date('2026-08-12T00:00:00.000Z'),
            employee: { id: 'emp-1', companyId: 'comp-1' }
        });
        (prisma.vacation.findFirst as any).mockResolvedValue({
            type: 'SICK',
            startDate: new Date('2026-08-10T00:00:00.000Z'),
            endDate: new Date('2026-08-14T00:00:00.000Z')
        });
        (prisma.absenceTypeConfig.findFirst as any).mockResolvedValue({ name: 'Baja médica' });

        await employeeProjectWorkController.update(makeReq({
            params: { id: 'entry-1' },
            body: { hours: 6 }
        }), res);

        expect(status).toHaveBeenCalledWith(422);
        expect(prisma.employeeProjectWork.update).not.toHaveBeenCalled();
    });
});
