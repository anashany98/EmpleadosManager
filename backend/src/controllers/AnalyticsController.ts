import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';
import { ApiResponse } from '../utils/ApiResponse';
import { createLogger } from '../services/LoggerService';
import { AuthenticatedRequest } from '../types/express';

const log = createLogger('AnalyticsController');

/**
 * Helper to get companyId with authorization check
 * Admins can query any company, non-admins are restricted to their own company
 */
const getAuthorizedCompanyId = (req: Request): string | undefined => {
    const user = (req as AuthenticatedRequest).user;
    const queryCompanyId = req.query.companyId as string | undefined;
    
    // If user is admin and specifies a companyId, allow it
    if (user?.role === 'admin' && queryCompanyId) {
        return queryCompanyId;
    }
    
    // Otherwise, use the user's own company
    return user?.companyId;
};

export const AnalyticsController = {
    /**
     * GET /api/analytics/kpis
     * Get main KPIs for the dashboard
     */
    getKPIs: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const companyId = getAuthorizedCompanyId(req);
            
            const kpis = await AnalyticsService.getMainKPIs({
                companyId
            });

            return ApiResponse.success(res, kpis);
        } catch (error) {
            log.error({ error }, 'Error fetching KPIs');
            next(error);
        }
    },

    /**
     * GET /api/analytics/trends/headcount
     * Get headcount trend over time
     */
    getHeadcountTrend: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const companyId = getAuthorizedCompanyId(req);
            const { months = '12' } = req.query;
            
            const trend = await AnalyticsService.getHeadcountTrend(
                parseInt(months as string) || 12,
                { companyId }
            );

            return ApiResponse.success(res, trend);
        } catch (error) {
            log.error({ error }, 'Error fetching headcount trend');
            next(error);
        }
    },

    /**
     * GET /api/analytics/departments
     * Get department breakdown
     */
    getDepartmentBreakdown: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const companyId = getAuthorizedCompanyId(req);
            
            const breakdown = await AnalyticsService.getDepartmentBreakdown({
                companyId
            });

            return ApiResponse.success(res, breakdown);
        } catch (error) {
            log.error({ error }, 'Error fetching department breakdown');
            next(error);
        }
    },

    /**
     * GET /api/analytics/heatmap/absences
     * Get absence heatmap data
     */
    getAbsenceHeatmap: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const companyId = getAuthorizedCompanyId(req);
            const { year = new Date().getFullYear().toString() } = req.query;
            
            const heatmap = await AnalyticsService.getAbsenceHeatmap(
                parseInt(year as string),
                { companyId }
            );

            return ApiResponse.success(res, heatmap);
        } catch (error) {
            log.error({ error }, 'Error fetching absence heatmap');
            next(error);
        }
    },

    /**
     * GET /api/analytics/hiring-funnel
     * Get hiring funnel data
     */
    getHiringFunnel: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const companyId = getAuthorizedCompanyId(req);
            
            const funnel = await AnalyticsService.getHiringFunnel({
                companyId
            });

            return ApiResponse.success(res, funnel);
        } catch (error) {
            log.error({ error }, 'Error fetching hiring funnel');
            next(error);
        }
    },

    /**
     * GET /api/analytics/trends/overtime
     * Get overtime trends
     */
    getOvertimeTrend: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const companyId = getAuthorizedCompanyId(req);
            const { months = '6' } = req.query;
            
            const trend = await AnalyticsService.getOvertimeTrend(
                parseInt(months as string) || 6,
                { companyId }
            );

            return ApiResponse.success(res, trend);
        } catch (error) {
            log.error({ error }, 'Error fetching overtime trend');
            next(error);
        }
    },

    /**
     * GET /api/analytics/tenure
     * Get tenure distribution
     */
    getTenureDistribution: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const companyId = getAuthorizedCompanyId(req);
            
            const distribution = await AnalyticsService.getTenureDistribution({
                companyId
            });

            return ApiResponse.success(res, distribution);
        } catch (error) {
            log.error({ error }, 'Error fetching tenure distribution');
            next(error);
        }
    },

    /**
     * GET /api/analytics/summary
     * Get complete analytics summary for dashboard
     */
    getSummary: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const companyId = getAuthorizedCompanyId(req);
            const filters = { companyId };

            // Fetch all data in parallel
            const [
                kpis,
                headcountTrend,
                departmentBreakdown,
                absenceHeatmap,
                hiringFunnel,
                overtimeTrend,
                tenureDistribution
            ] = await Promise.all([
                AnalyticsService.getMainKPIs(filters),
                AnalyticsService.getHeadcountTrend(12, filters),
                AnalyticsService.getDepartmentBreakdown(filters),
                AnalyticsService.getAbsenceHeatmap(new Date().getFullYear(), filters),
                AnalyticsService.getHiringFunnel(filters),
                AnalyticsService.getOvertimeTrend(6, filters),
                AnalyticsService.getTenureDistribution(filters)
            ]);

            return ApiResponse.success(res, {
                kpis,
                headcountTrend,
                departmentBreakdown,
                absenceHeatmap,
                hiringFunnel,
                overtimeTrend,
                tenureDistribution,
                generatedAt: new Date().toISOString()
            });
        } catch (error) {
            log.error({ error }, 'Error fetching analytics summary');
            next(error);
        }
    }
};

export default AnalyticsController;
