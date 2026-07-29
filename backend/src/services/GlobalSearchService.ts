import { prisma } from '../lib/prisma';
import { AuthUser } from '../types/express';
import { isGlobalAdmin } from '../utils/companyAccess';
import { AppError } from '../utils/AppError';

export interface GlobalSearchResult {
    id: string;
    kind: 'employee' | 'document' | 'task' | 'project' | 'asset';
    title: string;
    subtitle: string;
    path: string;
    group: string;
}

export class GlobalSearchService {
    static async search(user: AuthUser, rawQuery: string, requestedCompanyId?: string): Promise<GlobalSearchResult[]> {
        const query = rawQuery.trim();
        if (query.length < 2) throw new AppError('Escribe al menos 2 caracteres', 422);
        let companyId = user.companyId || undefined;
        if (!companyId && isGlobalAdmin(user)) companyId = requestedCompanyId || undefined;
        if (!companyId && !isGlobalAdmin(user)) throw new AppError('Usuario sin empresa asignada', 403);

        const employeeWhere = {
            ...(companyId ? { companyId } : {}),
            OR: [
                { name: { contains: query, mode: 'insensitive' as const } },
                { firstName: { contains: query, mode: 'insensitive' as const } },
                { lastName: { contains: query, mode: 'insensitive' as const } },
                { dni: { contains: query, mode: 'insensitive' as const } },
                { department: { contains: query, mode: 'insensitive' as const } },
                { jobTitle: { contains: query, mode: 'insensitive' as const } }
            ]
        };
        const [employees, documents, tasks, projects, assets] = await Promise.all([
            prisma.employee.findMany({
                where: employeeWhere,
                select: { id: true, name: true, firstName: true, lastName: true, dni: true, department: true, active: true },
                take: 8
            }),
            prisma.document.findMany({
                where: {
                    employee: companyId ? { companyId } : {},
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { category: { contains: query, mode: 'insensitive' } }
                    ]
                },
                select: {
                    id: true,
                    name: true,
                    category: true,
                    employeeId: true,
                    employee: { select: { name: true, firstName: true, lastName: true } }
                },
                take: 6
            }),
            prisma.hrTask.findMany({
                where: {
                    ...(companyId ? { companyId } : {}),
                    OR: [
                        { title: { contains: query, mode: 'insensitive' } },
                        { description: { contains: query, mode: 'insensitive' } },
                        { category: { contains: query, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, title: true, category: true, status: true, actionUrl: true },
                take: 6
            }),
            prisma.project.findMany({
                where: {
                    ...(companyId ? {
                        OR: [
                            { manager: { companyId } },
                            { employeeWork: { some: { employee: { companyId } } } }
                        ]
                    } : {}),
                    AND: {
                        OR: [
                            { name: { contains: query, mode: 'insensitive' } },
                            { code: { contains: query, mode: 'insensitive' } },
                            { clientName: { contains: query, mode: 'insensitive' } }
                        ]
                    }
                },
                select: { id: true, name: true, code: true, clientName: true },
                take: 5
            }),
            prisma.asset.findMany({
                where: {
                    ...(companyId ? { employee: { companyId } } : {}),
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { serialNumber: { contains: query, mode: 'insensitive' } },
                        { category: { contains: query, mode: 'insensitive' } }
                    ]
                },
                select: {
                    id: true,
                    name: true,
                    category: true,
                    serialNumber: true,
                    employee: { select: { name: true, firstName: true, lastName: true } }
                },
                take: 5
            })
        ]);

        const displayName = (employee: { name: string; firstName: string | null; lastName: string | null }) =>
            `${employee.firstName || employee.name || ''} ${employee.lastName || ''}`.trim();
        return [
            ...employees.map((employee) => ({
                id: employee.id,
                kind: 'employee' as const,
                title: displayName(employee),
                subtitle: `${employee.dni} · ${employee.department || 'Sin departamento'}${employee.active ? '' : ' · Inactivo'}`,
                path: `/employees/${employee.id}`,
                group: 'Empleados'
            })),
            ...documents.map((document) => ({
                id: document.id,
                kind: 'document' as const,
                title: document.name,
                subtitle: `${document.category} · ${displayName(document.employee)}`,
                path: `/employees/${document.employeeId}?tab=expediente`,
                group: 'Documentos'
            })),
            ...tasks.map((task) => ({
                id: task.id,
                kind: 'task' as const,
                title: task.title,
                subtitle: `${task.category} · ${task.status}`,
                path: task.actionUrl || `/hr/tasks?task=${task.id}`,
                group: 'Tareas'
            })),
            ...projects.map((project) => ({
                id: project.id,
                kind: 'project' as const,
                title: `${project.code} · ${project.name}`,
                subtitle: project.clientName || 'Obra',
                path: `/obras/${project.id}`,
                group: 'Obras'
            })),
            ...assets.map((asset) => ({
                id: asset.id,
                kind: 'asset' as const,
                title: asset.name,
                subtitle: `${asset.category}${asset.serialNumber ? ` · ${asset.serialNumber}` : ''}${asset.employee ? ` · ${displayName(asset.employee)}` : ''}`,
                path: `/assets?q=${encodeURIComponent(asset.name)}`,
                group: 'Activos'
            }))
        ].slice(0, 30);
    }
}
