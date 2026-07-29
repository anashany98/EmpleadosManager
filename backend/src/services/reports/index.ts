import { AttendanceReportService } from './AttendanceReportService';
import { OvertimeReportService } from './OvertimeReportService';
import { VacationReportService } from './VacationReportService';
import { CostReportService } from './CostReportService';
import { HRMetricsService } from './HRMetricsService';
import { ObraReportService } from './ObraReportService';
import { PRLReportService } from './PRLReportService';
import { TerminationReportService } from './TerminationReportService';

/**
 * Unified ReportService that delegates to focused sub-services.
 * Uses arrow wrappers so that `this` inside the sub-service methods
 * still refers to the original class (required for private static calls).
 */
export class ReportService {
    static getAttendanceData = (...args: Parameters<typeof AttendanceReportService.getAttendanceData>) => AttendanceReportService.getAttendanceData(...args);
    static getAttendanceDailySummary = (...args: Parameters<typeof AttendanceReportService.getAttendanceDailySummary>) => AttendanceReportService.getAttendanceDailySummary(...args);
    static getAttendanceByEmployee = (...args: Parameters<typeof AttendanceReportService.getAttendanceByEmployee>) => AttendanceReportService.getAttendanceByEmployee(...args);
    static getOvertimeData = (...args: Parameters<typeof OvertimeReportService.getOvertimeData>) => OvertimeReportService.getOvertimeData(...args);
    static getVacationData = (...args: Parameters<typeof VacationReportService.getVacationData>) => VacationReportService.getVacationData(...args);
    static getDetailedAbsenceData = (...args: Parameters<typeof VacationReportService.getDetailedAbsenceData>) => VacationReportService.getDetailedAbsenceData(...args);
    static getAbsencesByDepartment = (...args: Parameters<typeof VacationReportService.getAbsencesByDepartment>) => VacationReportService.getAbsencesByDepartment(...args);
    static getUsageByDepartment = (...args: Parameters<typeof VacationReportService.getUsageByDepartment>) => VacationReportService.getUsageByDepartment(...args);
    static getCompanyCostData = (...args: Parameters<typeof CostReportService.getCompanyCostData>) => CostReportService.getCompanyCostData(...args);
    static getKPIMetrics = (...args: Parameters<typeof HRMetricsService.getKPIMetrics>) => HRMetricsService.getKPIMetrics(...args);
    static getAbsenteeismByDepartment = (...args: Parameters<typeof HRMetricsService.getAbsenteeismByDepartment>) => HRMetricsService.getAbsenteeismByDepartment(...args);
    static getGenderGapData = (...args: Parameters<typeof HRMetricsService.getGenderGapData>) => HRMetricsService.getGenderGapData(...args);
    static getObraSummary = (...args: Parameters<typeof ObraReportService.getObraSummary>) => ObraReportService.getObraSummary(...args);
    static getObraEmployeeBreakdown = (...args: Parameters<typeof ObraReportService.getObraEmployeeBreakdown>) => ObraReportService.getObraEmployeeBreakdown(...args);
    static getMedicalReviewsReport = (...args: Parameters<typeof PRLReportService.getMedicalReviewsReport>) => PRLReportService.getMedicalReviewsReport(...args);
    static getTrainingsReport = (...args: Parameters<typeof PRLReportService.getTrainingsReport>) => PRLReportService.getTrainingsReport(...args);
    static getMonthlyTerminations = (...args: Parameters<typeof TerminationReportService.getMonthlyTerminations>) => TerminationReportService.getMonthlyTerminations(...args);
}

// Re-export individual services for direct access if needed
export { AttendanceReportService } from './AttendanceReportService';
export { OvertimeReportService } from './OvertimeReportService';
export { VacationReportService } from './VacationReportService';
export { CostReportService } from './CostReportService';
export { HRMetricsService } from './HRMetricsService';
export { ObraReportService } from './ObraReportService';
export { PRLReportService } from './PRLReportService';
export { TerminationReportService } from './TerminationReportService';
