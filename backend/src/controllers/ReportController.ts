
import { Request, Response } from 'express';
import { ReportService } from '../services/ReportService';
import { ExcelService } from '../services/ExcelService';
import { createLogger } from '../services/LoggerService';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';
import { resolveAuthorizedCompanyId } from '../utils/companyAccess';

const log = createLogger('ReportController');

const getCompanyScope = (req: Request): string | undefined => {
    const user = (req as AuthenticatedRequest).user;
    return resolveAuthorizedCompanyId(user, req.query.companyId as string | undefined);
};

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
            details: error instanceof Error ? error.message : undefined
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

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateAttendanceReport(result.data);
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

            if (req.query.format === 'xlsx') {
                const buffer = await ExcelService.generateAttendanceSummaryReport(data);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=Resumen_Asistencia.xlsx`);
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

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateOvertimeReport(result.data);
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

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateVacationReport(result.data);
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
            const companyId = getCompanyScope(req);
            const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
            const targetMonth = month ? parseInt(month as string) : undefined;

            const data = await ReportService.getCompanyCostData(targetYear, targetMonth, { companyId });

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateCostReport(data);
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

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateDetailedAbsenceReport(result.data);
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

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateKPIReport(summary, deptStats);
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
            const { year } = req.query;
            const companyId = getCompanyScope(req);
            const data = await ReportService.getGenderGapData({ companyId, year });
            res.json(data);
        } catch (error) {
            log.error({ error }, 'Gender Gap Report Error');
            const { status, body } = getErrorResponse(error, 'Failed to generate gender gap report');
            res.status(status).json(body);
        }
    }
}
