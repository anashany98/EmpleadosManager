import { AppError } from './AppError';

/**
 * Valid batch status transitions for payroll import batches.
 * States: UPLOADED → MAPPED → VALID → PAID → CLOSED
 */
const BATCH_STATUS_TRANSITIONS: Record<string, string[]> = {
    'UPLOADED': ['MAPPED', 'CANCELLED'],
    'MAPPED': ['VALID', 'UPLOADED', 'CANCELLED'],
    'VALID': ['PAID', 'MAPPED', 'CANCELLED'],
    'PAID': ['CLOSED', 'VALID'],
    'CLOSED': [], // Terminal state
    'CANCELLED': ['UPLOADED'] // Can reopen
};

/**
 * Validate if a batch status transition is allowed.
 */
export function validateBatchStatusTransition(
    currentStatus: string,
    newStatus: string
): void {
    const allowed = BATCH_STATUS_TRANSITIONS[currentStatus];
    
    if (!allowed) {
        throw new AppError(`Estado de lote desconocido: "${currentStatus}"`, 400);
    }
    
    if (!allowed.includes(newStatus)) {
        throw new AppError(
            `Transición de estado no permitida: "${currentStatus}" → "${newStatus}". ` +
            `Estados permitidos: ${allowed.join(', ') || 'Ninguno (estado terminal)'}`,
            400
        );
    }
}

/**
 * Get allowed next states for a given current state.
 */
export function getAllowedNextStates(currentStatus: string): string[] {
    return BATCH_STATUS_TRANSITIONS[currentStatus] || [];
}

/**
 * Validate batch is in a modifiable state (not CLOSED or PAID).
 */
export function validateBatchModifiable(status: string): void {
    if (status === 'CLOSED' || status === 'PAID') {
        throw new AppError(
            `El lote está en estado "${status}" y no puede ser modificado.`,
            400
        );
    }
}
