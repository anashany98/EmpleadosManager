import { describe, expect, it } from 'vitest';
import { normalizeDailyRowsForSave } from './employeeControlHorarioForm';

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
