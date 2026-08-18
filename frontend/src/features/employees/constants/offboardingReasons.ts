export type OffboardingTerminationType = 'DISMISSAL' | 'VOLUNTARY_LEAVE' | 'CONTRACT_END' | 'OTHER';

export interface OffboardingReason {
    value: string;
    label: string;
    type: OffboardingTerminationType;
}

// Única fuente de motivos de cese. La usan el asistente de offboarding
// (OffboardingWizard) y el diálogo de desactivación de empleados
// (EmployeeDeactivationDialog) para que ambas vistas ofrezcan exactamente
// las mismas opciones y etiquetas. Los códigos coinciden con
// OFFBOARDING_REASONS del backend (OffboardingService).
export const OFFBOARDING_REASONS: OffboardingReason[] = [
    { value: 'BAJA_VOLUNTARIA', label: 'Baja Voluntaria / Dimisión', type: 'VOLUNTARY_LEAVE' },
    { value: 'FIN_CONTRATO', label: 'Fin de Contrato / No Superación Prueba', type: 'CONTRACT_END' },
    { value: 'DESPIDO', label: 'Despido', type: 'DISMISSAL' },
    { value: 'JUBILACION', label: 'Jubilación', type: 'OTHER' },
    { value: 'OTRO', label: 'Otro motivo', type: 'OTHER' }
];
