import {
    ExcelContext,
    createWorkbook,
    addRankingSheet,
    formatCurrency,
    formatNumber,
    formatPercent,
    formatDate,
    formatTime,
    safeNumber,
    uniqueCount,
    sumBy,
    groupRows,
    TIPO_LABEL_ES
} from './excel/excelHelpers';
import { EncryptionService } from './EncryptionService';

export class ExcelService {
    static async generateAttendanceReport(data: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('Reporte de fichajes');
        const employees = uniqueCount(data.map((entry) => entry.employee?.id));
        const departments = uniqueCount(data.map((entry) => entry.employee?.department));
        const typeCounts = groupRows(data, (entry) => entry.type || 'N/A');
        const typeBreakdown = Array.from(typeCounts.entries()).map(([type, entries]) => ({
            type,
            records: entries.length
        }));

        addRankingSheet(
            workbook,
            'Resumen',
            context.title || 'Reporte de asistencia y fichajes',
            context.subtitle || 'Exportación detallada de fichajes individuales para auditoría operativa.',
            [
                { label: 'Registros', value: data.length, hint: 'Marcajes encontrados' },
                { label: 'Personas', value: employees, hint: 'Empleados con fichajes' },
                { label: 'Departamentos', value: departments, hint: 'Áreas implicadas' },
                { label: 'Tipos', value: typeBreakdown.length, hint: 'Clases de marcaje' }
            ],
            [
                { header: 'Tipo de registro', key: 'type', width: 24 },
                { header: 'Volumen', key: 'records', width: 14, align: 'right' }
            ],
            typeBreakdown,
            'blue',
            context,
            { type: 'TOTAL', records: data.length }
        );

        addRankingSheet(
            workbook,
            'Detalle de fichajes',
            'Detalle de fichajes',
            'Listado cronológico de marcajes individuales para contraste y auditoría.',
            [
                { label: 'Primer registro', value: data[0]?.timestamp ? formatDate(data[0].timestamp) : '-', hint: 'Inicio visible' },
                { label: 'Último registro', value: data[data.length - 1]?.timestamp ? formatDate(data[data.length - 1].timestamp) : '-', hint: 'Fin visible' },
                { label: 'Entradas', value: typeCounts.get('IN')?.length || 0, hint: 'Marcajes de inicio' },
                { label: 'Salidas', value: typeCounts.get('OUT')?.length || 0, hint: 'Marcajes de cierre' }
            ],
            [
                { header: 'Empleado', key: 'employee', width: 28 },
                { header: 'DNI', key: 'dni', width: 16 },
                { header: 'Departamento', key: 'department', width: 20 },
                { header: 'Fecha', key: 'date', width: 14, align: 'center' },
                { header: 'Hora', key: 'time', width: 12, align: 'center' },
                { header: 'Tipo', key: 'type', width: 18, align: 'center' },
                { header: 'Subcuenta 465', key: 'subaccount465', width: 16, align: 'center' }
            ],
            data.map((entry) => ({
                employee: entry.employee?.name || 'N/A',
                dni: EncryptionService.decrypt(entry.employee?.dni) || '-',
                department: entry.employee?.department || 'Sin asignar',
                date: formatDate(entry.timestamp),
                time: formatTime(entry.timestamp),
                type: entry.type || '-',
                subaccount465: entry.employee?.subaccount465 || '-'
            })),
            'blue',
            context
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateAttendanceSummaryReport(data: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('Resumen operativo de asistencia');
        const totalHours = sumBy(data, (item) => safeNumber(item.totalHours));
        const employees = uniqueCount(data.map((item) => item.employeeId));
        const incompleteDays = data.filter((item) => item.status === 'INCOMPLETE').length;
        const averageHours = data.length > 0 ? totalHours / data.length : 0;

        const employeeRollup = Array.from(groupRows(data, (item) => item.employeeName || 'N/A').entries())
            .map(([employee, items]) => ({
                employee,
                days: items.length,
                totalHours: sumBy(items, (item) => safeNumber(item.totalHours)),
                incomplete: items.filter((item) => item.status === 'INCOMPLETE').length,
                averageHours: items.length > 0 ? sumBy(items, (item) => safeNumber(item.totalHours)) / items.length : 0
            }))
            .sort((left, right) => right.totalHours - left.totalHours);

        addRankingSheet(
            workbook,
            'Resumen diario',
            context.title || 'Resumen diario de asistencia',
            context.subtitle || 'Consolidado de horas trabajadas por persona y día.',
            [
                { label: 'Jornadas', value: data.length, hint: 'Días trabajados' },
                { label: 'Personas', value: employees, hint: 'Empleados activos en el periodo' },
                { label: 'Horas', value: formatNumber(totalHours, 2), hint: 'Horas acumuladas' },
                { label: 'Incompletas', value: incompleteDays, hint: 'Revisión recomendada' }
            ],
            [
                { header: 'Empleado', key: 'employee', width: 28 },
                { header: 'Día', key: 'days', width: 12, align: 'center' },
                { header: 'Horas totales', key: 'totalHours', width: 16, align: 'right', numFmt: '#,##0.00' },
                { header: 'Media diaria', key: 'averageHours', width: 16, align: 'right', numFmt: '#,##0.00' },
                { header: 'Días incompletos', key: 'incomplete', width: 18, align: 'center' }
            ],
            employeeRollup,
            'blue',
            context,
            {
                employee: 'TOTAL',
                days: data.length,
                totalHours,
                averageHours,
                incomplete: incompleteDays
            }
        );

        addRankingSheet(
            workbook,
            'Detalle diario',
            'Detalle diario de asistencia',
            'Vista por empleado, día y segmentos horarios consolidados.',
            [
                { label: 'Media diaria', value: formatNumber(averageHours, 2), hint: 'Horas por jornada' },
                { label: 'Máximo diario', value: formatNumber(Math.max(...data.map((item) => safeNumber(item.totalHours)), 0), 2), hint: 'Pico de jornada' },
                { label: 'Mínimo diario', value: formatNumber(Math.min(...data.map((item) => safeNumber(item.totalHours)).filter((value) => value > 0), averageHours || 0), 2), hint: 'Jornada más baja' },
                { label: 'Segmentos', value: data.reduce((sum, item) => sum + (item.segments?.length || 0), 0), hint: 'Bloques horarios' }
            ],
            [
                { header: 'Empleado', key: 'employee', width: 28 },
                { header: 'DNI', key: 'dni', width: 16 },
                { header: 'Departamento', key: 'department', width: 18 },
                { header: 'Fecha', key: 'date', width: 14, align: 'center' },
                { header: 'Horas', key: 'hours', width: 12, align: 'right', numFmt: '#,##0.00' },
                { header: 'Estado', key: 'status', width: 14, align: 'center' },
                { header: 'Primer fichaje', key: 'firstSegment', width: 14, align: 'center' },
                { header: 'Último fichaje', key: 'lastSegment', width: 14, align: 'center' },
                { header: 'Segmentos', key: 'segments', width: 60, wrapText: true }
            ],
            data.map((item) => ({
                employee: item.employeeName,
                dni: EncryptionService.decrypt(item.employeeDni) || '-',
                department: item.department || 'Sin asignar',
                date: formatDate(item.date),
                hours: safeNumber(item.totalHours),
                status: item.status === 'COMPLETE' ? 'Completo' : 'Incompleto',
                firstSegment: item.segments?.length ? formatTime(item.segments[0].start) : '-',
                lastSegment: item.segments?.length ? formatTime(item.segments[item.segments.length - 1].end || item.segments[item.segments.length - 1].start) : '-',
                segments: (item.segments || []).map((segment: any) => `${formatTime(segment.start)} - ${segment.end ? formatTime(segment.end) : 'Abierto'} (${segment.type})`).join(' | ')
            })),
            'blue',
            context
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateOvertimeReport(data: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('Reporte de horas extra');
        const totalHours = sumBy(data, (entry) => safeNumber(entry.hours));
        const totalCost = sumBy(data, (entry) => safeNumber(entry.totalCost));
        const employees = uniqueCount(data.map((entry) => entry.employee?.id));
        const averageRate = data.length > 0 ? sumBy(data, (entry) => safeNumber(entry.rate)) / data.length : 0;

        const departmentRollup = Array.from(groupRows(data, (entry) => entry.employee?.department || 'Sin asignar').entries())
            .map(([department, entries]) => ({
                department,
                employees: uniqueCount(entries.map((entry) => entry.employee?.id)),
                hours: sumBy(entries, (entry) => safeNumber(entry.hours)),
                totalCost: sumBy(entries, (entry) => safeNumber(entry.totalCost))
            }))
            .sort((left, right) => right.totalCost - left.totalCost);

        addRankingSheet(
            workbook,
            'Resumen',
            context.title || 'Reporte de horas extra',
            context.subtitle || 'Vista ejecutiva de horas adicionales y su impacto económico.',
            [
                { label: 'Registros', value: data.length, hint: 'Entradas liquidadas' },
                { label: 'Personas', value: employees, hint: 'Empleados con horas extra' },
                { label: 'Horas', value: formatNumber(totalHours, 2), hint: 'Volumen total' },
                { label: 'Coste', value: formatCurrency(totalCost), hint: 'Impacto económico' }
            ],
            [
                { header: 'Departamento', key: 'department', width: 24 },
                { header: 'Personas', key: 'employees', width: 12, align: 'center' },
                { header: 'Horas', key: 'hours', width: 14, align: 'right', numFmt: '#,##0.00' },
                { header: 'Coste', key: 'totalCost', width: 16, align: 'right', numFmt: '#,##0.00"€"' }
            ],
            departmentRollup,
            'emerald',
            context,
            {
                department: 'TOTAL',
                employees,
                hours: totalHours,
                totalCost
            }
        );

        addRankingSheet(
            workbook,
            'Detalle',
            'Detalle de horas extra',
            'Desglose por persona, fecha y tipo de hora adicional.',
            [
                { label: 'Media tarifa', value: formatCurrency(averageRate), hint: 'Tarifa media por hora' },
                { label: 'Máximo coste', value: formatCurrency(Math.max(...data.map((entry) => safeNumber(entry.totalCost)), 0)), hint: 'Registro más costoso' },
                { label: 'Horas máximas', value: formatNumber(Math.max(...data.map((entry) => safeNumber(entry.hours)), 0), 2), hint: 'Pico por registro' },
                { label: 'Tipos', value: uniqueCount(data.map((entry) => entry.type)), hint: 'Clases de extra' }
            ],
            [
                { header: 'Empleado', key: 'employee', width: 28 },
                { header: 'DNI', key: 'dni', width: 16 },
                { header: 'Departamento', key: 'department', width: 20 },
                { header: 'Fecha', key: 'date', width: 14, align: 'center' },
                { header: 'Horas', key: 'hours', width: 12, align: 'right', numFmt: '#,##0.00' },
                { header: 'Tarifa', key: 'rate', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Coste total', key: 'totalCost', width: 16, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Tipo', key: 'type', width: 18, align: 'center' }
            ],
            data.map((entry) => ({
                employee: entry.employee?.name || 'N/A',
                dni: EncryptionService.decrypt(entry.employee?.dni) || '-',
                department: entry.employee?.department || 'Sin asignar',
                date: formatDate(entry.date),
                hours: safeNumber(entry.hours),
                rate: safeNumber(entry.rate),
                totalCost: safeNumber(entry.totalCost),
                type: entry.type || '-'
            })),
            'emerald',
            context
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateVacationReport(data: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('Reporte de vacaciones');
        const totalQuota = sumBy(data, (employee) => safeNumber(employee.totalQuota));
        const usedDays = sumBy(data, (employee) => safeNumber(employee.usedDays));
        const pendingDays = sumBy(data, (employee) => safeNumber(employee.pendingDays));
        const remainingDays = sumBy(data, (employee) => safeNumber(employee.remainingDays));
        const atRisk = data.filter((employee) => safeNumber(employee.remainingDays) <= 5).length;

        const departmentRollup = Array.from(groupRows(data, (employee) => employee.department || 'Sin asignar').entries())
            .map(([department, employees]) => {
                const total = sumBy(employees, (employee) => safeNumber(employee.totalQuota));
                const used = sumBy(employees, (employee) => safeNumber(employee.usedDays));
                return {
                    department,
                    employees: employees.length,
                    totalQuota: total,
                    usedDays: used,
                    remainingDays: total - used,
                    usageRate: total > 0 ? Number(((used / total) * 100).toFixed(2)) : 0
                };
            })
            .sort((left, right) => right.usedDays - left.usedDays);

        addRankingSheet(
            workbook,
            'Resumen',
            context.title || 'Reporte de vacaciones',
            context.subtitle || 'Estado de cuota, consumo y saldo de vacaciones por persona.',
            [
                { label: 'Empleados', value: data.length, hint: 'Personas analizadas' },
                { label: 'Cuota total', value: formatNumber(totalQuota, 1), hint: 'Días disponibles' },
                { label: 'Consumidos', value: formatNumber(usedDays, 1), hint: 'Días disfrutados' },
                { label: 'Pendientes', value: formatNumber(pendingDays, 1), hint: 'Aprobación en curso' },
                { label: 'Saldo crítico', value: atRisk, hint: 'Con <= 5 días restantes' }
            ],
            [
                { header: 'Departamento', key: 'department', width: 24 },
                { header: 'Empleados', key: 'employees', width: 12, align: 'center' },
                { header: 'Cuota', key: 'totalQuota', width: 14, align: 'right', numFmt: '#,##0.0' },
                { header: 'Consumidos', key: 'usedDays', width: 14, align: 'right', numFmt: '#,##0.0' },
                { header: 'Saldo', key: 'remainingDays', width: 14, align: 'right', numFmt: '#,##0.0' },
                { header: 'Uso %', key: 'usageRate', width: 12, align: 'right', numFmt: '0.00%' }
            ],
            departmentRollup.map((row) => ({ ...row, usageRate: row.usageRate / 100 })),
            'amber',
            context,
            {
                department: 'TOTAL',
                employees: data.length,
                totalQuota,
                usedDays,
                remainingDays,
                usageRate: totalQuota > 0 ? usedDays / totalQuota : 0
            }
        );

        addRankingSheet(
            workbook,
            'Detalle',
            'Detalle de vacaciones',
            'Vista individual con consumo, saldo y volumen de solicitudes registradas.',
            [
                { label: 'Saldo disponible', value: formatNumber(remainingDays, 1), hint: 'Total pendiente' },
                { label: 'Uso global', value: formatPercent(totalQuota > 0 ? (usedDays / totalQuota) * 100 : 0), hint: 'Porcentaje consumido' },
                { label: 'Máximo consumo', value: formatNumber(Math.max(...data.map((employee) => safeNumber(employee.usedDays)), 0), 1), hint: 'Empleado con más uso' },
                { label: 'Solicitudes', value: data.reduce((sum, employee) => sum + safeNumber(employee.requests ?? (employee.vacations || []).length), 0), hint: 'Peticiones registradas' }
            ],
            [
                { header: 'Empleado', key: 'employee', width: 28 },
                { header: 'Departamento', key: 'department', width: 20 },
                { header: 'Anuales', key: 'annualQuotaDays', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Arrastradas', key: 'carriedOverDays', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Importadas', key: 'importedUsedDays', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Aprobadas', key: 'approvedUsedDays', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Pendientes', key: 'pendingDays', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Saldo', key: 'remainingDays', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Saldo proj.', key: 'projectedRemainingDays', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Solicitudes', key: 'requests', width: 12, align: 'center' }
            ],
            data.map((employee) => ({
                employee: employee.name,
                department: employee.department || 'Sin asignar',
                annualQuotaDays: safeNumber(employee.annualQuotaDays),
                carriedOverDays: safeNumber(employee.carriedOverDays),
                importedUsedDays: safeNumber(employee.importedUsedDays),
                approvedUsedDays: safeNumber(employee.approvedUsedDays),
                pendingDays: safeNumber(employee.pendingDays),
                remainingDays: safeNumber(employee.remainingDays),
                projectedRemainingDays: safeNumber(employee.projectedRemainingDays),
                requests: safeNumber(employee.requests ?? (employee.vacations || []).length)
            })),
            'amber',
            context
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateCostReport(data: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('Reporte de costes');
        const totalBruto = sumBy(data, (item) => safeNumber(item.bruto));
        const totalEmployerSS = sumBy(data, (item) => safeNumber(item.ssEmpresa));
        const totalNet = sumBy(data, (item) => safeNumber(item.neto));
        const totalCost = sumBy(data, (item) => safeNumber(item.totalCost));
        const averageCost = data.length > 0 ? totalCost / data.length : 0;

        const departmentRollup = Array.from(groupRows(data, (item) => item.department || 'Sin asignar').entries())
            .map(([department, entries]) => ({
                department,
                employees: entries.length,
                bruto: sumBy(entries, (item) => safeNumber(item.bruto)),
                ssEmpresa: sumBy(entries, (item) => safeNumber(item.ssEmpresa)),
                totalCost: sumBy(entries, (item) => safeNumber(item.totalCost))
            }))
            .sort((left, right) => right.totalCost - left.totalCost);

        addRankingSheet(
            workbook,
            'Resumen',
            context.title || 'Reporte de costes de personal',
            context.subtitle || 'Visión de coste empresa con base de nómina consolidada.',
            [
                { label: 'Empleados', value: data.length, hint: 'Personas liquidadas' },
                { label: 'Coste total', value: formatCurrency(totalCost), hint: 'Coste empresa acumulado' },
                { label: 'Bruto', value: formatCurrency(totalBruto), hint: 'Retribución bruta' },
                { label: 'SS empresa', value: formatCurrency(totalEmployerSS), hint: 'Carga social' }
            ],
            [
                { header: 'Departamento', key: 'department', width: 24 },
                { header: 'Empleados', key: 'employees', width: 12, align: 'center' },
                { header: 'Bruto', key: 'bruto', width: 16, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'SS empresa', key: 'ssEmpresa', width: 16, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Coste total', key: 'totalCost', width: 18, align: 'right', numFmt: '#,##0.00"€"' }
            ],
            departmentRollup,
            'violet',
            context,
            {
                department: 'TOTAL',
                employees: data.length,
                bruto: totalBruto,
                ssEmpresa: totalEmployerSS,
                totalCost
            }
        );

        addRankingSheet(
            workbook,
            'Detalle',
            'Detalle de costes de personal',
            'Desglose por persona con bruto, seguridad social, IRPF y coste final.',
            [
                { label: 'Coste medio', value: formatCurrency(averageCost), hint: 'Media por persona' },
                { label: 'Neto total', value: formatCurrency(totalNet), hint: 'Pagado a plantilla' },
                { label: 'IRPF total', value: formatCurrency(sumBy(data, (item) => safeNumber(item.irpf))), hint: 'Retención acumulada' },
                { label: 'SS trabajador', value: formatCurrency(sumBy(data, (item) => safeNumber(item.ssTrabajador))), hint: 'Aportación trabajador' }
            ],
            [
                { header: 'Empleado', key: 'name', width: 28 },
                { header: 'DNI', key: 'dni', width: 16 },
                { header: 'Departamento', key: 'department', width: 20 },
                { header: 'Bruto', key: 'bruto', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'SS empresa', key: 'ssEmpresa', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'SS trabajador', key: 'ssTrabajador', width: 16, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'IRPF', key: 'irpf', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Neto', key: 'neto', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Coste total', key: 'totalCost', width: 16, align: 'right', numFmt: '#,##0.00"€"' }
            ],
            data.map((item) => ({
                ...item,
                department: item.department || 'Sin asignar'
            })),
            'violet',
            context,
            {
                name: 'TOTAL',
                bruto: totalBruto,
                ssEmpresa: totalEmployerSS,
                ssTrabajador: sumBy(data, (item) => safeNumber(item.ssTrabajador)),
                irpf: sumBy(data, (item) => safeNumber(item.irpf)),
                neto: totalNet,
                totalCost
            }
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateDetailedAbsenceReport(data: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('Reporte de ausencias');
        const totalDays = sumBy(data, (item) => safeNumber(item.days));
        const affectedEmployees = uniqueCount(data.map((item) => item.employee?.id));
        const averageDuration = data.length > 0 ? totalDays / data.length : 0;
        const typeBreakdown = Array.from(groupRows(data, (item) => item.type || 'Sin tipo').entries())
            .map(([type, entries]) => ({
                type,
                cases: entries.length,
                days: sumBy(entries, (item) => safeNumber(item.days))
            }))
            .sort((left, right) => right.days - left.days);

        addRankingSheet(
            workbook,
            'Resumen',
            context.title || 'Reporte detallado de ausencias',
            context.subtitle || 'Control de bajas, incidencias y suspensiones registradas.',
            [
                { label: 'Casos', value: data.length, hint: 'Ausencias registradas' },
                { label: 'Empleados', value: affectedEmployees, hint: 'Plantilla afectada' },
                { label: 'Días', value: formatNumber(totalDays, 1), hint: 'Duración acumulada' },
                { label: 'Media', value: formatNumber(averageDuration, 1), hint: 'Días por caso' }
            ],
            [
                { header: 'Tipo', key: 'type', width: 26 },
                { header: 'Casos', key: 'cases', width: 12, align: 'center' },
                { header: 'Días', key: 'days', width: 14, align: 'right', numFmt: '#,##0.0' }
            ],
            typeBreakdown,
            'rose',
            context,
            { type: 'TOTAL', cases: data.length, days: totalDays }
        );

        addRankingSheet(
            workbook,
            'Detalle',
            'Detalle de ausencias',
            'Listado cronológico con motivo, duración y tipología de la ausencia.',
            [
                { label: 'Mayor ausencia', value: formatNumber(Math.max(...data.map((item) => safeNumber(item.days)), 0), 1), hint: 'Duración máxima' },
                { label: 'Tipos', value: typeBreakdown.length, hint: 'Clasificaciones distintas' },
                { label: 'Inicio más reciente', value: data[0]?.startDate ? formatDate(data[0].startDate) : '-', hint: 'Último caso' },
                { label: 'Fin más lejano', value: data.length > 0 ? formatDate(data.reduce((latest, item) => latest > new Date(item.endDate) ? latest : new Date(item.endDate), new Date(data[0].endDate))) : '-', hint: 'Cobertura final' }
            ],
            [
                { header: 'Empleado', key: 'employee', width: 28 },
                { header: 'DNI', key: 'dni', width: 16 },
                { header: 'Departamento', key: 'department', width: 18 },
                { header: 'Inicio', key: 'startDate', width: 14, align: 'center' },
                { header: 'Fin', key: 'endDate', width: 14, align: 'center' },
                { header: 'Días', key: 'days', width: 12, align: 'right', numFmt: '#,##0.0' },
                { header: 'Tipo', key: 'type', width: 18, align: 'center' },
                { header: 'Motivo', key: 'reason', width: 40, wrapText: true }
            ],
            data.map((item) => ({
                employee: item.employee?.name || 'N/A',
                dni: EncryptionService.decrypt(item.employee?.dni) || '-',
                department: item.employee?.department || 'Sin asignar',
                startDate: formatDate(item.startDate),
                endDate: formatDate(item.endDate),
                days: safeNumber(item.days),
                type: item.type || '-',
                reason: item.reason || '-'
            })),
            'rose',
            context
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateKPIReport(summary: any, deptStats: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('KPIs de gestion');

        addRankingSheet(
            workbook,
            'Resumen ejecutivo',
            context.title || 'KPIs de organización',
            context.subtitle || 'Cuadro de mando de rotación, absentismo y estructura de plantilla.',
            [
                { label: 'Plantilla', value: summary.headcount || 0, hint: 'Personas activas' },
                { label: 'Altas', value: summary.hires || 0, hint: 'Incorporaciones del periodo' },
                { label: 'Bajas', value: summary.exits || 0, hint: 'Salidas registradas' },
                { label: 'Absentismo', value: formatPercent(safeNumber(summary.absenteeismRate)), hint: 'Tasa mensual' }
            ],
            [
                { header: 'Métrica', key: 'metric', width: 28 },
                { header: 'Valor', key: 'value', width: 18 },
                { header: 'Lectura', key: 'hint', width: 48, wrapText: true }
            ],
            [
                { metric: 'Rotación', value: formatPercent(safeNumber(summary.turnoverRate)), hint: 'Cuanto mayor sea, mayor presión de sustitución y adaptación.' },
                { metric: 'Días totales de ausencia', value: safeNumber(summary.totalAbsenceDays), hint: 'Impacto acumulado del absentismo en el periodo.' },
                { metric: 'Balance altas/bajas', value: safeNumber(summary.hires) - safeNumber(summary.exits), hint: 'Variación neta de plantilla.' },
                { metric: 'Periodo', value: summary.period || context.periodLabel || '-', hint: 'Marco temporal consolidado.' }
            ],
            'violet',
            context
        );

        addRankingSheet(
            workbook,
            'Absentismo por depto',
            'Absentismo por departamento',
            'Ranking departamental para detectar focos de ausencia y necesidad de refuerzo.',
            [
                { label: 'Departamentos', value: deptStats.length, hint: 'Áreas comparadas' },
                { label: 'Mayor tasa', value: formatPercent(Math.max(...deptStats.map((item) => safeNumber(item.rate)), 0)), hint: 'Pico departamental' },
                { label: 'Mayor volumen', value: formatNumber(Math.max(...deptStats.map((item) => safeNumber(item.absenceDays)), 0), 1), hint: 'Días de ausencia' },
                { label: 'Promedio', value: formatPercent(deptStats.length > 0 ? sumBy(deptStats, (item) => safeNumber(item.rate)) / deptStats.length : 0), hint: 'Media de áreas' }
            ],
            [
                { header: 'Departamento', key: 'department', width: 26 },
                { header: 'Empleados', key: 'employees', width: 12, align: 'center' },
                { header: 'Días ausencia', key: 'absenceDays', width: 16, align: 'right', numFmt: '#,##0.0' },
                { header: 'Días potenciales', key: 'potentialDays', width: 18, align: 'right', numFmt: '#,##0.0' },
                { header: 'Tasa', key: 'rate', width: 12, align: 'right', numFmt: '0.00%' }
            ],
            deptStats.map((item) => ({ ...item, rate: safeNumber(item.rate) / 100 })),
            'violet',
            context,
            {
                department: 'PROMEDIO',
                employees: sumBy(deptStats, (item) => safeNumber(item.employees)),
                absenceDays: sumBy(deptStats, (item) => safeNumber(item.absenceDays)),
                potentialDays: sumBy(deptStats, (item) => safeNumber(item.potentialDays)),
                rate: deptStats.length > 0 ? sumBy(deptStats, (item) => safeNumber(item.rate)) / deptStats.length / 100 : 0
            }
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateGenderGapReport(data: any, context: ExcelContext = {}) {
        const workbook = createWorkbook('Reporte de igualdad');
        const summary = data?.summary || {};
        const rows = data?.rows || [];

        addRankingSheet(
            workbook,
            'Resumen',
            context.title || 'Reporte de igualdad y diversidad',
            context.subtitle || 'Seguimiento de plantilla y brecha salarial por género.',
            [
                { label: 'Brecha global', value: formatPercent(safeNumber(summary.gapPercentage)), hint: 'Diferencia retributiva media' },
                { label: 'Hombres', value: summary.maleCount || 0, hint: 'Plantilla masculina' },
                { label: 'Mujeres', value: summary.femaleCount || 0, hint: 'Plantilla femenina' },
                { label: 'Paridad', value: summary.maleCount && summary.femaleCount ? formatNumber((safeNumber(summary.femaleCount) / Math.max(safeNumber(summary.maleCount), 1)) * 100, 1) + '%' : '0%', hint: 'Ratio mujeres / hombres' }
            ],
            [
                { header: 'Indicador', key: 'indicator', width: 28 },
                { header: 'Valor', key: 'value', width: 18 },
                { header: 'Lectura', key: 'hint', width: 44, wrapText: true }
            ],
            [
                { indicator: 'Sueldo medio hombres', value: formatCurrency(safeNumber(summary.maleAvgBruto)), hint: 'Promedio bruto estimado con las últimas nóminas válidas.' },
                { indicator: 'Sueldo medio mujeres', value: formatCurrency(safeNumber(summary.femaleAvgBruto)), hint: 'Promedio bruto estimado con las últimas nóminas válidas.' },
                { indicator: 'Diferencia absoluta', value: formatCurrency(safeNumber(summary.maleAvgBruto) - safeNumber(summary.femaleAvgBruto)), hint: 'Gap bruto en valor nominal.' },
                { indicator: 'Cobertura', value: rows.length, hint: 'Departamentos con comparación posible.' }
            ],
            'rose',
            context
        );

        addRankingSheet(
            workbook,
            'Detalle por depto',
            'Brecha salarial por departamento',
            'Comparativa departamental para detectar focos de desigualdad y desequilibrio de plantilla.',
            [
                { label: 'Departamentos', value: rows.length, hint: 'Áreas comparables' },
                { label: 'Mayor gap', value: formatPercent(Math.max(...rows.map((row: any) => safeNumber(row.gap)), 0)), hint: 'Pico departamental' },
                { label: 'Mayor media H', value: formatCurrency(Math.max(...rows.map((row: any) => safeNumber(row.maleAvg)), 0)), hint: 'Promedio bruto masculino más alto' },
                { label: 'Mayor media M', value: formatCurrency(Math.max(...rows.map((row: any) => safeNumber(row.femaleAvg)), 0)), hint: 'Promedio bruto femenino más alto' }
            ],
            [
                { header: 'Departamento', key: 'department', width: 24 },
                { header: 'Hombres', key: 'maleCount', width: 12, align: 'center' },
                { header: 'Mujeres', key: 'femaleCount', width: 12, align: 'center' },
                { header: 'Media H', key: 'maleAvg', width: 16, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Media M', key: 'femaleAvg', width: 16, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Gap', key: 'gap', width: 12, align: 'right', numFmt: '0.00%' }
            ],
            rows.map((row: any) => ({ ...row, gap: safeNumber(row.gap) / 100 })),
            'rose',
            context
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateObraSummaryReport(payload: {
        obras: any[];
        totalsByType: Record<string, number>;
        horasTotales: number;
        totalEmpleados: number;
        budgets: { budget: number; consumed: number };
    }, context: ExcelContext = {}) {
        const workbook = createWorkbook('Resumen de obras');
        const { obras, totalsByType, horasTotales, totalEmpleados, budgets } = payload;
        const totalGastos = Object.values(totalsByType || {}).reduce((a: number, b: any) => a + safeNumber(b), 0);
        const overBudget = budgets.consumed > budgets.budget;

        addRankingSheet(
            workbook,
            'Resumen ejecutivo',
            context.title || 'Resumen de obras',
            context.subtitle || 'Consolidado económico y operativo de las obras registradas en el sistema.',
            [
                { label: 'Obras', value: obras.length, hint: 'Proyectos contabilizados' },
                { label: 'Personas', value: totalEmpleados, hint: 'Empleados con imputación' },
                { label: 'Horas', value: formatNumber(horasTotales, 2), hint: 'Horas registradas en EmployeeProjectWork' },
                { label: 'Gasto total', value: formatCurrency(totalGastos), hint: 'Suma de todos los ObraExpense' },
                { label: 'Presupuesto', value: formatCurrency(budgets.budget), hint: 'Suma de presupuestos' },
                { label: '% consumido', value: budgets.budget > 0 ? formatPercent((budgets.consumed / budgets.budget) * 100) : '-', hint: 'Ratio gastos / presupuesto' }
            ],
            [
                { header: 'Tipo', key: 'type', width: 24 },
                { header: 'Importe', key: 'amount', width: 16, align: 'right', numFmt: '#,##0.00"€"' }
            ],
            Object.entries(totalsByType || {}).map(([type, amount]) => ({ type: TIPO_LABEL_ES[type] || type, amount: safeNumber(amount) })),
            overBudget ? 'rose' : 'blue',
            context,
            { type: 'TOTAL', amount: totalGastos }
        );

        addRankingSheet(
            workbook,
            'Detalle por obra',
            'Detalle por obra',
            'Una fila por obra con totales por tipo y consumo de presupuesto.',
            [
                { label: 'Obras activas', value: obras.filter((o: any) => o.status === 'ACTIVE').length, hint: 'Abiertas a imputaciones' },
                { label: 'Obras cerradas', value: obras.filter((o: any) => o.status === 'INACTIVE').length, hint: 'Cerradas (corregir aún permitido)' },
                { label: 'Gasto medio/obra', value: obras.length > 0 ? formatCurrency(totalGastos / obras.length) : '-', hint: 'Promedio' },
                { label: 'Horas medias/obra', value: obras.length > 0 ? formatNumber((horasTotales || 0) / obras.length, 2) : '-', hint: 'Promedio' }
            ],
            [
                { header: 'Código', key: 'code', width: 14 },
                { header: 'Obra', key: 'name', width: 32 },
                { header: 'Cliente', key: 'clientName', width: 22 },
                { header: 'Estado', key: 'status', width: 12, align: 'center' },
                { header: 'Dietas', key: 'perDiem', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Hospedaje', key: 'lodging', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Vuelo', key: 'flight', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Transporte', key: 'transport', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Otros', key: 'other', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Horas', key: 'hours', width: 12, align: 'right', numFmt: '#,##0.00' },
                { header: 'Presupuesto', key: 'budget', width: 16, align: 'right', numFmt: '#,##0.00"€"' },
                { header: '% consumido', key: 'pct', width: 14, align: 'right', numFmt: '0.0%' }
            ],
            obras.map((o: any) => {
                const totals: Record<string, number> = o.totals || {};
                const total = Object.values(totals).reduce((a: number, b: any) => a + safeNumber(b), 0);
                const budget = safeNumber(o.budget);
                return {
                    code: o.code,
                    name: o.name,
                    clientName: o.clientName || '-',
                    status: o.status === 'ACTIVE' ? 'Activa' : 'Cerrada',
                    perDiem: safeNumber(totals.PER_DIEM),
                    lodging: safeNumber(totals.LODGING),
                    flight: safeNumber(totals.FLIGHT),
                    transport: safeNumber(totals.TRANSPORT),
                    other: safeNumber(totals.OTHER),
                    hours: safeNumber(o.hours),
                    budget: budget || 0,
                    pct: budget > 0 ? total / budget : 0
                };
            }),
            overBudget ? 'rose' : 'blue',
            context
        );

        return workbook.xlsx.writeBuffer();
    }

    static async generateObraEmployeeReport(rows: any[], context: ExcelContext = {}) {
        const workbook = createWorkbook('Gastos de obra por empleado');
        const totalAmount = rows.reduce((sum: number, r: any) => sum + safeNumber(r.total), 0);
        const totalHours = rows.reduce((sum: number, r: any) => sum + safeNumber(r.hours), 0);
        const totalEmployees = rows.length;
        const obrasTouched = new Set(rows.map((r: any) => r.obraCode).filter(Boolean)).size;

        addRankingSheet(
            workbook,
            'Resumen',
            context.title || 'Gastos de obra por empleado',
            context.subtitle || 'Horas y gastos imputados por empleado dentro de las obras activas.',
            [
                { label: 'Personas', value: totalEmployees, hint: 'Empleados con imputaciones' },
                { label: 'Obras', value: obrasTouched, hint: 'Obras con al menos un apunte' },
                { label: 'Horas', value: formatNumber(totalHours, 2), hint: 'Total horas imputadas' },
                { label: 'Importe', value: formatCurrency(totalAmount), hint: 'Suma de ObraExpense' }
            ],
            [
                { header: 'Empleado', key: 'employee', width: 28 },
                { header: 'Obra', key: 'obra', width: 24 },
                { header: 'Horas', key: 'hours', width: 12, align: 'right', numFmt: '#,##0.00' },
                { header: 'Gasto total', key: 'total', width: 14, align: 'right', numFmt: '#,##0.00"€"' }
            ],
            rows.map((r: any) => ({
                employee: r.employee,
                obra: r.obra,
                hours: safeNumber(r.hours),
                total: safeNumber(r.total)
            }))
                .sort((a, b) => safeNumber(b.total) - safeNumber(a.total)),
            'emerald',
            context,
            { employee: 'TOTAL', obra: `${obrasTouched} obras`, hours: totalHours, total: totalAmount }
        );

        addRankingSheet(
            workbook,
            'Detalle por tipo',
            'Detalle por tipo de gasto',
            'Suma de importes por obra y tipo, para conciliar con informes de viajes.',
            [
                { label: 'Tipos', value: new Set(rows.flatMap((r: any) => Object.keys(r.byType || {}))).size, hint: 'Categorías distintas' },
                { label: 'Obras', value: obrasTouched, hint: 'Cubiertas' },
                { label: 'Total', value: formatCurrency(totalAmount), hint: 'Suma global' }
            ],
            [
                { header: 'Empleado', key: 'employee', width: 28 },
                { header: 'Obra', key: 'obra', width: 24 },
                { header: 'Dietas', key: 'PER_DIEM', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Hospedaje', key: 'LODGING', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Vuelo', key: 'FLIGHT', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Transporte', key: 'TRANSPORT', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Otros', key: 'OTHER', width: 14, align: 'right', numFmt: '#,##0.00"€"' },
                { header: 'Total', key: 'total', width: 14, align: 'right', numFmt: '#,##0.00"€"' }
            ],
            rows
                .map((r: any) => ({
                    employee: r.employee,
                    obra: r.obra,
                    PER_DIEM: safeNumber(r.byType?.PER_DIEM),
                    LODGING: safeNumber(r.byType?.LODGING),
                    FLIGHT: safeNumber(r.byType?.FLIGHT),
                    TRANSPORT: safeNumber(r.byType?.TRANSPORT),
                    OTHER: safeNumber(r.byType?.OTHER),
                    total: safeNumber(r.total)
                }))
                .sort((a, b) => safeNumber(b.total) - safeNumber(a.total)),
            'emerald',
            context
        );

        return workbook.xlsx.writeBuffer();
    }
}
