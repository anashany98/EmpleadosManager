
import { Request, Response } from 'express';
import { ReportService } from '../services/ReportService';
import { ExcelService } from '../services/ExcelService';
import { createLogger } from '../services/LoggerService';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';
import { resolveAuthorizedCompanyId } from '../utils/companyAccess';
import { AuditService, AuditAction, AuditEntity } from '../services/AuditService';

const log = createLogger('ReportController');

const getCompanyScope = (req: Request): string | undefined => {
    const user = (req as AuthenticatedRequest).user;
    return resolveAuthorizedCompanyId(user, req.query.companyId as string | undefined);
};

/**
 * Record report access in the audit log. Reports expose sensitive payroll
 * and HR data, so every successful access is logged with the report name,
 * period filters, format (json/xlsx), and resolved company scope.
 *
 * Failures to write the audit log are NOT propagated to the caller —
 * audit failures must not break the report response.
 */
const auditReportAccess = async (
    req: Request,
    reportName: string,
    filters: Record<string, unknown> = {},
    format: 'json' | 'xlsx' = 'json'
): Promise<void> => {
    const user = (req as AuthenticatedRequest).user;
    try {
        await AuditService.log(
            AuditAction.DATA_EXPORT,
            AuditEntity.PAYROLL,
            `report:${reportName}`,
            {
                report: reportName,
                format,
                ...filters,
                userEmail: user?.email
            },
            user?.id
        );
    } catch (auditError) {
        // Never let audit failures break the response.
        log.error({ auditError, reportName, userId: user?.id }, 'Failed to write report audit log');
    }
};

const buildExcelContext = (context: {
    title: string;
    subtitle: string;
    periodLabel?: string;
    companyId?: string;
    department?: string;
}) => ({
    title: context.title,
    subtitle: context.subtitle,
    periodLabel: context.periodLabel,
    filters: [
        context.companyId ? 'Empresa filtrada' : 'Todas las empresas',
        context.department ? `Departamento: ${context.department}` : 'Todos los departamentos'
    ]
});

const getErrorResponse = (error: unknown, fallbackMessage: string) => {
    if (error instanceof AppError) {
        return {
            status: error.statusCode,
            body: { error: error.message }
        };
    }

    return {
        status: 500,
        body: {
            error: fallbackMessage,
            details: error instanceof Error ? error.message : String(error)
        }
    };
};

export class ReportController {
    /**
     * GET /api/reports/attendance
     * Fetches attendance data as JSON or Excel.
     */
    static async getAttendance(req: Request, res: Response) {
        try {
            const { start, end, format, department } = req.query;
            const companyId = getCompanyScope(req);

            if (!start || !end) {
                return res.status(400).json({ error: 'Start and end dates are required' });
            }

            const startDate = new Date(start as string);
            const endDate = new Date(end as string);
            const maxRangeDays = 366;
            if ((endDate.getTime() - startDate.getTime()) > maxRangeDays * 24 * 60 * 60 * 1000) {
                return res.status(400).json({ error: `El rango máximo permitido es de ${maxRangeDays} días` });
            }
            const result = await ReportService.getAttendanceData(startDate, endDate, { companyId, department });
            const requestedFormat = (format as string) === 'xlsx' ? 'xlsx' : 'json';

            await auditReportAccess(req, 'attendance', {
                start, end, department, companyId, format: requestedFormat
            });

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateAttendanceReport(result.data, buildExcelContext({
                    title: 'Reporte de asistencia y fichajes',
                    subtitle: 'Exportación detallada para auditoría de marcajes y control horario.',
                    periodLabel: `${start} al ${end}`,
                    companyId,
                    department: department as string | undefined
                }));
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=Reporte_Asistencia_${start}_${end}.xlsx`);
                return res.send(buffer);
            }

            res.json(result.data);
        } catch (error) {
            log.error({ error }, 'Attendance Report Error');
            const { status, body } = getErrorResponse(error, 'Failed to generate attendance report');
            res.status(status).json(body);
        }
    }

    /**
     * GET /api/reports/attendance-summary
     * Returns calculated daily hours and shift segments.
     */
    static async getAttendanceSummary(req: Request, res: Response) {
        try {
            const { start, end, employeeId } = req.query;
            const companyId = getCompanyScope(req);

            if (!start || !end) {
                return res.status(400).json({ error: 'Start and end dates are required' });
            }

            const startDate = new Date(start as string);
            const endDate = new Date(end as string);

            const data = await ReportService.getAttendanceDailySummary(startDate, endDate, {
                companyId: companyId as string,
                employeeId: employeeId as string
            });

            await auditReportAccess(req, 'attendance-summary', {
                start, end, employeeId, companyId,
                format: req.query.format === 'xlsx' ? 'xlsx' : 'json'
            });

            if (req.query.format === 'xlsx') {
                const buffer = await ExcelService.generateAttendanceSummaryReport(data, buildExcelContext({
                    title: 'Resumen diario de asistencia',
                    subtitle: 'Consolidado ejecutivo de horas diarias y jornadas incompletas.',
                    periodLabel: `${start} al ${end}`,
                    companyId,
                    department: undefined
                }));
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=Resumen_Asistencia_${start}_${end}.xlsx`);
                return res.send(buffer);
            }

            res.json(data);
        } catch (error) {
            log.error({ error }, 'Attendance Summary Error');
            const { status, body } = getErrorResponse(error, 'Failed to calculate attendance summary');
            res.status(status).json(body);
        }
    }


    /**
     * GET /api/reports/overtime
     */
    static async getOvertime(req: Request, res: Response) {
        try {
            const { start, end, format, department } = req.query;
            const companyId = getCompanyScope(req);

            if (!start || !end) {
                return res.status(400).json({ error: 'Start and end dates are required' });
            }

            const startDate = new Date(start as string);
            const endDate = new Date(end as string);
            const maxRangeDays = 366;
            if ((endDate.getTime() - startDate.getTime()) > maxRangeDays * 24 * 60 * 60 * 1000) {
                return res.status(400).json({ error: `El rango máximo permitido es de ${maxRangeDays} días` });
            }
            const result = await ReportService.getOvertimeData(startDate, endDate, { companyId, department });
            const requestedFormat = (format as string) === 'xlsx' ? 'xlsx' : 'json';

            await auditReportAccess(req, 'overtime', {
                start, end, department, companyId, format: requestedFormat
            });

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateOvertimeReport(result.data, buildExcelContext({
                    title: 'Reporte de horas extra',
                    subtitle: 'Control económico y operativo de jornadas adicionales.',
                    periodLabel: `${start} al ${end}`,
                    companyId,
                    department: department as string | undefined
                }));
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=Reporte_HorasExtra_${start}_${end}.xlsx`);
                return res.send(buffer);
            }

            res.json(result.data);
        } catch (error) {
            log.error({ error }, 'Overtime Report Error');
            const { status, body } = getErrorResponse(error, 'Failed to generate overtime report');
            res.status(status).json(body);
        }
    }

    /**
     * GET /api/reports/vacations
     */
    static async getVacations(req: Request, res: Response) {
        try {
            const { year, format, department } = req.query;
            const companyId = getCompanyScope(req);
            const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
            const pagination = getPaginationParams(req);

            const result = await ReportService.getVacationData(targetYear, { companyId, department }, pagination);
            const requestedFormat = (format as string) === 'xlsx' ? 'xlsx' : 'json';

            await auditReportAccess(req, 'vacations', {
                year: targetYear, department, companyId, format: requestedFormat
            });

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateVacationReport(result.data, buildExcelContext({
                    title: 'Reporte de vacaciones',
                    subtitle: 'Saldo, consumo y riesgo de agotamiento por empleado.',
                    periodLabel: `Año ${targetYear}`,
                    companyId,
                    department: department as string | undefined
                }));
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=Reporte_Vacaciones_${targetYear}.xlsx`);
                return res.send(buffer);
            }

            if (pagination.isPaginationRequested) {
                const meta = buildPaginationMeta(result.total, pagination);
                return res.json({ data: result.data, meta });
            }
            res.json(result.data);
        } catch (error) {
            log.error({ error }, 'Vacation Report Error');
            const { status, body } = getErrorResponse(error, 'Failed to generate vacation report');
            res.status(status).json(body);
        }
    }

    /**
     * GET /api/reports/costs
     */
    static async getCosts(req: Request, res: Response) {
        try {
            const { year, month, format } = req.query;
            const user = (req as AuthenticatedRequest).user;
            const companyId = getCompanyScope(req);
            const isGlobalAdmin = !user?.companyId && user?.role === 'admin';
            const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
            const targetMonth = month ? parseInt(month as string) : undefined;

            // CRIT-001: pasamos el flag isGlobalAdmin explícito para que
            // el servicio use una cache key separada y NO aplique el
            // filtro de empresa al admin global.
            const data = await ReportService.getCompanyCostData(targetYear, targetMonth, {
                companyId: companyId ?? null,
                isGlobalAdmin
            });
            const requestedFormat = (format as string) === 'xlsx' ? 'xlsx' : 'json';

            await auditReportAccess(req, 'costs', {
                year: targetYear, month: targetMonth, companyId, format: requestedFormat
            });

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateCostReport(data, buildExcelContext({
                    title: 'Reporte de costes de personal',
                    subtitle: 'Visión de coste empresa basada en nómina consolidada.',
                    periodLabel: targetMonth ? `${targetMonth}/${targetYear}` : `Año ${targetYear}`,
                    companyId
                }));
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=Reporte_Costes_${targetYear}_${targetMonth || 'Total'}.xlsx`);
                return res.send(buffer);
            }

            res.json(data);
        } catch (error) {
            log.error({ error }, 'Cost Report Error');
            const { status, body } = getErrorResponse(error, 'Failed to generate cost report');
            res.status(status).json(body);
        }
    }

    /**
     * GET /api/reports/absences-detailed
     */
    static async getDetailedAbsences(req: Request, res: Response) {
        try {
            const { start, end, format, department } = req.query;
            const companyId = getCompanyScope(req);

            if (!start || !end) {
                return res.status(400).json({ error: 'Start and end dates are required' });
            }

            const startDate = new Date(start as string);
            const endDate = new Date(end as string);
            const maxRangeDays = 366;
            if ((endDate.getTime() - startDate.getTime()) > maxRangeDays * 24 * 60 * 60 * 1000) {
                return res.status(400).json({ error: `El rango máximo permitido es de ${maxRangeDays} días` });
            }
            const pagination = getPaginationParams(req);
            const result = await ReportService.getDetailedAbsenceData(startDate, endDate, { companyId, department }, pagination);
            const requestedFormat = (format as string) === 'xlsx' ? 'xlsx' : 'json';

            await auditReportAccess(req, 'absences-detailed', {
                start, end, department, companyId, format: requestedFormat
            });

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateDetailedAbsenceReport(result.data, buildExcelContext({
                    title: 'Reporte detallado de ausencias',
                    subtitle: 'Bajas, incidencias y suspensiones con contexto operativo.',
                    periodLabel: `${start} al ${end}`,
                    companyId,
                    department: department as string | undefined
                }));
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=Reporte_Bajas_Detalle.xlsx`);
                return res.send(buffer);
            }

            if (pagination.isPaginationRequested) {
                const meta = buildPaginationMeta(result.total, pagination);
                return res.json({ data: result.data, meta });
            }
            res.json(result.data);
        } catch (error) {
            log.error({ error }, 'Detailed Absences Report Error');
            const { status, body } = getErrorResponse(error, 'Failed to generate detailed absences report');
            res.status(status).json(body);
        }
    }

    /**
     * GET /api/reports/kpis
     */
    static async getKPIs(req: Request, res: Response) {
        try {
            const { year, month, format } = req.query;
            const companyId = getCompanyScope(req);
            const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
            const targetMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;

            const summary = await ReportService.getKPIMetrics(targetYear, targetMonth, { companyId });
            const deptStats = await ReportService.getAbsenteeismByDepartment(targetYear, targetMonth, { companyId });
            const requestedFormat = (format as string) === 'xlsx' ? 'xlsx' : 'json';

            await auditReportAccess(req, 'kpis', {
                year: targetYear, month: targetMonth, companyId, format: requestedFormat
            });

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateKPIReport(summary, deptStats, buildExcelContext({
                    title: 'KPIs de organización',
                    subtitle: 'Cuadro de mando de estructura, rotación y absentismo.',
                    periodLabel: `${targetMonth}/${targetYear}`,
                    companyId
                }));
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=Reporte_KPIs_${targetYear}_${targetMonth}.xlsx`);
                return res.send(buffer);
            }

            res.json({ summary, deptStats });
        } catch (error) {
            log.error({ error }, 'KPI Report Error');
            const { status, body } = getErrorResponse(error, 'Failed to generate KPI report');
            res.status(status).json(body);
        }
    }

    /**
     * GET /api/reports/gender-gap
     */
    static async getGenderGap(req: Request, res: Response) {
        try {
            const { year, format } = req.query;
            const companyId = getCompanyScope(req);
            const data = await ReportService.getGenderGapData({ companyId, year });
            const requestedFormat = (format as string) === 'xlsx' ? 'xlsx' : 'json';

            await auditReportAccess(req, 'gender-gap', {
                year, companyId, format: requestedFormat
            });

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateGenderGapReport(data, buildExcelContext({
                    title: 'Reporte de igualdad y diversidad',
                    subtitle: 'Seguimiento de brecha salarial y distribución de plantilla.',
                    periodLabel: year ? `Año ${year}` : 'Últimos 12 meses de nómina válida',
                    companyId
                }));
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=Reporte_Igualdad_${year || 'actual'}.xlsx`);
                return res.send(buffer);
            }

            res.json(data);
        } catch (error) {
            log.error({ error }, 'Gender Gap Report Error');
            const { status, body } = getErrorResponse(error, 'Failed to generate gender gap report');
            res.status(status).json(body);
        }
    }

    /**
     * GET /api/reports/vacations/usage-by-department
     */
    static async getVacationUsageByDepartment(req: Request, res: Response) {
        try {
            const { year } = req.query;
            const companyId = getCompanyScope(req);
            const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

            const data = await ReportService.getUsageByDepartment(targetYear, { companyId });

            await auditReportAccess(req, 'vacations-usage-by-department', {
                year: targetYear, companyId
            });

            res.json(data);
        } catch (error) {
            log.error({ error }, 'Vacation Usage By Department Error');
            const { status, body } = getErrorResponse(error, 'Failed to generate vacation usage by department report');
            res.status(status).json(body);
        }
    }

    /**
     * GET /api/reports/obras
     * Aggregated hours + expenses per obra with budget consumption.
     * Filters: status, from, to, format
     */
    static async getObras(req: Request, res: Response) {
        try {
            const { status, from, to, format } = req.query;
            const companyId = getCompanyScope(req);
            const filters: any = {
                status: status ? String(status) : undefined,
                from: from ? new Date(String(from)) : undefined,
                to: to ? new Date(String(to)) : undefined
            };
            const requestedFormat = (format as string) === 'xlsx' ? 'xlsx' : 'json';

            const data = await ReportService.getObraSummary(filters);

            await auditReportAccess(req, 'obras', {
                status, from, to, companyId, format: requestedFormat
            });

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateObraSummaryReport(data, buildExcelContext({
                    title: 'Resumen de obras',
                    subtitle: 'Horas, gastos y consumo de presupuesto por obra.',
                    periodLabel: filters.from && filters.to ? `Del ${String(from)} al ${String(to)}` : 'Histórico completo',
                    companyId
                }));
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Obras.xlsx');
                return res.send(buffer);
            }

            res.json(data);
        } catch (error) {
            log.error({ error }, 'Obras Report Error');
            const { status, body } = getErrorResponse(error, 'Failed to generate obras report');
            res.status(status).json(body);
        }
    }

    /**
     * GET /api/reports/obras/employees
     * Per-employee breakdown of hours + expenses across obras.
     * Filters: from, to, format
     */
    static async getObraEmployees(req: Request, res: Response) {
        try {
            const { from, to, format } = req.query;
            const companyId = getCompanyScope(req);
            const filters: any = {
                from: from ? new Date(String(from)) : undefined,
                to: to ? new Date(String(to)) : undefined
            };
            const requestedFormat = (format as string) === 'xlsx' ? 'xlsx' : 'json';

            const data = await ReportService.getObraEmployeeBreakdown(filters);

            await auditReportAccess(req, 'obras-employees', {
                from, to, companyId, format: requestedFormat
            });

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateObraEmployeeReport(data, buildExcelContext({
                    title: 'Gastos de obra por empleado',
                    subtitle: 'Horas y gastos imputados por empleado dentro de las obras.',
                    periodLabel: filters.from && filters.to ? `Del ${String(from)} al ${String(to)}` : 'Histórico completo',
                    companyId
                }));
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Obras_Por_Empleado.xlsx');
                return res.send(buffer);
            }

            res.json(data);
        } catch (error) {
            log.error({ error }, 'Obra Employees Report Error');
            const { status, body } = getErrorResponse(error, 'Failed to generate obra-employees report');
            res.status(status).json(body);
        }
    }
}
