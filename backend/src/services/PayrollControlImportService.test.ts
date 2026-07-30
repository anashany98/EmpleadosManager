import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { PayrollControlImportService } from './PayrollControlImportService';

describe('PayrollControlImportService', () => {
    it('lee el formato de control horario: fecha, dos tramos y observaciones', async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('JULIO');
        sheet.getRow(5).values = ['Día', 'FECHAS', 'ENTRADA', 'SALIDA', 'ENTRADA', 'SALIDA', 'H.TRAB', 'DESCONTAR', 'H.LAB', 'H. EXT', 'H EXT Festivos', 'OBSERVACIONES'];
        sheet.getRow(6).values = ['Mi.', new Date(Date.UTC(2026, 6, 1)), '08:00', '14:00', '15:00', '18:30', '', '', '', '', '', 'Obra centro'];
        sheet.getRow(7).values = ['Ju.', new Date(Date.UTC(2026, 6, 2)), '08:00', '16:00', '', '', '', '', '', '', '', ''];

        const preview = await PayrollControlImportService.preview(Buffer.from(await workbook.xlsx.writeBuffer()), 2026, 7);

        expect(preview.sheetName).toBe('JULIO');
        expect(preview.entries).toEqual(expect.arrayContaining([
            expect.objectContaining({ workDate: '2026-07-01', entryTime: '08:00', breakOutTime: '14:00', breakInTime: '15:00', exitTime: '18:30', notes: 'Obra centro' }),
            expect.objectContaining({ workDate: '2026-07-02', entryTime: '08:00', breakOutTime: '16:00', breakInTime: null, exitTime: null })
        ]));
    });
});
