import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthUser } from '../types/express';
import { AppError } from '../utils/AppError';
import { isGlobalAdmin } from '../utils/companyAccess';
import { EmailService } from './EmailService';
import { HrAlertEmailService } from './HrAlertEmailService';

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'BLOCKED'];
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const TASK_STATUSES = [...OPEN_TASK_STATUSES, 'COMPLETED', 'DISMISSED'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_ALERT_RULES = [
    {
        type: 'CONTRACT_EXPIRING',
        name: 'Contratos próximos a vencer',
        description: 'Crea una tarea antes de que finalice un contrato.',
        leadDays: 30,
        severity: 'HIGH'
    },
    {
        type: 'DNI_EXPIRING',
        name: 'DNI próximo a caducar',
        description: 'Avisa para solicitar la renovación del documento de identidad.',
        leadDays: 30,
        severity: 'MEDIUM'
    },
    {
        type: 'DOCUMENT_EXPIRING',
        name: 'Documentación próxima a caducar',
        description: 'Controla certificados y documentos con fecha de vencimiento.',
        leadDays: 15,
        severity: 'MEDIUM'
    },
    {
        type: 'VACATION_PENDING',
        name: 'Solicitudes pendientes',
        description: 'Crea una tarea cuando una ausencia o vacación necesita revisión.',
        leadDays: 0,
        severity: 'HIGH'
    },
    {
        type: 'INBOX_PENDING',
        name: 'Documentos sin clasificar',
        description: 'Avisa cuando hay archivos pendientes en la bandeja documental.',
        leadDays: 0,
        severity: 'MEDIUM'
    }
] as const;

interface CloseItem {
    key: string;
    label: string;
    description: string;
    completed: boolean;
    required: boolean;
    metric: number;
    blocking: boolean;
    actionUrl: string;
}

function parseDate(value: unknown): Date | null {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePriority(value: unknown): string {
    const normalized = String(value || 'MEDIUM').toUpperCase();
    if (!TASK_PRIORITIES.includes(normalized)) throw new AppError('Prioridad de tarea no válida', 422);
    return normalized;
}

function normalizeStatus(value: unknown): string {
    const normalized = String(value || '').toUpperCase();
    if (!TASK_STATUSES.includes(normalized)) throw new AppError('Estado de tarea no válido', 422);
    return normalized;
}

function companyFilter(user: AuthUser, requestedCompanyId?: string | null): string | undefined {
    if (user.companyId) {
        if (requestedCompanyId && requestedCompanyId !== user.companyId) {
            throw new AppError('No puedes acceder a otra empresa', 403);
        }
        return user.companyId;
    }
    if (!isGlobalAdmin(user)) throw new AppError('Usuario sin empresa asignada', 403);
    return requestedCompanyId || undefined;
}

async function requiredCompany(user: AuthUser, requestedCompanyId?: string | null): Promise<string> {
    const companyId = companyFilter(user, requestedCompanyId);
    if (!companyId) throw new AppError('Selecciona una empresa para continuar', 422);
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new AppError('Empresa no encontrada', 404);
    return company.id;
}

async function ensureDefaultRules(companyId: string) {
    await prisma.hrAlertRule.createMany({
        data: DEFAULT_ALERT_RULES.map((rule) => ({
            companyId,
            ...rule,
            channels: JSON.stringify(['IN_APP'])
        })),
        skipDuplicates: true
    });
}

function employeeName(employee: { name: string; firstName: string | null; lastName: string | null }) {
    return `${employee.firstName || employee.name || ''} ${employee.lastName || ''}`.trim() || 'Empleado';
}

export class HrWorkspaceService {
    static async syncAutomaticTasks(user: AuthUser, requestedCompanyId?: string | null) {
        const companyId = await requiredCompany(user, requestedCompanyId);
        await ensureDefaultRules(companyId);
        const rules = await prisma.hrAlertRule.findMany({ where: { companyId, enabled: true } });
        const byType = new Map(rules.map((rule) => [rule.type, rule]));
        const now = new Date();
        const candidates: Array<{
            sourceKey: string;
            sourceType: string;
            employeeId?: string;
            title: string;
            description: string;
            category: string;
            priority: string;
            dueDate?: Date | null;
            actionUrl: string;
            metadata?: Prisma.InputJsonValue;
        }> = [];

        const employees = await prisma.employee.findMany({
            where: { companyId, active: true },
            select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                contractEndDate: true,
                dniExpiration: true
            }
        });

        const contractRule = byType.get('CONTRACT_EXPIRING');
        const dniRule = byType.get('DNI_EXPIRING');
        for (const employee of employees) {
            const displayName = employeeName(employee);
            if (
                contractRule &&
                employee.contractEndDate &&
                employee.contractEndDate >= now &&
                employee.contractEndDate <= new Date(now.getTime() + contractRule.leadDays * DAY_MS)
            ) {
                candidates.push({
                    sourceKey: `${companyId}:CONTRACT_EXPIRING:${employee.id}`,
                    sourceType: 'CONTRACT_EXPIRING',
                    employeeId: employee.id,
                    title: 'Decidir renovación de contrato',
                    description: `El contrato de ${displayName} finaliza el ${employee.contractEndDate.toLocaleDateString('es-ES')}.`,
                    category: 'CONTRACTS',
                    priority: contractRule.severity,
                    dueDate: employee.contractEndDate,
                    actionUrl: `/employees/${employee.id}`,
                    metadata: { ruleId: contractRule.id }
                });
            }
            if (
                dniRule &&
                employee.dniExpiration &&
                employee.dniExpiration >= now &&
                employee.dniExpiration <= new Date(now.getTime() + dniRule.leadDays * DAY_MS)
            ) {
                candidates.push({
                    sourceKey: `${companyId}:DNI_EXPIRING:${employee.id}`,
                    sourceType: 'DNI_EXPIRING',
                    employeeId: employee.id,
                    title: 'Solicitar renovación del DNI',
                    description: `El DNI de ${displayName} caduca el ${employee.dniExpiration.toLocaleDateString('es-ES')}.`,
                    category: 'DOCUMENTS',
                    priority: dniRule.severity,
                    dueDate: employee.dniExpiration,
                    actionUrl: `/employees/${employee.id}`,
                    metadata: { ruleId: dniRule.id }
                });
            }
        }

        const documentRule = byType.get('DOCUMENT_EXPIRING');
        if (documentRule) {
            const documents = await prisma.document.findMany({
                where: {
                    employee: { companyId, active: true },
                    expiryDate: {
                        gte: now,
                        lte: new Date(now.getTime() + documentRule.leadDays * DAY_MS)
                    }
                },
                select: {
                    id: true,
                    employeeId: true,
                    name: true,
                    expiryDate: true,
                    employee: { select: { name: true, firstName: true, lastName: true } }
                }
            });
            for (const document of documents) {
                candidates.push({
                    sourceKey: `${companyId}:DOCUMENT_EXPIRING:${document.id}`,
                    sourceType: 'DOCUMENT_EXPIRING',
                    employeeId: document.employeeId,
                    title: 'Renovar documentación',
                    description: `${document.name} de ${employeeName(document.employee)} caduca el ${document.expiryDate?.toLocaleDateString('es-ES')}.`,
                    category: 'DOCUMENTS',
                    priority: documentRule.severity,
                    dueDate: document.expiryDate,
                    actionUrl: `/employees/${document.employeeId}?tab=expediente`,
                    metadata: { ruleId: documentRule.id, documentId: document.id }
                });
            }
        }

        const vacationRule = byType.get('VACATION_PENDING');
        if (vacationRule) {
            const requests = await prisma.vacation.findMany({
                where: { status: 'PENDING', employee: { companyId, active: true } },
                select: {
                    id: true,
                    employeeId: true,
                    startDate: true,
                    endDate: true,
                    employee: { select: { name: true, firstName: true, lastName: true } }
                }
            });
            for (const request of requests) {
                candidates.push({
                    sourceKey: `${companyId}:VACATION_PENDING:${request.id}`,
                    sourceType: 'VACATION_PENDING',
                    employeeId: request.employeeId,
                    title: 'Revisar solicitud de ausencia',
                    description: `${employeeName(request.employee)} solicita del ${request.startDate.toLocaleDateString('es-ES')} al ${request.endDate.toLocaleDateString('es-ES')}.`,
                    category: 'ABSENCES',
                    priority: vacationRule.severity,
                    dueDate: request.startDate,
                    actionUrl: '/vacations',
                    metadata: { ruleId: vacationRule.id, vacationId: request.id }
                });
            }
        }

        const inboxRule = byType.get('INBOX_PENDING');
        if (inboxRule) {
            const inboxDocuments = await prisma.inboxDocument.findMany({
                where: { companyId, processed: false },
                select: { id: true, originalName: true, receivedAt: true }
            });
            for (const document of inboxDocuments) {
                candidates.push({
                    sourceKey: `${companyId}:INBOX_PENDING:${document.id}`,
                    sourceType: 'INBOX_PENDING',
                    title: 'Clasificar documento recibido',
                    description: `${document.originalName} sigue pendiente de asignación.`,
                    category: 'DOCUMENTS',
                    priority: inboxRule.severity,
                    dueDate: new Date(document.receivedAt.getTime() + 2 * DAY_MS),
                    actionUrl: '/inbox',
                    metadata: { ruleId: inboxRule.id, inboxDocumentId: document.id }
                });
            }
        }

        await prisma.$transaction(async (tx) => {
            for (const candidate of candidates) {
                await tx.hrTask.upsert({
                    where: { sourceKey: candidate.sourceKey },
                    create: {
                        companyId,
                        ...candidate,
                        autoGenerated: true
                    },
                    update: {
                        employeeId: candidate.employeeId || null,
                        title: candidate.title,
                        description: candidate.description,
                        category: candidate.category,
                        priority: candidate.priority,
                        dueDate: candidate.dueDate || null,
                        actionUrl: candidate.actionUrl,
                        metadata: candidate.metadata,
                        ...(candidate.sourceType ? { sourceType: candidate.sourceType } : {})
                    }
                });
            }

            const activeKeys = candidates.map((candidate) => candidate.sourceKey);
            await tx.hrTask.updateMany({
                where: {
                    companyId,
                    autoGenerated: true,
                    status: { in: OPEN_TASK_STATUSES },
                    ...(activeKeys.length ? { sourceKey: { notIn: activeKeys } } : {})
                },
                data: {
                    status: 'COMPLETED',
                    completedAt: now
                }
            });
        });

        await HrAlertEmailService.processCompany(companyId);
        return { synchronized: candidates.length };
    }

    static async getOverview(user: AuthUser, query: Record<string, unknown>) {
        const companyId = companyFilter(user, query.companyId ? String(query.companyId) : undefined);
        const where: Prisma.HrTaskWhereInput = {
            ...(companyId ? { companyId } : {}),
            ...(query.status && query.status !== 'ALL'
                ? { status: String(query.status) }
                : { status: { in: OPEN_TASK_STATUSES } }),
            ...(query.priority && query.priority !== 'ALL' ? { priority: String(query.priority) } : {}),
            ...(query.category && query.category !== 'ALL' ? { category: String(query.category) } : {}),
            ...(query.assignee === 'ME' ? { assignedToId: user.id } : {})
        };

        const now = new Date();
        const soon = new Date(now.getTime() + 7 * DAY_MS);
        const [tasks, pending, urgent, overdue, dueSoon, completedThisMonth] = await Promise.all([
            prisma.hrTask.findMany({
                where,
                include: {
                    employee: { select: { id: true, name: true, firstName: true, lastName: true, dni: true, department: true } },
                    assignedTo: { select: { id: true, email: true } }
                },
                orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
                take: 250
            }),
            prisma.hrTask.count({ where: { ...(companyId ? { companyId } : {}), status: { in: OPEN_TASK_STATUSES } } }),
            prisma.hrTask.count({ where: { ...(companyId ? { companyId } : {}), status: { in: OPEN_TASK_STATUSES }, priority: { in: ['URGENT', 'HIGH'] } } }),
            prisma.hrTask.count({ where: { ...(companyId ? { companyId } : {}), status: { in: OPEN_TASK_STATUSES }, dueDate: { lt: now } } }),
            prisma.hrTask.count({ where: { ...(companyId ? { companyId } : {}), status: { in: OPEN_TASK_STATUSES }, dueDate: { gte: now, lte: soon } } }),
            prisma.hrTask.count({
                where: {
                    ...(companyId ? { companyId } : {}),
                    status: 'COMPLETED',
                    completedAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) }
                }
            })
        ]);

        return {
            tasks,
            summary: { pending, urgent, overdue, dueSoon, completedThisMonth }
        };
    }

    static async createTask(user: AuthUser, body: Record<string, unknown>) {
        const employeeId = body.employeeId ? String(body.employeeId) : undefined;
        let companyId = companyFilter(user, body.companyId ? String(body.companyId) : undefined);
        if (employeeId) {
            const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } });
            if (!employee) throw new AppError('Empleado no encontrado', 404);
            if (user.companyId && employee.companyId !== user.companyId) throw new AppError('No puedes crear tareas para otra empresa', 403);
            companyId = employee.companyId || companyId;
        }
        if (!companyId) throw new AppError('Selecciona una empresa', 422);
        const title = String(body.title || '').trim();
        if (title.length < 3) throw new AppError('El título debe tener al menos 3 caracteres', 422);

        return prisma.hrTask.create({
            data: {
                companyId,
                employeeId,
                title,
                description: body.description ? String(body.description).trim() : null,
                category: String(body.category || 'GENERAL').toUpperCase(),
                priority: normalizePriority(body.priority),
                dueDate: parseDate(body.dueDate),
                actionUrl: body.actionUrl ? String(body.actionUrl) : employeeId ? `/employees/${employeeId}` : null,
                assignedToId: body.assignedToId ? String(body.assignedToId) : null,
                createdById: user.id,
                autoGenerated: false
            }
        });
    }

    static async updateTask(user: AuthUser, id: string, body: Record<string, unknown>) {
        const task = await prisma.hrTask.findUnique({ where: { id }, select: { id: true, companyId: true } });
        if (!task) throw new AppError('Tarea no encontrada', 404);
        companyFilter(user, task.companyId);
        const data: Prisma.HrTaskUpdateInput = {};
        if (body.status !== undefined) {
            const status = normalizeStatus(body.status);
            data.status = status;
            data.completedAt = status === 'COMPLETED' ? new Date() : null;
            data.completedBy = status === 'COMPLETED' ? { connect: { id: user.id } } : { disconnect: true };
        }
        if (body.priority !== undefined) data.priority = normalizePriority(body.priority);
        if (body.title !== undefined) {
            const title = String(body.title).trim();
            if (title.length < 3) throw new AppError('El título debe tener al menos 3 caracteres', 422);
            data.title = title;
        }
        if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
        if (body.dueDate !== undefined) data.dueDate = parseDate(body.dueDate);
        if (body.assignedToId !== undefined) {
            data.assignedTo = body.assignedToId ? { connect: { id: String(body.assignedToId) } } : { disconnect: true };
        }
        return prisma.hrTask.update({ where: { id }, data });
    }

    static async getAlertRules(user: AuthUser, requestedCompanyId?: string | null) {
        const companyId = await requiredCompany(user, requestedCompanyId);
        await ensureDefaultRules(companyId);
        return prisma.hrAlertRule.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
    }

    static async updateAlertRule(user: AuthUser, id: string, body: Record<string, unknown>) {
        const rule = await prisma.hrAlertRule.findUnique({ where: { id }, select: { companyId: true } });
        if (!rule) throw new AppError('Regla no encontrada', 404);
        companyFilter(user, rule.companyId);
        const data: Prisma.HrAlertRuleUpdateInput = {};
        if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
        if (body.leadDays !== undefined) {
            const days = Number(body.leadDays);
            if (!Number.isInteger(days) || days < 0 || days > 365) throw new AppError('La antelación debe estar entre 0 y 365 días', 422);
            data.leadDays = days;
        }
        if (body.severity !== undefined) data.severity = normalizePriority(body.severity);
        if (body.channels !== undefined) {
            const requested = Array.isArray(body.channels) ? body.channels.map((channel) => String(channel).toUpperCase()) : [];
            const channels = ['IN_APP', ...requested.filter((channel) => channel === 'EMAIL')];
            data.channels = JSON.stringify(channels);
        }
        if (body.emailMode !== undefined) {
            const mode = String(body.emailMode).toUpperCase();
            if (mode !== 'IMMEDIATE' && mode !== 'DAILY_DIGEST') throw new AppError('Frecuencia de correo no válida', 422);
            data.emailMode = mode;
        }
        if (body.emailIncludeHr !== undefined) data.emailIncludeHr = Boolean(body.emailIncludeHr);
        if (body.emailIncludeManager !== undefined) data.emailIncludeManager = Boolean(body.emailIncludeManager);
        if (body.emailRecipients !== undefined) {
            if (!Array.isArray(body.emailRecipients)) throw new AppError('Los destinatarios deben ser una lista', 422);
            const recipients = [...new Set(
                body.emailRecipients
                    .map((recipient) => String(recipient).trim().toLowerCase())
                    .filter(Boolean)
            )];
            if (recipients.length > 20) throw new AppError('No se pueden añadir más de 20 destinatarios', 422);
            const invalid = recipients.find((recipient) => !EMAIL_REGEX.test(recipient));
            if (invalid) throw new AppError(`Correo electrónico no válido: ${invalid}`, 422);
            data.emailRecipients = JSON.stringify(recipients);
        }
        const updated = await prisma.hrAlertRule.update({ where: { id }, data });
        if (JSON.parse(updated.channels).includes('EMAIL')) {
            await HrAlertEmailService.processCompany(rule.companyId);
        }
        return updated;
    }

    static async getAlertEmailStatus(user: AuthUser, requestedCompanyId?: string | null) {
        const companyId = await requiredCompany(user, requestedCompanyId);
        const since = new Date(Date.now() - 30 * DAY_MS);
        const [configured, sent, failed, pending, lastDelivery] = await Promise.all([
            EmailService.isConfigured(),
            prisma.hrAlertDelivery.count({ where: { companyId, status: 'SENT', createdAt: { gte: since } } }),
            prisma.hrAlertDelivery.count({ where: { companyId, status: 'FAILED', createdAt: { gte: since } } }),
            prisma.hrAlertDelivery.count({ where: { companyId, status: 'PENDING' } }),
            prisma.hrAlertDelivery.findFirst({
                where: { companyId },
                orderBy: { updatedAt: 'desc' },
                select: { status: true, recipient: true, sentAt: true, updatedAt: true, lastError: true }
            })
        ]);
        return { configured, sent, failed, pending, lastDelivery };
    }

    private static async buildMonthlyCloseItems(companyId: string, year: number, month: number): Promise<CloseItem[]> {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 1);
        const [
            pendingVacations,
            pendingExpenses,
            openAnomalies,
            payrollErrors,
            terminations,
            inboxPending,
            openTasks,
            gestoriaPeriod
        ] = await Promise.all([
            prisma.vacation.count({ where: { status: 'PENDING', employee: { companyId } } }),
            prisma.expense.count({ where: { status: 'PENDING', employee: { companyId }, date: { gte: start, lt: end } } }),
            prisma.anomalyEvent.count({ where: { status: 'OPEN', employee: { companyId }, createdAt: { gte: start, lt: end } } }),
            prisma.payrollRow.count({
                where: {
                    batch: { year, month },
                    employee: { companyId },
                    status: { notIn: ['OK', 'VALIDATED'] }
                }
            }),
            prisma.employmentPeriod.count({ where: { companyId, endDate: { gte: start, lt: end } } }),
            prisma.inboxDocument.count({ where: { companyId, processed: false } }),
            prisma.hrTask.count({ where: { companyId, status: { in: OPEN_TASK_STATUSES }, dueDate: { lt: end } } }),
            prisma.gestoriaPeriod.findUnique({
                where: { companyId_year_month: { companyId, year, month } },
                select: { status: true }
            })
        ]);

        return [
            {
                key: 'ATTENDANCE',
                label: 'Incidencias de fichaje revisadas',
                description: 'Resolver anomalías y fichajes incompletos del periodo.',
                completed: openAnomalies === 0,
                required: true,
                metric: openAnomalies,
                blocking: openAnomalies > 0,
                actionUrl: '/anomalies'
            },
            {
                key: 'ABSENCES',
                label: 'Ausencias y vacaciones validadas',
                description: 'Aprobar o rechazar todas las solicitudes pendientes.',
                completed: pendingVacations === 0,
                required: true,
                metric: pendingVacations,
                blocking: pendingVacations > 0,
                actionUrl: '/vacations'
            },
            {
                key: 'EXPENSES',
                label: 'Dietas y gastos revisados',
                description: 'Comprobar justificantes y estados de pago.',
                completed: pendingExpenses === 0,
                required: true,
                metric: pendingExpenses,
                blocking: pendingExpenses > 0,
                actionUrl: '/expenses'
            },
            {
                key: 'PAYROLL',
                label: 'Nómina sin errores',
                description: 'Validar registros y conceptos antes de exportar.',
                completed: payrollErrors === 0,
                required: true,
                metric: payrollErrors,
                blocking: payrollErrors > 0,
                actionUrl: '/payroll/control'
            },
            {
                key: 'LIFECYCLE',
                label: 'Altas y bajas comprobadas',
                description: `${terminations} bajas registradas durante el mes.`,
                completed: terminations === 0,
                required: true,
                metric: terminations,
                blocking: false,
                actionUrl: '/reports'
            },
            {
                key: 'DOCUMENTS',
                label: 'Bandeja documental vacía',
                description: 'Clasificar los documentos recibidos y asociarlos al expediente.',
                completed: inboxPending === 0,
                required: true,
                metric: inboxPending,
                blocking: inboxPending > 0,
                actionUrl: '/inbox'
            },
            {
                key: 'TASKS',
                label: 'Pendientes del mes resueltos',
                description: 'Cerrar o justificar las tareas con vencimiento dentro del periodo.',
                completed: openTasks === 0,
                required: true,
                metric: openTasks,
                blocking: openTasks > 0,
                actionUrl: '/hr/tasks'
            },
            {
                key: 'GESTORIA',
                label: 'Periodo de gestoría cerrado',
                description: 'Comprobar la información final antes de enviarla.',
                completed: gestoriaPeriod?.status === 'CLOSED',
                required: false,
                metric: gestoriaPeriod?.status === 'CLOSED' ? 0 : 1,
                blocking: false,
                actionUrl: '/payroll/control'
            }
        ];
    }

    static async getMonthlyClose(user: AuthUser, requestedCompanyId: string | undefined, year: number, month: number) {
        const companyId = await requiredCompany(user, requestedCompanyId);
        if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
            throw new AppError('Periodo mensual no válido', 422);
        }
        const generated = await this.buildMonthlyCloseItems(companyId, year, month);
        const existing = await prisma.hrMonthlyClose.findUnique({
            where: { companyId_year_month: { companyId, year, month } }
        });
        const previousItems = Array.isArray(existing?.items) ? (existing?.items as unknown as CloseItem[]) : [];
        const previousByKey = new Map(previousItems.map((item) => [item.key, item]));
        const items = generated.map((item) => {
            const previous = previousByKey.get(item.key);
            return {
                ...item,
                completed: item.blocking ? item.completed : previous?.completed ?? item.completed
            };
        });
        return prisma.hrMonthlyClose.upsert({
            where: { companyId_year_month: { companyId, year, month } },
            create: { companyId, year, month, items: items as unknown as Prisma.InputJsonValue },
            update: existing?.status === 'CLOSED' ? {} : { items: items as unknown as Prisma.InputJsonValue },
            include: { closedBy: { select: { id: true, email: true } } }
        });
    }

    static async updateMonthlyCloseItem(
        user: AuthUser,
        id: string,
        itemKey: string,
        completed: boolean
    ) {
        const close = await prisma.hrMonthlyClose.findUnique({ where: { id } });
        if (!close) throw new AppError('Cierre mensual no encontrado', 404);
        companyFilter(user, close.companyId);
        if (close.status === 'CLOSED') throw new AppError('El periodo está cerrado', 409);
        const items = (close.items as unknown as CloseItem[]).map((item) =>
            item.key === itemKey ? { ...item, completed: Boolean(completed) } : item
        );
        if (!items.some((item) => item.key === itemKey)) throw new AppError('Elemento de cierre no encontrado', 404);
        return prisma.hrMonthlyClose.update({
            where: { id },
            data: { items: items as unknown as Prisma.InputJsonValue }
        });
    }

    static async setMonthlyCloseStatus(user: AuthUser, id: string, status: 'CLOSED' | 'OPEN', notes?: string) {
        const close = await prisma.hrMonthlyClose.findUnique({ where: { id } });
        if (!close) throw new AppError('Cierre mensual no encontrado', 404);
        companyFilter(user, close.companyId);
        if (status === 'CLOSED') {
            const items = close.items as unknown as CloseItem[];
            const pendingRequired = items.filter((item) => item.required && !item.completed);
            if (pendingRequired.length) {
                throw new AppError(`Quedan ${pendingRequired.length} comprobaciones obligatorias sin completar`, 409);
            }
        }
        return prisma.hrMonthlyClose.update({
            where: { id },
            data: {
                status,
                notes: notes?.trim() || close.notes,
                closedAt: status === 'CLOSED' ? new Date() : null,
                closedBy: status === 'CLOSED' ? { connect: { id: user.id } } : { disconnect: true }
            }
        });
    }

    static async getSmartRecord(user: AuthUser, employeeId: string) {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                companyId: true,
                active: true,
                dni: true,
                email: true,
                phone: true,
                address: true,
                socialSecurityNumber: true,
                socialSecurityNumberEnc: true,
                iban: true,
                ibanEnc: true,
                department: true,
                jobTitle: true,
                contractType: true,
                entryDate: true,
                contractEndDate: true,
                dniExpiration: true,
                _count: {
                    select: {
                        documents: true,
                        trainings: true,
                        medicalReviews: true,
                        assets: true
                    }
                }
            }
        });
        if (!employee) throw new AppError('Empleado no encontrado', 404);
        companyFilter(user, employee.companyId);

        const documents = await prisma.document.findMany({
            where: { employeeId },
            select: { id: true, name: true, category: true, expiryDate: true },
            orderBy: { uploadDate: 'desc' }
        });
        const categories = documents.map((document) => `${document.category} ${document.name}`.toUpperCase());
        const hasLaborDocument = categories.some((value) => /CONTRAT|LABORAL|ALTA/.test(value));
        const hasPrlDocument = categories.some((value) => /PRL|FORMACI|PREVEN|MEDIC/.test(value)) || employee._count.trainings > 0 || employee._count.medicalReviews > 0;
        const checks = [
            { key: 'email', label: 'Correo electrónico', complete: Boolean(employee.email), actionUrl: `/employees/${employeeId}` },
            { key: 'phone', label: 'Teléfono', complete: Boolean(employee.phone), actionUrl: `/employees/${employeeId}` },
            { key: 'address', label: 'Dirección', complete: Boolean(employee.address), actionUrl: `/employees/${employeeId}` },
            { key: 'socialSecurity', label: 'Número de Seguridad Social', complete: Boolean(employee.socialSecurityNumberEnc || employee.socialSecurityNumber), actionUrl: `/employees/${employeeId}` },
            { key: 'iban', label: 'Cuenta bancaria', complete: Boolean(employee.ibanEnc || employee.iban), actionUrl: `/employees/${employeeId}` },
            { key: 'department', label: 'Departamento', complete: Boolean(employee.department), actionUrl: `/employees/${employeeId}` },
            { key: 'jobTitle', label: 'Puesto de trabajo', complete: Boolean(employee.jobTitle), actionUrl: `/employees/${employeeId}` },
            { key: 'contractType', label: 'Tipo de contrato', complete: Boolean(employee.contractType), actionUrl: `/employees/${employeeId}` },
            { key: 'entryDate', label: 'Fecha de incorporación', complete: Boolean(employee.entryDate), actionUrl: `/employees/${employeeId}` },
            { key: 'laborDocument', label: 'Documento laboral', complete: hasLaborDocument, actionUrl: `/employees/${employeeId}?tab=expediente` },
            { key: 'prlDocument', label: 'PRL o formación', complete: hasPrlDocument, actionUrl: `/employees/${employeeId}?tab=prl` }
        ];
        const completed = checks.filter((check) => check.complete).length;
        const score = Math.round((completed / checks.length) * 100);
        const now = new Date();
        const attention: Array<{ id: string; type: string; severity: string; title: string; description: string; actionUrl: string }> = [];
        if (employee.contractEndDate && employee.contractEndDate <= new Date(now.getTime() + 30 * DAY_MS)) {
            attention.push({
                id: 'contract-expiry',
                type: 'CONTRACT',
                severity: 'HIGH',
                title: 'Contrato próximo a vencer',
                description: employee.contractEndDate.toLocaleDateString('es-ES'),
                actionUrl: `/employees/${employeeId}`
            });
        }
        if (employee.dniExpiration && employee.dniExpiration <= new Date(now.getTime() + 30 * DAY_MS)) {
            attention.push({
                id: 'dni-expiry',
                type: 'DOCUMENT',
                severity: 'MEDIUM',
                title: 'DNI próximo a caducar',
                description: employee.dniExpiration.toLocaleDateString('es-ES'),
                actionUrl: `/employees/${employeeId}`
            });
        }
        documents
            .filter((document) => document.expiryDate && document.expiryDate <= new Date(now.getTime() + 30 * DAY_MS))
            .slice(0, 5)
            .forEach((document) => attention.push({
                id: document.id,
                type: 'DOCUMENT',
                severity: 'MEDIUM',
                title: `${document.name} próximo a caducar`,
                description: document.expiryDate!.toLocaleDateString('es-ES'),
                actionUrl: `/employees/${employeeId}?tab=expediente`
            }));
        checks.filter((check) => !check.complete).slice(0, 5).forEach((check) => attention.push({
            id: `missing-${check.key}`,
            type: 'MISSING_DATA',
            severity: 'LOW',
            title: `Falta ${check.label.toLowerCase()}`,
            description: 'Completa este dato para cerrar el expediente.',
            actionUrl: check.actionUrl
        }));
        const tasks = await prisma.hrTask.findMany({
            where: { employeeId, status: { in: OPEN_TASK_STATUSES } },
            select: { id: true, title: true, priority: true, dueDate: true, actionUrl: true },
            orderBy: { dueDate: 'asc' },
            take: 10
        });
        return {
            score,
            completed,
            total: checks.length,
            checks,
            missing: checks.filter((check) => !check.complete),
            attention,
            tasks,
            counts: employee._count
        };
    }
}
