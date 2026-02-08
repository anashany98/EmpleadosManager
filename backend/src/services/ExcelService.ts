
import * as ExcelJS from 'exceljs';

export class ExcelService {
    /**
     * Generates an Excel workbook for Attendance Report.
     */
    static async generateAttendanceReport(data: any[]) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Asistencia');

        // Headers
        sheet.columns = [
            { header: 'Empleado', key: 'employee', width: 30 },
            { header: 'DNI', key: 'dni', width: 15 },
            { header: 'Fecha', key: 'date', width: 15 },
            { header: 'Check In', key: 'checkIn', width: 15 },
            { header: 'Check Out', key: 'checkOut', width: 15 },
            { header: 'Horas Totales', key: 'totalHours', width: 15 },
            { header: 'Tipo', key: 'type', width: 15 },
            { header: 'Comentario', key: 'comment', width: 30 }
        ];

        // Style headers
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add data
        data.forEach(entry => {
            sheet.addRow({
                employee: entry.employee.name,
                dni: entry.employee.dni,
                date: new Date(entry.date).toLocaleDateString('es-ES'),
                checkIn: entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString('es-ES') : '-',
                checkOut: entry.checkOut ? new Date(entry.checkOut).toLocaleTimeString('es-ES') : '-',
                totalHours: entry.totalHours || 0,
                type: entry.type,
                comment: entry.comment || ''
            });
        });

        return await workbook.xlsx.writeBuffer();
    }

    /**
     * Generates an Excel workbook for the calculated Attendance Summary.
     */
    static async generateAttendanceSummaryReport(data: any[]) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Resumen de Asistencia');

        sheet.columns = [
            { header: 'Empleado', key: 'name', width: 30 },
            { header: 'Fecha', key: 'date', width: 15 },
            { header: 'Horas Totales', key: 'hours', width: 15 },
            { header: 'Estado', key: 'status', width: 15 },
            { header: 'Detalle Segmentos', key: 'segments', width: 50 }
        ];

        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        sheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

        data.forEach(item => {
            const segmentStr = item.segments.map((s: any) =>
                `${new Date(s.start).toLocaleTimeString()} - ${s.end ? new Date(s.end).toLocaleTimeString() : '?'}`
            ).join(' | ');

            const row = sheet.addRow({
                name: item.employeeName,
                date: item.date,
                hours: item.totalHours,
                status: item.status === 'COMPLETE' ? 'Completo' : 'Incompleto',
                segments: segmentStr
            });

            if (item.status === 'INCOMPLETE') {
                row.getCell('D').font = { color: { argb: 'FFFF0000' }, bold: true };
            }
        });

        return await workbook.xlsx.writeBuffer();
    }


    /**
     * Generates an Excel workbook for Overtime Report.
     */
    static async generateOvertimeReport(data: any[]) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Horas Extra');

        sheet.columns = [
            { header: 'Empleado', key: 'employee', width: 30 },
            { header: 'Fecha', key: 'date', width: 15 },
            { header: 'Horas', key: 'hours', width: 12 },
            { header: 'Precio/Hora', key: 'rate', width: 15 },
            { header: 'Coste Total', key: 'total', width: 15 },
            { header: 'Tipo', key: 'type', width: 20 }
        ];

        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        data.forEach(entry => {
            sheet.addRow({
                employee: entry.employee.name,
                date: new Date(entry.date).toLocaleDateString('es-ES'),
                hours: entry.hours,
                rate: `${entry.rate.toFixed(2)}€`,
                total: `${entry.totalCost.toFixed(2)}€`,
                type: entry.type
            });
        });

        return await workbook.xlsx.writeBuffer();
    }

    /**
     * Generates an Excel workbook for Vacations Report.
     */
    static async generateVacationReport(data: any[]) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Vacaciones');

        sheet.columns = [
            { header: 'Empleado', key: 'employee', width: 30 },
            { header: 'Departamento', key: 'dept', width: 20 },
            { header: 'Cuota Total', key: 'total', width: 15 },
            { header: 'Consumidas', key: 'used', width: 15 },
            { header: 'Pendientes', key: 'remaining', width: 15 }
        ];

        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        data.forEach(emp => {
            sheet.addRow({
                employee: emp.name,
                dept: emp.department || 'Sin asignar',
                total: emp.totalQuota,
                used: emp.usedDays,
                remaining: emp.remainingDays
            });
        });

        return await workbook.xlsx.writeBuffer();
    }

    /**
     * Generates an Excel workbook for Company Cost.
     */
    static async generateCostReport(data: any[]) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Costes de Personal');

        sheet.columns = [
            { header: 'Empleado', key: 'name', width: 30 },
            { header: 'DNI', key: 'dni', width: 15 },
            { header: 'Depto', key: 'dept', width: 20 },
            { header: 'Sueldo Bruto', key: 'bruto', width: 18 },
            { header: 'SS Empresa', key: 'ssEmpresa', width: 18 },
            { header: 'Sueldo Neto', key: 'neto', width: 18 },
            { header: 'IRPF', key: 'irpf', width: 12 },
            { header: 'COSTE TOTAL', key: 'total', width: 20 }
        ];

        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        sheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

        data.forEach(item => {
            const row = sheet.addRow({
                name: item.name,
                dni: item.dni,
                dept: item.department,
                bruto: item.bruto,
                ssEmpresa: item.ssEmpresa,
                neto: item.neto,
                irpf: item.irpf,
                total: item.totalCost
            });

            // Format numbers
            ['D', 'E', 'F', 'G', 'H'].forEach(col => {
                row.getCell(col).numFmt = '#,##0.00"€"';
            });
            row.getCell('H').font = { bold: true };
        });

        return await workbook.xlsx.writeBuffer();
    }

    /**
     * Generates an Excel workbook for Detailed Absences.
     */
    static async generateDetailedAbsenceReport(data: any[]) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Bajas y Ausencias');

        sheet.columns = [
            { header: 'Empleado', key: 'name', width: 30 },
            { header: 'Inicio', key: 'start', width: 15 },
            { header: 'Fin', key: 'end', width: 15 },
            { header: 'Días', key: 'days', width: 10 },
            { header: 'Tipo', key: 'type', width: 20 },
            { header: 'Motivo', key: 'reason', width: 30 }
        ];

        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } };
        sheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

        data.forEach(item => {
            sheet.addRow({
                name: item.employee.name,
                start: new Date(item.startDate).toLocaleDateString('es-ES'),
                end: new Date(item.endDate).toLocaleDateString('es-ES'),
                days: item.days,
                type: item.type,
                reason: item.reason || ''
            });
        });

        return await workbook.xlsx.writeBuffer();
    }

    /**
     * Generates an Excel workbook for KPI Summary.
     */
    static async generateKPIReport(summary: any, deptStats: any[]) {
        const workbook = new ExcelJS.Workbook();

        // Tab 1: Global Metrics
        const mainSheet = workbook.addWorksheet('Resumen General');
        mainSheet.addRow(['KPIS DE RRHH Y ADMINISTRACIÓN', summary.period]).font = { bold: true, size: 14 };
        mainSheet.addRow([]);

        mainSheet.addRow(['Métrica', 'Valor']);
        mainSheet.addRow(['Empleados Totales', summary.headcount]);
        mainSheet.addRow(['Nuevas Altas', summary.hires]);
        mainSheet.addRow(['Bajas Realizadas', summary.exits]);
        mainSheet.addRow(['Tasa de Rotación', `${summary.turnoverRate}%`]);
        mainSheet.addRow(['Tasa de Absentismo', `${summary.absenteeismRate}%`]);
        mainSheet.addRow(['Días Totales de Ausencia', summary.totalAbsenceDays]);

        mainSheet.getColumn(1).width = 30;
        mainSheet.getColumn(2).width = 15;

        // Styling headers
        mainSheet.getRow(4).font = { bold: true };
        mainSheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };

        // Tab 2: Department Breakdown
        const deptSheet = workbook.addWorksheet('Absentismo por Depto');
        deptSheet.columns = [
            { header: 'Departamento', key: 'department', width: 25 },
            { header: 'Num. Empleados', key: 'employees', width: 15 },
            { header: 'Días Ausencia', key: 'absenceDays', width: 15 },
            { header: 'Tasa Absentismo', key: 'rate', width: 15 }
        ];

        deptSheet.getRow(1).font = { bold: true };
        deptStats.forEach(d => {
            const row = deptSheet.addRow(d);
            row.getCell(4).value = `${d.rate}%`;
        });

        return await workbook.xlsx.writeBuffer();
    }
}
