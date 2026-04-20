import { prisma } from '../../lib/prisma';
import { CacheService } from '../CacheService';
import { CacheKeys } from '../../utils/cacheKeys';

// Cache TTL in seconds - 10 minutes since cost data is relatively stable
const COST_CACHE_TTL = 600;

export class CostReportService {
    /**
     * Gets total company cost (Salary + SS Empresa) from payroll data, optimized with aggregation.
     * Results are cached per company/year/month.
     */
    static async getCompanyCostData(year: number, month?: number, filters: any = {}) {
        const companyId = filters.companyId || 'global';
        const cacheKey = CacheKeys.costs(companyId, year, month);

        return CacheService.wrap(cacheKey, async () => {
            return this.computeCompanyCostData(year, month, filters);
        }, COST_CACHE_TTL);
    }

    /**
     * Computes the actual cost data (called on cache miss).
     */
    private static async computeCompanyCostData(year: number, month?: number, filters: any = {}) {
        const whereBatch: any = { year };
        if (month) whereBatch.month = month;

        // 1. Get Batches IDs for the period
        const batches = await prisma.payrollImportBatch.findMany({
            where: whereBatch,
            select: { id: true }
        });
        const batchIds = batches.map(b => b.id);

        if (batchIds.length === 0) return [];

        // 2. Aggregate costs by Employee using Prisma groupBy
        const aggregatedCosts = await prisma.payrollRow.groupBy({
            by: ['employeeId'],
            where: {
                batchId: { in: batchIds }
            },
            _sum: {
                bruto: true,
                ssEmpresa: true,
                ssTrabajador: true,
                irpf: true,
                neto: true
            }
        });

        // 3. Enrich with Employee details
        // We need to fetch employee details manually since groupBy doesn't support 'include'
        const employeeIds = aggregatedCosts.map(c => c.employeeId).filter(id => id !== null) as string[];
        const employees = await prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            select: { id: true, name: true, dni: true, department: true }
        });

        const employeeMap = new Map(employees.map(e => [e.id, e]));

        // 4. Format Result
        return aggregatedCosts.map(cost => {
            const emp = cost.employeeId ? employeeMap.get(cost.employeeId) : null;
            const bruto = Number(cost._sum.bruto || 0);
            const ssEmpresa = Number(cost._sum.ssEmpresa || 0);

            return {
                name: emp?.name || 'Desconocido',
                dni: emp?.dni || '-',
                department: emp?.department || '-',
                bruto,
                ssEmpresa,
                ssTrabajador: Number(cost._sum.ssTrabajador || 0),
                irpf: Number(cost._sum.irpf || 0),
                neto: Number(cost._sum.neto || 0),
                totalCost: bruto + ssEmpresa
            };
        });
    }
}
