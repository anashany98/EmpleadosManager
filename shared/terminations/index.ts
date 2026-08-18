// Fuente única de tipos de baja y motivos de cese, compartida por backend
// (OffboardingService, ExcelService) y frontend (reportes, diálogo de
// desactivación y asistente de offboarding) para que las etiquetas no
// puedan divergir entre capas.

export const TERMINATION_TYPES = ['DISMISSAL', 'VOLUNTARY_LEAVE', 'CONTRACT_END', 'OTHER'] as const;

export type TerminationType = (typeof TERMINATION_TYPES)[number];

export const TERMINATION_TYPE_LABELS: Record<TerminationType, string> = {
    DISMISSAL: 'Despido',
    VOLUNTARY_LEAVE: 'Baja voluntaria',
    CONTRACT_END: 'Fin de contrato',
    OTHER: 'Otra baja'
};

export function getTerminationTypeLabel(value: string | null | undefined): string {
    return value && value in TERMINATION_TYPE_LABELS
        ? TERMINATION_TYPE_LABELS[value as TerminationType]
        : TERMINATION_TYPE_LABELS.OTHER;
}

// Motivos de cese ofrecidos por el asistente de offboarding y el diálogo de
// desactivación de empleados. El código se guarda tal cual en el período
// laboral y la etiqueta es la que se persiste como motivo (endReason/lowReason),
// por eso la etiqueta de aquí es la de referencia para el alta.
export const OFFBOARDING_REASONS = [
    { value: 'BAJA_VOLUNTARIA', label: 'Baja voluntaria / Dimisión', type: 'VOLUNTARY_LEAVE' as const },
    { value: 'FIN_CONTRATO', label: 'Fin de contrato / No superación del periodo de prueba', type: 'CONTRACT_END' as const },
    { value: 'DESPIDO', label: 'Despido', type: 'DISMISSAL' as const },
    { value: 'JUBILACION', label: 'Jubilación', type: 'OTHER' as const },
    { value: 'OTRO', label: 'Otro motivo', type: 'OTHER' as const }
] as const;

export type OffboardingReasonCode = (typeof OFFBOARDING_REASONS)[number]['value'];

export function getOffboardingReason(value: string | null | undefined) {
    return OFFBOARDING_REASONS.find((reason) => reason.value === value);
}
