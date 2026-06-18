import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha debe ser YYYY-MM-DD");
const dateRangeObject = z.object({
    startDate: isoDate.optional(),
    endDate: isoDate.optional()
});

/**
 * Schemas for the report endpoints. The body is empty for GET requests
 * (params in query), so we only validate the query string.
 */

const baseQuery = {
    companyId: z.string().uuid().optional(),
    department: z.string().max(100).optional()
};

export const attendanceReportQuerySchema = z.object({
    query: z.object({ ...dateRangeObject.shape, ...baseQuery })
});

export const attendanceSummaryQuerySchema = z.object({
    query: z.object({ ...dateRangeObject.shape, companyId: z.string().uuid().optional() })
});

export const overtimeReportQuerySchema = attendanceReportQuerySchema;
export const vacationsReportQuerySchema = attendanceReportQuerySchema;
export const vacationUsageQuerySchema = attendanceReportQuerySchema;
export const costsReportQuerySchema = attendanceReportQuerySchema;
export const detailedAbsencesQuerySchema = attendanceReportQuerySchema;
export const kpisReportQuerySchema = attendanceReportQuerySchema;
export const genderGapQuerySchema = attendanceReportQuerySchema;
