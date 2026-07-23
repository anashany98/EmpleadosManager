import { prisma } from '../../lib/prisma';
import { CacheService } from '../CacheService';
import { CacheKeys } from '../../utils/cacheKeys';
import { EncryptionService } from '../EncryptionService';

// Cache TTL in seconds - 10 minutes since cost data is relatively stable
const COST_CACHE_TTL = 600;

/**
 * Marker usado en la clave de caché para admin global. Lo
 * prefijamos con `__` para que NUNCA coincida con un companyId
 * válido aunque un admin de empresa lo introduzca por error.
 */
const GLOBAL_SCOPE_KEY = '__global__';

export class CostReportService {
    /**
     * Devuelve los costes agregados por empleado.
     *
     * `companyId`:
     *   - string  -> filtra por empresa (vía createdBy.employee.companyId
     *                en `payrollImportBatch` y post-filtro defensivo en
     *                los empleados que llegan del `groupBy`).
     *   - null/undefined -> solo permitido a admin global. Usa una
     *                clave de caché separada para no contaminar la de
     *                los tenants.
     */
    static async getCompanyCostData(
        year: number,
        month: number | undefined,
        filters: { companyId?: string | null; isGlobalAdmin?: boolean } = {}
    ) {
        const isGlobal = !!filters.isGlobalAdmin;
        const companyId = isGlobal ? null : (filters.companyId ?? null);

        if (!isGlobal && !companyId) {
            // Usuario no global sin tenant: nunca devolver datos.
            // El caller (controller) ya debería haberlo bloqueado, pero
            // añadimos una salvaguarda aquí también.
            return [];
        }

        const cacheScope = companyId ?? GLOBAL_SCOPE_KEY;
        const cacheKey = CacheKeys.costs(cacheScope, year, month);

        return CacheService.wrap(
            cacheKey,
            async () => this.computeCompanyCostData(year, month, { companyId, isGlobalAdmin: isGlobal }),
            COST_CACHE_TTL
        );
    }

    /**
     * Calcula los datos de coste (se llama en cache miss).
     *
     * Defensa en profundidad:
     *   1) `whereBatch` exige `createdBy.employee.companyId` cuando hay
     *      un tenant activo. Esto descarta los batches de otros tenants
     *      ANTES de llegar al `groupBy`.
     *   2) Post-filtro: cada empleado del `groupBy` se cruza con su
     *      `companyId` cargado en la segunda query. Si por cualquier
     *      inconsistencia (datos huérfanos, batches con `createdBy` sin
     *      `employee`, etc.) el `companyId` no coincide, se descarta
     *      ANTES de descifrar el DNI.
     */
    private static async computeCompanyCostData(
        year: number,
        month?: number,
        filters: { companyId?: string | null; isGlobalAdmin?: boolean } = {}
    ) {
        const isGlobal = !!filters.isGlobalAdmin;
        const companyId = isGlobal ? null : (filters.companyId ?? null);

        const whereBatch: any = { year };
        if (month) whereBatch.month = month;
        if (companyId) {
            whereBatch.createdBy = { employee: { companyId } };
        }

        // 1. Batches del periodo (filtrados por tenant si aplica)
        const batches = await prisma.payrollImportBatch.findMany({
            where: whereBatch,
            select: { id: true }
        });
        const batchIds = batches.map(b => b.id);
        if (batchIds.length === 0) return [];

        // 2. Agregados por empleado
        const aggregatedCosts = await prisma.payrollRow.groupBy({
            by: ['employeeId'],
            where: { batchId: { in: batchIds } },
            _sum: {
                bruto: true,
                ssEmpresa: true,
                ssTrabajador: true,
                irpf: true,
                neto: true
            }
        });

        const employeeIds = aggregatedCosts
            .map(c => c.employeeId)
            .filter((id): id is string => id !== null);

        if (employeeIds.length === 0) return [];

        // 3. Detalle de empleados, con `companyId` para el post-filtro
        const employees = await prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            select: { id: true, name: true, dni: true, department: true, companyId: true }
        });
        const employeeMap = new Map(employees.map(e => [e.id, e]));

        // 4. Formateo con post-filtro defensivo
        const rows = [];
        for (const cost of aggregatedCosts) {
            if (!cost.employeeId) continue;
            const emp = employeeMap.get(cost.employeeId);
            if (!emp) continue;

            // Defensa en profundidad: si por inconsistencia el
            // empleado no pertenece al tenant solicitado, lo
            // descartamos sin descifrar el DNI.
            if (companyId && emp.companyId !== companyId) {
                continue;
            }

            const bruto = Number(cost._sum.bruto || 0);
            const ssEmpresa = Number(cost._sum.ssEmpresa || 0);

            rows.push({
                name: emp.name || 'Desconocido',
                dni: EncryptionService.decrypt(emp.dni) || '-',
                department: emp.department || '-',
                bruto,
                ssEmpresa,
                ssTrabajador: Number(cost._sum.ssTrabajador || 0),
                irpf: Number(cost._sum.irpf || 0),
                neto: Number(cost._sum.neto || 0),
                totalCost: bruto + ssEmpresa
            });
        }
        return rows;
    }
}
