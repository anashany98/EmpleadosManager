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
            // Turno único: SALIDA 1 es el fin de jornada (la pausa la recoge DESCONTAR).
            expect.objectContaining({ workDate: '2026-07-02', entryTime: '08:00', breakOutTime: null, breakInTime: null, exitTime: '16:00' })
        ]));
    });

    it('acepta el header "FECHA" (singular) y marca vacaciones sin jornada planificada', async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('JULIO');
        sheet.getRow(5).values = ['Día', 'FECHA', 'ENTRADA', 'SALIDA', 'ENTRADA', 'SALIDA', 'H.TRAB', 'DESCONTAR', 'H.LAB', 'H. EXT', 'H EXT Festivos', 'OBSERVACIONES'];
        sheet.getRow(6).values = ['Lu.', new Date(Date.UTC(2026, 6, 6)), '08:00', '14:00', '15:00', '18:30', '', '', '', '', '', 'Vacaciones'];
        sheet.getRow(7).values = ['Ma.', new Date(Date.UTC(2026, 6, 7)), '08:00', '16:00', '', '', '', '', '', '', '', ''];

        const preview = await PayrollControlImportService.preview(Buffer.from(await workbook.xlsx.writeBuffer()), 2026, 7);

        expect(preview.sheetName).toBe('JULIO');
        const vacation = preview.entries.find((entry) => entry.workDate === '2026-07-06');
        expect(vacation).toMatchObject({
            entryTime: '08:00',
            exitTime: '18:30',
            discountHours: 0,
            scheduledHours: 0,
            notes: 'Vacaciones'
        });
        const normal = preview.entries.find((entry) => entry.workDate === '2026-07-07');
        expect(normal).toMatchObject({
            discountHours: 0.5,
            scheduledHours: 8
        });
    });

    it('avisa cuando el archivo tiene varias hojas con datos del mes y solo importa la primera', async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet1 = workbook.addWorksheet('EMPLEADO A');
        const sheet2 = workbook.addWorksheet('EMPLEADO B');
        for (const sheet of [sheet1, sheet2]) {
            sheet.getRow(5).values = ['Día', 'FECHAS', 'ENTRADA', 'SALIDA', 'ENTRADA', 'SALIDA', 'H.TRAB', 'DESCONTAR', 'H.LAB', 'H. EXT', 'H EXT Festivos', 'OBSERVACIONES'];
            sheet.getRow(6).values = ['Lu.', new Date(Date.UTC(2026, 6, 6)), '08:00', '16:00', '', '', '', '', '', '', '', ''];
        }

        const preview = await PayrollControlImportService.preview(Buffer.from(await workbook.xlsx.writeBuffer()), 2026, 7);

        expect(preview.sheetName).toBe('EMPLEADO A');
        expect(preview.sheets).toEqual(['EMPLEADO A', 'EMPLEADO B']);
        expect(preview.warnings.join(' ')).toMatch(/2 hojas.*EMPLEADO B.*selecciona en la vista previa/);

        // Seleccionando otra hoja, se previsualiza la elegida.
        const previewB = await PayrollControlImportService.preview(Buffer.from(await workbook.xlsx.writeBuffer()), 2026, 7, 'EMPLEADO B');
        expect(previewB.sheetName).toBe('EMPLEADO B');
        expect(previewB.entries).toEqual([
            expect.objectContaining({ workDate: '2026-07-06', entryTime: '08:00', exitTime: '16:00' })
        ]);
    });

    it('avisa cuando H.TRAB no coincide con lo que suman los fichajes', async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('JULIO');
        sheet.getRow(5).values = ['Día', 'FECHAS', 'ENTRADA', 'SALIDA', 'ENTRADA', 'SALIDA', 'H.TRAB', 'DESCONTAR', 'H.LAB', 'H. EXT', 'H EXT Festivos', 'OBSERVACIONES'];
        // Turno partido 08:00-14:00 + 15:00-18:30 = 9,5 h; H.TRAB dice 8.
        sheet.getRow(6).values = ['Lu.', new Date(Date.UTC(2026, 6, 6)), '08:00', '14:00', '15:00', '18:30', 8, 0.5, 8, '', '', ''];
        // Turno único 08:00-16:00 = 8 h; H.TRAB coincide.
        sheet.getRow(7).values = ['Ma.', new Date(Date.UTC(2026, 6, 7)), '08:00', '16:00', '', '', 8, 0.5, 8, '', '', ''];

        const preview = await PayrollControlImportService.preview(Buffer.from(await workbook.xlsx.writeBuffer()), 2026, 7);

        expect(preview.warnings.join(' ')).toMatch(/Fila 6: H\.TRAB indica 8 h pero los fichajes suman 9\.5 h/);
        expect(preview.warnings.some((warning) => warning.includes('Fila 7'))).toBe(false);
        // La fila discrepante se importa igualmente, con sus horas y observaciones.
        expect(preview.entries).toEqual(expect.arrayContaining([
            expect.objectContaining({ workDate: '2026-07-06', entryTime: '08:00', exitTime: '18:30' })
        ]));
    });
});
