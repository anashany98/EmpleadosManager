import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { EmailService } from './EmailService';
import { loggers } from './LoggerService';

const log = loggers.alert;
const OPEN_TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'BLOCKED'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailRule = {
    id: string;
    companyId: string;
    name: string;
    type: string;
    severity: string;
    channels: string;
    emailMode: string;
    emailRecipients: string;
    emailIncludeHr: boolean;
    emailIncludeManager: boolean;
};

type EmailTask = {
    id: string;
    sourceKey: string | null;
    title: string;
    description: string | null;
    actionUrl: string | null;
    dueDate: Date | null;
    priority: string;
    sourceType: string | null;
    employee: {
        firstName: string | null;
        lastName: string | null;
        name: string;
        manager: { email: string | null } | null;
    } | null;
};

function parseStringArray(value: string): string[] {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function absoluteUrl(path: string | null) {
    const base = process.env.FRONTEND_URL || 'http://localhost:5173';
    try {
        return new URL(path || '/hr/tasks', base).toString();
    } catch {
        return `${base.replace(/\/$/, '')}/hr/tasks`;
    }
}

function taskEmployeeName(task: EmailTask) {
    if (!task.employee) return null;
    return `${task.employee.firstName || task.employee.name || ''} ${task.employee.lastName || ''}`.trim();
}

function priorityLabel(priority: string) {
    return ({ URGENT: 'Urgente', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Normal' } as Record<string, string>)[priority] || priority;
}

function emailShell(title: string, intro: string, body: string) {
    return `
        <div style="background:#f1f5f9;padding:28px 12px;font-family:Arial,sans-serif;color:#0f172a">
            <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden">
                <div style="background:#0f172a;padding:24px 28px;color:#ffffff">
                    <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#93c5fd;font-weight:700">Operaciones RRHH</div>
                    <h1 style="font-size:23px;line-height:1.25;margin:8px 0 0">${escapeHtml(title)}</h1>
                </div>
                <div style="padding:26px 28px">
                    <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#475569">${escapeHtml(intro)}</p>
                    ${body}
                    <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#94a3b8">Este correo se ha generado mediante una regla configurable de RRHH.</p>
                </div>
            </div>
        </div>`;
}

function taskCard(task: EmailTask) {
    const employee = taskEmployeeName(task);
    const due = task.dueDate ? task.dueDate.toLocaleDateString('es-ES') : 'Sin fecha límite';
    return `
        <div style="border:1px solid #e2e8f0;border-left:4px solid ${task.priority === 'URGENT' || task.priority === 'HIGH' ? '#e11d48' : '#2563eb'};border-radius:12px;padding:16px;margin:0 0 12px">
            <div style="font-size:16px;font-weight:700;color:#0f172a">${escapeHtml(task.title)}</div>
            ${employee ? `<div style="margin-top:4px;font-size:13px;color:#475569">${escapeHtml(employee)}</div>` : ''}
            ${task.description ? `<p style="margin:9px 0;font-size:14px;line-height:1.5;color:#475569">${escapeHtml(task.description)}</p>` : ''}
            <div style="font-size:12px;color:#64748b">Prioridad: ${escapeHtml(priorityLabel(task.priority))} · ${escapeHtml(due)}</div>
            <a href="${escapeHtml(absoluteUrl(task.actionUrl))}" style="display:inline-block;margin-top:14px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 14px;border-radius:9px">Abrir en la aplicación</a>
        </div>`;
}

export class HrAlertEmailService {
    private static async hrRecipients(companyId: string) {
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                role: { in: ['admin', 'hr'] },
                employee: { companyId }
            },
            select: { email: true }
        });
        return users.map((user) => user.email.toLowerCase()).filter((email) => EMAIL_REGEX.test(email));
    }

    private static recipientsForTask(rule: EmailRule, task: EmailTask, hrRecipients: string[]) {
        const recipients = new Set<string>();
        if (rule.emailIncludeHr) hrRecipients.forEach((email) => recipients.add(email));
        parseStringArray(rule.emailRecipients)
            .map((email) => email.trim().toLowerCase())
            .filter((email) => EMAIL_REGEX.test(email))
            .forEach((email) => recipients.add(email));
        if (rule.emailIncludeManager && task.employee?.manager?.email) {
            const managerEmail = task.employee.manager.email.trim().toLowerCase();
            if (EMAIL_REGEX.test(managerEmail)) recipients.add(managerEmail);
        }
        return [...recipients];
    }

    private static async deliver(
        rule: EmailRule,
        recipient: string,
        sourceKey: string,
        tasks: EmailTask[],
        mode: 'IMMEDIATE' | 'DAILY_DIGEST'
    ) {
        const unique = { ruleId_sourceKey_recipient: { ruleId: rule.id, sourceKey, recipient } };
        let delivery = await prisma.hrAlertDelivery.findUnique({ where: unique });
        if (delivery?.status === 'SENT' || (delivery?.attempts || 0) >= 3) return 'SKIPPED';

        if (delivery) {
            delivery = await prisma.hrAlertDelivery.update({
                where: { id: delivery.id },
                data: { status: 'PENDING', attempts: { increment: 1 }, lastError: null }
            });
        } else {
            try {
                delivery = await prisma.hrAlertDelivery.create({
                    data: {
                        companyId: rule.companyId,
                        ruleId: rule.id,
                        taskId: mode === 'IMMEDIATE' ? tasks[0]?.id : null,
                        sourceKey,
                        recipient,
                        mode,
                        attempts: 1
                    }
                });
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return 'SKIPPED';
                throw error;
            }
        }

        const isDigest = mode === 'DAILY_DIGEST';
        const subject = isDigest
            ? `[RRHH] ${tasks.length} avisos · ${rule.name}`
            : `[RRHH] ${tasks[0].title}`;
        const html = emailShell(
            isDigest ? `Resumen diario: ${rule.name}` : tasks[0].title,
            isDigest
                ? `Tienes ${tasks.length} asuntos pendientes asociados a esta regla.`
                : 'Hay un asunto de RRHH que requiere seguimiento.',
            tasks.map(taskCard).join('')
        );

        try {
            await EmailService.sendMail(recipient, subject, html);
            await prisma.hrAlertDelivery.update({
                where: { id: delivery.id },
                data: { status: 'SENT', sentAt: new Date(), lastError: null }
            });
            return 'SENT';
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error de envío desconocido';
            await prisma.hrAlertDelivery.update({
                where: { id: delivery.id },
                data: { status: 'FAILED', lastError: message.slice(0, 1000) }
            });
            log.error({ error, ruleId: rule.id, recipient }, 'HR alert email delivery failed');
            return 'FAILED';
        }
    }

    static async processCompany(companyId: string) {
        const rules = await prisma.hrAlertRule.findMany({ where: { companyId, enabled: true } });
        const emailRules = rules.filter((rule) => parseStringArray(rule.channels).includes('EMAIL')) as EmailRule[];
        if (!emailRules.length) return { sent: 0, failed: 0, skipped: 0 };
        if (!await EmailService.isConfigured()) {
            log.warn({ companyId }, 'HR alert email channel enabled but SMTP is not configured');
            return { sent: 0, failed: 0, skipped: 0 };
        }

        const tasks = await prisma.hrTask.findMany({
            where: {
                companyId,
                autoGenerated: true,
                status: { in: OPEN_TASK_STATUSES },
                sourceType: { in: emailRules.map((rule) => rule.type) }
            },
            select: {
                id: true,
                sourceKey: true,
                title: true,
                description: true,
                actionUrl: true,
                dueDate: true,
                priority: true,
                sourceType: true,
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                        name: true,
                        manager: { select: { email: true } }
                    }
                }
            }
        });
        const hrRecipients = await this.hrRecipients(companyId);
        const results: string[] = [];
        const dateKey = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Madrid',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());

        for (const rule of emailRules) {
            const ruleTasks = tasks.filter((task) => task.sourceType === rule.type);
            if (rule.emailMode === 'DAILY_DIGEST') {
                const recipientTasks = new Map<string, EmailTask[]>();
                for (const task of ruleTasks) {
                    for (const recipient of this.recipientsForTask(rule, task, hrRecipients)) {
                        recipientTasks.set(recipient, [...(recipientTasks.get(recipient) || []), task]);
                    }
                }
                for (const [recipient, digestTasks] of recipientTasks) {
                    results.push(await this.deliver(rule, recipient, `DIGEST:${dateKey}`, digestTasks, 'DAILY_DIGEST'));
                }
            } else {
                for (const task of ruleTasks) {
                    if (!task.sourceKey) continue;
                    for (const recipient of this.recipientsForTask(rule, task, hrRecipients)) {
                        results.push(await this.deliver(rule, recipient, task.sourceKey, [task], 'IMMEDIATE'));
                    }
                }
            }
        }

        return {
            sent: results.filter((result) => result === 'SENT').length,
            failed: results.filter((result) => result === 'FAILED').length,
            skipped: results.filter((result) => result === 'SKIPPED').length
        };
    }
}
