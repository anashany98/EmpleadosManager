import { prisma } from '../../lib/prisma';
import { CacheService } from '../CacheService';

const OBRA_REPORT_CACHE_TTL = 300;

export class ObraReportService {
    static async getObraSummary(filters: { from?: Date; to?: Date; status?: string } = {}) {
        const cacheKey = `report:obra-summary:${filters.status || 'ALL'}:${filters.from?.toISOString() || ''}:${filters.to?.toISOString() || ''}`;
        return CacheService.wrap(cacheKey, async () => {
            const whereObra: any = {};
            if (filters.status === 'ACTIVE' || filters.status === 'INACTIVE') {
                whereObra.status = filters.status;
            }

            const obras = await prisma.project.findMany({
                where: whereObra,
                include: {
                    manager: { select: { id: true, name: true, firstName: true, lastName: true } },
                    _count: { select: { employeeWork: true, expenses: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
            if (obras.length === 0) {
                return { obras: [], totalsByType: {}, horasTotales: 0, totalEmpleados: 0, budgets: { budget: 0, consumed: 0 } };
            }

            const obraIds = obras.map((o) => o.id);

            const expenseWhere: any = { obraId: { in: obraIds } };
            if (filters.from || filters.to) {
                expenseWhere.date = {};
                if (filters.from) expenseWhere.date.gte = filters.from;
                if (filters.to) expenseWhere.date.lte = filters.to;
            }

            const horasWhere: any = { projectId: { in: obraIds } };
            if (filters.from || filters.to) {
                horasWhere.AND = [
                    ...(filters.from ? [{ endDate: { gte: filters.from } }] : []),
                    ...(filters.to ? [{ startDate: { lte: filters.to } }] : [])
                ];
            }

            const [totalsByTypeRaw, horasRaw, empleadosRaw] = await Promise.all([
                prisma.obraExpense.groupBy({
                    by: ['obraId', 'type'],
                    where: expenseWhere,
                    _sum: { amount: true }
                }),
                prisma.employeeProjectWork.groupBy({
                    by: ['projectId'],
                    where: horasWhere,
                    _sum: { hours: true }
                }),
                prisma.employeeProjectWork.findMany({
                    where: horasWhere,
                    select: { projectId: true, employeeId: true },
                    distinct: ['projectId', 'employeeId']
                })
            ]);

            const totalsByType: Record<string, number> = {};
            for (const row of totalsByTypeRaw) {
                totalsByType[row.type] = Number(totalsByType[row.type] || 0) + Number(row._sum.amount || 0);
            }

            const horasByObra: Record<string, number> = {};
            for (const h of horasRaw) {
                horasByObra[h.projectId] = Number(h._sum.hours || 0);
            }

            const empleadosByObra: Record<string, Set<string>> = {};
            for (const e of empleadosRaw) {
                if (!empleadosByObra[e.projectId]) empleadosByObra[e.projectId] = new Set();
                empleadosByObra[e.projectId].add(e.employeeId);
            }

            const enrichedObras = obras.map((o: any) => {
                const consumed = (totalsByTypeRaw || [])
                    .filter((t) => t.obraId === o.id)
                    .reduce((acc, t) => acc + Number(t._sum.amount || 0), 0);
                return {
                    ...o,
                    hours: horasByObra[o.id] || 0,
                    empleadosCount: empleadosByObra[o.id]?.size || 0,
                    consumed
                };
            });

            const totalEmpleados = new Set(empleadosRaw.map((e) => e.employeeId)).size;
            const horasTotales = enrichedObras.reduce((acc, o) => acc + Number(o.hours || 0), 0);
            const budgets = enrichedObras.reduce(
                (acc, o) => ({
                    budget: acc.budget + Number(o.budget || 0),
                    consumed: acc.consumed + Number(o.consumed || 0)
                }),
                { budget: 0, consumed: 0 }
            );

            return { obras: enrichedObras, totalsByType, horasTotales, totalEmpleados, budgets };
        }, OBRA_REPORT_CACHE_TTL);
    }

    static async getObraEmployeeBreakdown(filters: { from?: Date; to?: Date } = {}) {
        const cacheKey = `report:obra-employee:${filters.from?.toISOString() || ''}:${filters.to?.toISOString() || ''}`;
        return CacheService.wrap(cacheKey, async () => {
            const employeeWhere: any = {};
            if (filters.from || filters.to) {
                employeeWhere.date = {};
                if (filters.from) employeeWhere.date.gte = filters.from;
                if (filters.to) employeeWhere.date.lte = filters.to;
            }

            const workWhere: any = {};
            if (filters.from || filters.to) {
                workWhere.AND = [
                    ...(filters.from ? [{ endDate: { gte: filters.from } }] : []),
                    ...(filters.to ? [{ startDate: { lte: filters.to } }] : [])
                ];
            }

            const [expenses, hours] = await Promise.all([
                prisma.obraExpense.findMany({
                    where: employeeWhere,
                    include: {
                        obra: { select: { id: true, code: true, name: true } },
                        employee: { select: { id: true, name: true, firstName: true, lastName: true, dni: true } },
                        contractor: { select: { id: true, name: true } }
                    }
                }),
                prisma.employeeProjectWork.findMany({
                    where: workWhere,
                    include: {
                        project: { select: { id: true, code: true, name: true } },
                        employee: { select: { id: true, name: true, firstName: true, lastName: true, dni: true } }
                    }
                })
            ]);

            const keyOf = (eId: string | null | undefined, oId: string | null | undefined) => `${eId || '_'}::${oId || '_'}`;

            type Row = {
                employeeId: string | null;
                obraId: string | null;
                employee: string;
                obra: string;
                obraCode: string;
                hours: number;
                total: number;
                byType: Record<string, number>;
            };

            const map = new Map<string, Row>();

            const upsert = (employeeId: string | null, employeeName: string, obraId: string | null, obraCode: string, obraName: string) => {
                const k = keyOf(employeeId, obraId);
                if (!map.has(k)) {
                    map.set(k, {
                        employeeId,
                        obraId,
                        employee: employeeName,
                        obra: obraName,
                        obraCode,
                        hours: 0,
                        total: 0,
                        byType: {}
                    });
                }
                return map.get(k)!;
            };

            for (const e of expenses) {
                const empName = e.employee?.name
                    || `${e.employee?.firstName || ''} ${e.employee?.lastName || ''}`.trim()
                    || e.contractor?.name
                    || 'Sin empleado';
                const row = upsert(
                    e.employeeId || e.contractorId || null,
                    empName,
                    e.obraId,
                    e.obra?.code || '',
                    e.obra?.name || 'Obra eliminada'
                );
                const amount = Number(e.amount || 0);
                row.total += amount;
                row.byType[e.type] = Number((row.byType[e.type] || 0) + amount);
            }

            for (const w of hours) {
                const empName = w.employee?.name || `${w.employee?.firstName || ''} ${w.employee?.lastName || ''}`.trim() || 'Sin empleado';
                const row = upsert(
                    w.employeeId,
                    empName,
                    w.projectId,
                    w.project?.code || '',
                    w.project?.name || 'Obra eliminada'
                );
                row.hours += Number(w.hours || 0);
            }

            const rows = Array.from(map.values())
                .map((r) => ({
                    employee: r.employee,
                    obra: r.obra,
                    obraCode: r.obraCode,
                    hours: r.hours,
                    total: r.total,
                    byType: r.byType
                }))
                .sort((a, b) => (b.total + b.hours * 10) - (a.total + a.hours * 10));

            return rows;
        }, OBRA_REPORT_CACHE_TTL);
    }
}
