import { describe, expect, it } from 'vitest';
import { getEmployeeVacations, normalizeDailyRowsForSave } from './employeeControlHorarioForm';

describe('normalizeDailyRowsForSave', () => {
    it('normaliza las horas escritas sin salir de la celda antes de guardar', () => {
        const result = normalizeDailyRowsForSave([{
            entryTime: '800',
            breakOutTime: '14.30',
            breakInTime: '',
            exitTime: '18:00'
        }]);

        expect(result.invalidRowIndexes).toEqual([]);
        expect(result.rows[0]).toMatchObject({
            entryTime: '08:00',
            breakOutTime: '14:30',
            breakInTime: '',
            exitTime: '18:00'
        });
    });

    it('no convierte una hora inválida en una fila vacía silenciosamente', () => {
        const result = normalizeDailyRowsForSave([{
            entryTime: '27:00',
            breakOutTime: '',
            breakInTime: '',
            exitTime: '18:00'
        }]);

        expect(result.invalidRowIndexes).toEqual([0]);
    });
});

describe('getEmployeeVacations', () => {
    it('devuelve mapa vacío cuando el empleado no tiene vacaciones', () => {
        const result = getEmployeeVacations([], 2026, 8);
        expect(result.size).toBe(0);
    });

    it('mapea únicamente los días del mes en que el empleado tiene vacaciones aprobadas', () => {
        const vacations = [
            {
                startDate: '2026-08-10T00:00:00.000Z',
                endDate: '2026-08-14T00:00:00.000Z',
                status: 'APPROVED',
                type: 'VACATION',
                reason: 'Vacaciones de verano'
            }
        ];

        const result = getEmployeeVacations(vacations, 2026, 8);
        expect(result.size).toBe(5);
        expect(result.get('2026-08-10')).toEqual({ type: 'VACATION', reason: 'Vacaciones de verano' });
        expect(result.get('2026-08-11')).toEqual({ type: 'VACATION', reason: 'Vacaciones de verano' });
        expect(result.get('2026-08-12')).toEqual({ type: 'VACATION', reason: 'Vacaciones de verano' });
        expect(result.get('2026-08-13')).toEqual({ type: 'VACATION', reason: 'Vacaciones de verano' });
        expect(result.get('2026-08-14')).toEqual({ type: 'VACATION', reason: 'Vacaciones de verano' });
        expect(result.get('2026-08-09')).toBeUndefined();
        expect(result.get('2026-08-15')).toBeUndefined();
    });

    it('ignora registros pendientes, rechazados o tipos de ausencia que no sean vacaciones', () => {
        const vacations = [
            {
                startDate: '2026-08-01T00:00:00.000Z',
                endDate: '2026-08-05T00:00:00.000Z',
                status: 'PENDING',
                type: 'VACATION'
            },
            {
                startDate: '2026-08-20T00:00:00.000Z',
                endDate: '2026-08-25T00:00:00.000Z',
                status: 'APPROVED',
                type: 'MEDICAL_LEAVE'
            }
        ];

        const result = getEmployeeVacations(vacations, 2026, 8);
        expect(result.size).toBe(0);
    });

    it('acota correctamente las fechas cuando la vacación abarca el cambio de mes', () => {
        const vacations = [
            {
                startDate: '2026-07-28T00:00:00.000Z',
                endDate: '2026-08-03T00:00:00.000Z',
                status: 'APPROVED',
                type: 'VACATION'
            }
        ];

        const resultAugust = getEmployeeVacations(vacations, 2026, 8);
        expect(resultAugust.size).toBe(3);
        expect(resultAugust.get('2026-08-01')).toBeDefined();
        expect(resultAugust.get('2026-08-02')).toBeDefined();
        expect(resultAugust.get('2026-08-03')).toBeDefined();
        expect(resultAugust.get('2026-08-04')).toBeUndefined();
    });
});
