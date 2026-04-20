import { AttendanceReportService } from './AttendanceReportService';
import { OvertimeReportService } from './OvertimeReportService';
import { VacationReportService } from './VacationReportService';
import { CostReportService } from './CostReportService';
import { HRMetricsService } from './HRMetricsService';

/**
 * Unified ReportService that delegates to focused sub-services.
 * Maintains the same static method API for backward compatibility.
 */
export class ReportService {
    static getAttendanceData = AttendanceReportService.getAttendanceData;
    static getAttendanceDailySummary = AttendanceReportService.getAttendanceDailySummary;
    static getOvertimeData = OvertimeReportService.getOvertimeData;
    static getVacationData = VacationReportService.getVacationData;
    static getDetailedAbsenceData = VacationReportService.getDetailedAbsenceData;
    static getCompanyCostData = CostReportService.getCompanyCostData;
    static getKPIMetrics = HRMetricsService.getKPIMetrics;
    static getAbsenteeismByDepartment = HRMetricsService.getAbsenteeismByDepartment;
    static getGenderGapData = HRMetricsService.getGenderGapData;
}

// Re-export individual services for direct access if needed
export { AttendanceReportService } from './AttendanceReportService';
export { OvertimeReportService } from './OvertimeReportService';
export { VacationReportService } from './VacationReportService';
export { CostReportService } from './CostReportService';
export { HRMetricsService } from './HRMetricsService';
