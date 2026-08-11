import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RuleCard } from './HrAlertSettingsPage';
import type { HrAlertRule } from '../features/hr-operations/types';

const rule: HrAlertRule = {
    id: 'rule-1',
    companyId: 'company-1',
    type: 'CONTRACT_EXPIRING',
    name: 'Contratos próximos a vencer',
    description: 'Crea una tarea antes de que finalice un contrato.',
    enabled: true,
    leadDays: 30,
    severity: 'HIGH',
    channels: '["IN_APP"]',
    emailMode: 'IMMEDIATE',
    emailRecipients: '[]',
    emailIncludeHr: true,
    emailIncludeManager: false
};

describe('HrAlertSettings RuleCard', () => {
    it('enables email and saves its delivery options', () => {
        const onSave = vi.fn();
        render(<RuleCard rule={rule} saving={false} onSave={onSave} />);

        fireEvent.click(screen.getByRole('button', { name: /correo electrónico/i }));
        expect(screen.getByText('Entrega por correo')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Otros destinatarios'), {
            target: { value: 'direccion@example.com, rrhh2@example.com' }
        });
        fireEvent.change(screen.getByLabelText('Frecuencia del correo'), {
            target: { value: 'DAILY_DIGEST' }
        });
        fireEvent.click(screen.getByRole('button', { name: /guardar regla/i }));

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            channels: ['IN_APP', 'EMAIL'],
            emailMode: 'DAILY_DIGEST',
            emailRecipients: ['direccion@example.com', 'rrhh2@example.com'],
            emailIncludeHr: true
        }));
    });
});
