/**
 * Utility for building consistent cache keys.
 * Provides type-safe key construction for the caching layer.
 */

/**
 * Builds a cache key from a prefix and variable number of parts.
 * Parts are joined with colons and normalized.
 *
 * @example
 * buildKey('employees', 'comp123', '1', '50') => 'employees:comp123:1:50'
 * buildKey('attendance', 'comp123', '2025-01-01', '2025-12-31') => 'attendance:comp123:2025-01-01:2025-12-31'
 * buildKey('kpis', 'comp123', '2025', '4') => 'kpis:comp123:2025:4'
 */
export function buildCacheKey(prefix: string, ...parts: (string | number | undefined | null)[]): string {
    const normalizedParts = parts
        .filter((part): part is string | number => part !== undefined && part !== null)
        .map(part => String(part));

    return [prefix, ...normalizedParts].join(':');
}

/**
 * Cache key builders for different data types.
 * These provide semantic key construction with proper prefixes.
 */
export const CacheKeys = {
    /**
     * KPI metrics for a specific period.
     * Pattern: kpis:{companyId}:{year}:{month}
     */
    kpis: (companyId: string, year: number, month: number) =>
        buildCacheKey('kpis', companyId, String(year), String(month)),

    /**
     * Absenteeism by department for a specific period.
     * Pattern: absenteeism:{companyId}:{year}:{month}
     */
    absenteeism: (companyId: string, year: number, month: number) =>
        buildCacheKey('absenteeism', companyId, String(year), String(month)),

    /**
     * Attendance data for a date range.
     * Pattern: attendance:{companyId}:{startDate}:{endDate}
     */
    attendance: (companyId: string, startDate: string, endDate: string) =>
        buildCacheKey('attendance', companyId, startDate, endDate),

    /**
     * Cost report data for a period.
     * Pattern: costs:{companyId}:{year}:{month}
     */
    costs: (companyId: string, year: number, month?: number) =>
        buildCacheKey('costs', companyId, String(year), month ? String(month) : 'all'),

    /**
     * Vacation data for a year.
     * Pattern: vacations:{companyId}:{year}
     */
    vacations: (companyId: string, year: number) =>
        buildCacheKey('vacations', companyId, String(year)),

    /**
     * Employee list for a company.
     * Pattern: employees:{companyId}
     */
    employees: (companyId: string) =>
        buildCacheKey('employees', companyId),

    /**
     * Gender gap analysis data.
     * Pattern: genderGap:{companyId}
     */
    genderGap: (companyId: string) =>
        buildCacheKey('genderGap', companyId),

    /**
     * Department stats.
     * Pattern: deptStats:{companyId}
     */
    deptStats: (companyId: string) =>
        buildCacheKey('deptStats', companyId),
};
