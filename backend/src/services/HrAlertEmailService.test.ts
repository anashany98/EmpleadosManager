import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, sendMail } = vi.hoisted(() => ({
    sendMail: vi.fn(),
    prismaMock: {
        hrAlertRule: { findMany: vi.fn() },
        hrTask: { findMany: vi.fn() },
        user: { findMany: vi.fn() },
        hrAlertDelivery: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn()
        }
    }
}));

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('./EmailService', () => ({
    EmailService: { sendMail, isConfigured: vi.fn().mockResolvedValue(true) }
}));

import { HrAlertEmailService } from './HrAlertEmailService';

const rule = {
    id: 'rule-1',
    companyId: 'company-1',
    name: 'Contratos próximos a vencer',
    type: 'CONTRACT_EXPIRING',
    severity: 'HIGH',
    channels: '["IN_APP","EMAIL"]',
    emailMode: 'IMMEDIATE',
    emailRecipients: '["direccion@example.com"]',
    emailIncludeHr: true,
    emailIncludeManager: true
};

const task = {
    id: 'task-1',
    sourceKey: 'company-1:CONTRACT_EXPIRING:employee-1',
    title: 'Decidir renovación de contrato',
    description: 'El contrato finaliza pronto.',
    actionUrl: '/employees/employee-1',
    dueDate: new Date('2026-08-15'),
    priority: 'HIGH',
    sourceType: 'CONTRACT_EXPIRING',
    employee: {
        firstName: 'Ana',
        lastName: 'García',
        name: 'Ana García',
        manager: { email: 'responsable@example.com' }
    }
};

describe('HrAlertEmailService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.hrAlertRule.findMany.mockResolvedValue([rule]);
        prismaMock.hrTask.findMany.mockResolvedValue([task]);
        prismaMock.user.findMany.mockResolvedValue([{ email: 'rrhh@example.com' }]);
        prismaMock.hrAlertDelivery.findUnique.mockResolvedValue(null);
        prismaMock.hrAlertDelivery.create.mockImplementation(async ({ data }) => ({ id: `delivery-${data.recipient}`, status: 'PENDING', attempts: 1, ...data }));
        prismaMock.hrAlertDelivery.update.mockImplementation(async ({ data }) => ({ id: 'delivery-1', ...data }));
        sendMail.mockResolvedValue({ success: true, messageId: 'message-1' });
    });

    it('sends an immediate alert to HR, the manager and custom recipients', async () => {
        const result = await HrAlertEmailService.processCompany('company-1');

        expect(result).toEqual({ sent: 3, failed: 0, skipped: 0 });
        expect(sendMail).toHaveBeenCalledTimes(3);
        expect(sendMail.mock.calls.map(([recipient]) => recipient).sort()).toEqual([
            'direccion@example.com',
            'responsable@example.com',
            'rrhh@example.com'
        ]);
        expect(sendMail).toHaveBeenCalledWith(
            'rrhh@example.com',
            '[RRHH] Decidir renovación de contrato',
            expect.stringContaining('Abrir en la aplicación')
        );
    });

    it('does not resend a delivery already marked as sent', async () => {
        prismaMock.hrAlertRule.findMany.mockResolvedValue([
            { ...rule, emailRecipients: '["rrhh@example.com"]', emailIncludeHr: false, emailIncludeManager: false }
        ]);
        prismaMock.hrAlertDelivery.findUnique.mockResolvedValue({ id: 'delivery-1', status: 'SENT', attempts: 1 });

        const result = await HrAlertEmailService.processCompany('company-1');

        expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 });
        expect(sendMail).not.toHaveBeenCalled();
    });
});
