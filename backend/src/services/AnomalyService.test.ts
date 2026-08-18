import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { AnomalyService } from './AnomalyService';

vi.mock('../lib/prisma', () => ({
    prisma: {
        timeEntry: {
            findFirst: vi.fn(),
            findMany: vi.fn()
        },
        employee: {
            findUnique: vi.fn()
        },
        vacation: {
            findFirst: vi.fn()
        },
        anomalyEvent: {
            upsert: vi.fn()
        }
    }
}));

describe('AnomalyService.detectTimeEntry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.timeEntry.findFirst as any).mockResolvedValue(null);
        (prisma.timeEntry.findMany as any).mockResolvedValue([]);
        (prisma.employee.findUnique as any).mockResolvedValue(null);
        (prisma.anomalyEvent.upsert as any).mockResolvedValue({});
    });

    it('marca una anomalía VACATION_OVERLAP cuando el fichaje cae dentro de vacaciones aprobadas', async () => {
        (prisma.vacation.findFirst as any).mockResolvedValue({
            startDate: new Date('2026-08-10T00:00:00.000Z'),
            endDate: new Date('2026-08-14T00:00:00.000Z'),
            reason: 'Vacaciones de verano'
        });

        await AnomalyService.detectTimeEntry({
            id: 'entry-1',
            employeeId: 'emp-1',
            type: 'IN',
            timestamp: new Date('2026-08-12T08:30:00.000Z'),
            latitude: null,
            longitude: null
        });

        expect(prisma.vacation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                employeeId: 'emp-1',
                status: { in: ['APPROVED', 'EXISTING'] }
            })
        }));

        const upsertArgs = (prisma.anomalyEvent.upsert as any).mock.calls[0][0];
        const reasons = JSON.parse(upsertArgs.create.reasons) as Array<{ code: string; message: string; score: number }>;
        expect(reasons).toContainEqual(expect.objectContaining({
            code: 'VACATION_OVERLAP',
            message: 'Fichaje dentro de vacaciones aprobadas (Vacaciones de verano).'
        }));
    });

    it('no genera VACATION_OVERLAP cuando no hay vacaciones aprobadas ese día', async () => {
        (prisma.vacation.findFirst as any).mockResolvedValue(null);

        // Fichaje nocturno: dispara OFF_HOURS pero no debe cruzar con vacaciones.
        await AnomalyService.detectTimeEntry({
            id: 'entry-2',
            employeeId: 'emp-1',
            type: 'OUT',
            timestamp: new Date('2026-08-20T23:00:00.000Z'),
            latitude: null,
            longitude: null
        });

        const upsertArgs = (prisma.anomalyEvent.upsert as any).mock.calls[0][0];
        const reasons = JSON.parse(upsertArgs.create.reasons) as Array<{ code: string; message: string; score: number }>;
        expect(reasons.some((reason) => reason.code === 'VACATION_OVERLAP')).toBe(false);
        expect(reasons.some((reason) => reason.code === 'OFF_HOURS')).toBe(true);
    });

    it('ignora vacaciones pendientes o rechazadas', async () => {
        // findFirst devuelve null: la query ya filtra por APPROVED/EXISTING,
        // así que un registro PENDING no puede llegar aquí.
        (prisma.vacation.findFirst as any).mockResolvedValue(null);

        await AnomalyService.detectTimeEntry({
            id: 'entry-3',
            employeeId: 'emp-1',
            type: 'IN',
            timestamp: new Date('2026-08-12T08:30:00.000Z'),
            latitude: null,
            longitude: null
        });

        expect(prisma.vacation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                status: { in: ['APPROVED', 'EXISTING'] }
            })
        }));
    });
});
