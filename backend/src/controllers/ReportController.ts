
import { Request, Response } from 'express';
import { ReportService } from '../services/ReportService';
import { ExcelService } from '../services/ExcelService';
import { createLogger } from '../services/LoggerService';

const log = createLogger('ReportController');

export class ReportController {
    /**
     * GET /api/reports/attendance
     * Fetches attendance data as JSON or Excel.
     */
    static async getAttendance(req: Request, res: Response) {
        try {
            const { start, end, format, companyId, department } = req.query;

            if (!start || !end) {
                return res.status(400).json({ error: 'Start and end dates are required' });
            }

            const startDate = new Date(start as string);
            const endDate = new Date(end as string);
            const maxRangeDays = 366;
            if ((endDate.getTime() - startDate.getTime()) > maxRangeDays * 24 * 60 * 60 * 1000) {
                return res.status(400).json({ error: `El rango máximo permitido es de ${maxRangeDays} días` });
            }
            const data = await ReportService.getAttendanceData(startDate, endDate, { companyId, department });

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateAttendanceReport(data);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=Reporte_Asistencia_${start}_${end}.xlsx`);
                return res.send(buffer);
            }

            res.json(data);
        } catch (error: any) {
            log.error({ error }, 'Attendance Report Error');
            res.status(500).json({ error: 'Failed to generate attendance report', details: error.message });
        }
    }

    /**
     * GET /api/reports/attendance-summary
     * Returns calculated daily hours and shift segments.
     */
    static async getAttendanceSummary(req: Request, res: Response) {
        try {
            const { start, end, companyId, employeeId } = req.query;

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
        } catch (error: any) {
            log.error({ error }, 'Attendance Summary Error');
            res.status(500).json({ error: 'Failed to calculate attendance summary', details: error.message });
        }
    }


    /**
     * GET /api/reports/overtime
     */
    static async getOvertime(req: Request, res: Response) {
        try {
            const { start, end, format, companyId, department } = req.query;

            if (!start || !end) {
                return res.status(400).json({ error: 'Start and end dates are required' });
            }

            const startDate = new Date(start as string);
            const endDate = new Date(end as string);
            const maxRangeDays = 366;
            if ((endDate.getTime() - startDate.getTime()) > maxRangeDays * 24 * 60 * 60 * 1000) {
                return res.status(400).json({ error: `El rango máximo permitido es de ${maxRangeDays} días` });
            }
            const data = await ReportService.getOvertimeData(startDate, endDate, { companyId, department });

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateOvertimeReport(data);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=Reporte_HorasExtra_${start}_${end}.xlsx`);
                return res.send(buffer);
            }

            res.json(data);
        } catch (error: any) {
            log.error({ error }, 'Overtime Report Error');
            res.status(500).json({ error: 'Failed to generate overtime report', details: error.message });
        }
    }

    /**
     * GET /api/reports/vacations
     */
    static async getVacations(req: Request, res: Response) {
        try {
            const { year, format, companyId, department } = req.query;
            const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

            const data = await ReportService.getVacationData(targetYear, { companyId, department });

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateVacationReport(data);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=Reporte_Vacaciones_${targetYear}.xlsx`);
                return res.send(buffer);
            }

            res.json(data);
        } catch (error: any) {
            log.error({ error }, 'Vacation Report Error');
            res.status(500).json({ error: 'Failed to generate vacation report', details: error.message });
        }
    }

    /**
     * GET /api/reports/costs
     */
    static async getCosts(req: Request, res: Response) {
        try {
            const { year, month, format, companyId } = req.query;
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
        } catch (error: any) {
            log.error({ error }, 'Cost Report Error');
            res.status(500).json({ error: 'Failed to generate cost report', details: error.message });
        }
    }

    /**
     * GET /api/reports/absences-detailed
     */
    static async getDetailedAbsences(req: Request, res: Response) {
        try {
            const { start, end, format, companyId, department } = req.query;

            if (!start || !end) {
                return res.status(400).json({ error: 'Start and end dates are required' });
            }

            const startDate = new Date(start as string);
            const endDate = new Date(end as string);
            const maxRangeDays = 366;
            if ((endDate.getTime() - startDate.getTime()) > maxRangeDays * 24 * 60 * 60 * 1000) {
                return res.status(400).json({ error: `El rango máximo permitido es de ${maxRangeDays} días` });
            }
            const data = await ReportService.getDetailedAbsenceData(startDate, endDate, { companyId, department });

            if (format === 'xlsx') {
                const buffer = await ExcelService.generateDetailedAbsenceReport(data);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=Reporte_Bajas_Detalle.xlsx`);
                return res.send(buffer);
            }

            res.json(data);
        } catch (error: any) {
            log.error({ error }, 'Detailed Absences Report Error');
            res.status(500).json({ error: 'Failed to generate detailed absences report', details: error.message });
        }
    }

    /**
     * GET /api/reports/kpis
     */
    static async getKPIs(req: Request, res: Response) {
        try {
            const { year, month, format, companyId } = req.query;
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
        } catch (error: any) {
            log.error({ error }, 'KPI Report Error');
            res.status(500).json({ error: 'Failed to generate KPI report', details: error.message });
        }
    }

    /**
     * GET /api/reports/gender-gap
     */
    static async getGenderGap(req: Request, res: Response) {
        try {
            const { companyId, year } = req.query;
            const data = await ReportService.getGenderGapData({ companyId, year });
            res.json(data);
        } catch (error: any) {
            log.error({ error }, 'Gender Gap Report Error');
            res.status(500).json({ error: 'Failed to generate gender gap report', details: error.message });
        }
    }
}
