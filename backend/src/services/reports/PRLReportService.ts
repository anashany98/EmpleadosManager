import { prisma } from '../../lib/prisma';
import { CacheService } from '../CacheService';

const PRL_REPORT_CACHE_TTL = 300; // 5 min — los datos de PRL son relativamente estables

const formatEmployeeName = (e: { firstName?: string | null; lastName?: string | null; name?: string | null } | null | undefined): string => {
    if (!e) return 'Sin empleado';
    if (e.name) return e.name;
    const composed = `${e.firstName || ''} ${e.lastName || ''}`.trim();
    return composed || 'Sin empleado';
};

const buildEmployeeWhere = (filters: { companyId?: string; department?: string; employeeId?: string }) => {
    const where: any = { deletedAt: null };
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.department) where.department = filters.department;
    if (filters.employeeId) where.id = filters.employeeId;
    return where;
};

export class PRLReportService {
    /**
     * Reporte de revisiones médicas (PRL) por empresa y rango de fechas.
     * Devuelve:
     *  - rows: detalle por revisión (empleado, fecha, resultado, declinada, próxima)
     *  - summary: agregados (totales, distribución por resultado, declinadas, caducadas)
     */
    static async getMedicalReviewsReport(filters: {
        from?: Date;
        to?: Date;
        companyId?: string;
        department?: string;
        employeeId?: string;
    } = {}) {
        const cacheKey = `report:prl-medical:${filters.companyId || 'ALL'}:${filters.department || 'ALL'}:${filters.employeeId || 'ALL'}:${filters.from?.toISOString() || ''}:${filters.to?.toISOString() || ''}`;
        return CacheService.wrap(cacheKey, async () => {
            const dateWhere: any = {};
            if (filters.from) dateWhere.gte = filters.from;
            if (filters.to) dateWhere.lte = filters.to;

            const where: any = {};
            if (Object.keys(dateWhere).length > 0) where.date = dateWhere;

            const employeeWhere = buildEmployeeWhere(filters);
            // Aplicamos filtro de empleado a la relación si hay filtros
            if (Object.keys(employeeWhere).length > 0) {
                where.employee = employeeWhere;
            }

            const reviews = await prisma.medicalReview.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            name: true,
                            dni: true,
                            department: true,
                            jobTitle: true,
                            companyId: true,
                            company: { select: { id: true, name: true } }
                        }
                    }
                },
                orderBy: { date: 'desc' }
            });

            const now = new Date();
            const rows = reviews.map((r: any) => {
                const nextReview = r.nextReviewDate ? new Date(r.nextReviewDate) : null;
                const expired = nextReview ? nextReview < now : false;
                const daysToExpire = nextReview
                    ? Math.ceil((nextReview.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                const dni = r.employee?.dni || null;
                return {
                    id: r.id,
                    employeeId: r.employeeId,
                    employee: formatEmployeeName(r.employee),
                    dni: dni || null,
                    department: r.employee?.department || 'Sin asignar',
                    position: r.employee?.jobTitle || null,
                    company: r.employee?.company?.name || null,
                    date: r.date,
                    result: r.result,
                    declined: Boolean(r.declined),
                    declineReason: r.declineReason || null,
                    nextReviewDate: r.nextReviewDate,
                    expired,
                    daysToExpire
                };
            });

            const summary = {
                totalReviews: rows.length,
                declinedCount: rows.filter((r: any) => r.declined).length,
                aptoCount: rows.filter((r: any) => !r.declined && r.result === 'APTO').length,
                noAptoCount: rows.filter((r: any) => !r.declined && r.result === 'NO APTO').length,
                aptoConLimitacionesCount: rows.filter((r: any) => !r.declined && r.result === 'APTO CON LIMITACIONES').length,
                pendienteCount: rows.filter((r: any) => !r.declined && (r.result === 'PENDIENTE' || r.result == null)).length,
                expiredCount: rows.filter((r: any) => r.expired).length,
                dueSoonCount: rows.filter((r: any) => !r.expired && r.daysToExpire !== null && r.daysToExpire <= 30 && r.daysToExpire >= 0).length,
                uniqueEmployees: new Set(rows.map((r: any) => r.employeeId)).size
            };

            // Distribución por resultado (para charts)
            const distributionByResult: Record<string, number> = {};
            for (const r of rows) {
                const key = r.declined ? 'RENUNCIA' : (r.result || 'PENDIENTE');
                distributionByResult[key] = (distributionByResult[key] || 0) + 1;
            }

            // Distribución por departamento
            const distributionByDepartment: Record<string, number> = {};
            for (const r of rows) {
                distributionByDepartment[r.department] = (distributionByDepartment[r.department] || 0) + 1;
            }

            return {
                rows,
                summary,
                distributionByResult,
                distributionByDepartment
            };
        }, PRL_REPORT_CACHE_TTL);
    }

    /**
     * Reporte de cursos y formación por empresa y rango de fechas.
     * Devuelve:
     *  - rows: detalle por curso (empleado, curso, tipo, fecha, horas)
     *  - summary: agregados (totales, horas totales, por tipo, top cursos)
     */
    static async getTrainingsReport(filters: {
        from?: Date;
        to?: Date;
        companyId?: string;
        department?: string;
        employeeId?: string;
        type?: string;
    } = {}) {
        const cacheKey = `report:prl-training:${filters.companyId || 'ALL'}:${filters.department || 'ALL'}:${filters.employeeId || 'ALL'}:${filters.type || 'ALL'}:${filters.from?.toISOString() || ''}:${filters.to?.toISOString() || ''}`;
        return CacheService.wrap(cacheKey, async () => {
            const dateWhere: any = {};
            if (filters.from) dateWhere.gte = filters.from;
            if (filters.to) dateWhere.lte = filters.to;

            const where: any = {};
            if (Object.keys(dateWhere).length > 0) where.date = dateWhere;
            if (filters.type) where.type = filters.type;

            const employeeWhere = buildEmployeeWhere(filters);
            if (Object.keys(employeeWhere).length > 0) {
                where.employee = employeeWhere;
            }

            const trainings = await prisma.training.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            name: true,
                            dni: true,
                            department: true,
                            jobTitle: true,
                            companyId: true,
                            company: { select: { id: true, name: true } }
                        }
                    }
                },
                orderBy: { date: 'desc' }
            });

            const rows = trainings.map((t: any) => {
                const dni = t.employee?.dni || null;
                return {
                    id: t.id,
                    employeeId: t.employeeId,
                    employee: formatEmployeeName(t.employee),
                    dni: dni || null,
                    department: t.employee?.department || 'Sin asignar',
                    position: t.employee?.jobTitle || null,
                    company: t.employee?.company?.name || null,
                    name: t.name,
                    type: t.type,
                    date: t.date,
                    hours: t.hours || 0
                };
            });

            const totalHours = rows.reduce((acc: number, r: any) => acc + Number(r.hours || 0), 0);

            const distributionByType: Record<string, number> = {};
            const hoursByType: Record<string, number> = {};
            for (const r of rows) {
                distributionByType[r.type] = (distributionByType[r.type] || 0) + 1;
                hoursByType[r.type] = (hoursByType[r.type] || 0) + Number(r.hours || 0);
            }

            const distributionByCourse: Record<string, { count: number; hours: number }> = {};
            for (const r of rows) {
                if (!distributionByCourse[r.name]) {
                    distributionByCourse[r.name] = { count: 0, hours: 0 };
                }
                distributionByCourse[r.name].count += 1;
                distributionByCourse[r.name].hours += Number(r.hours || 0);
            }

            const distributionByDepartment: Record<string, number> = {};
            for (const r of rows) {
                distributionByDepartment[r.department] = (distributionByDepartment[r.department] || 0) + 1;
            }

            const uniqueEmployees = new Set(rows.map((r: any) => r.employeeId)).size;
            const averageHoursPerEmployee = uniqueEmployees > 0 ? totalHours / uniqueEmployees : 0;

            return {
                rows,
                summary: {
                    totalTrainings: rows.length,
                    totalHours: Math.round(totalHours * 100) / 100,
                    uniqueEmployees,
                    averageHoursPerEmployee: Math.round(averageHoursPerEmployee * 100) / 100,
                    uniqueCourses: Object.keys(distributionByCourse).length
                },
                distributionByType,
                hoursByType,
                distributionByCourse,
                distributionByDepartment
            };
        }, PRL_REPORT_CACHE_TTL);
    }
}
