// Tipos, constantes y helpers puros de la página de Control General de RRHH.

export const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const PERIOD_STATUS_LABELS: Record<string, string> = {
    DRAFT: 'Borrador',
    IN_REVIEW: 'En revisión',
    CLOSED: 'Cerrado',
    EXPORTED: 'Exportado',
    SENT_TO_AGENCY: 'Enviado',
    REOPENED: 'Reabierto'
};

export interface MonthlyHistoryItem {
    id: string;
    year: number;
    month: number;
    status: string;
    employeeCount: number;
    completedEmployeeCount?: number;
    totalOvertimeAmount: string | number;
    totalDiets: string | number;
    totalGross: string | number;
    exportCount: number;
    updatedAt?: string;
}

export interface PayrollExportHistoryItem {
    id: string;
    filename: string;
    templateHash: string;
    outputHash: string;
    createdAt: string;
    createdBy: { id: string; email: string };
}

export interface ReviewSummary {
    missingCodes: number;
    missingRates: number;
    manualOverrides: number;
    withValues: number;
}

export interface GrandTotals {
    overtimeAmount: number;
    positiveVar: number;
    negativeVar: number;
    diets: number;
    gross: number;
    productivity: number;
    hoursAmount: number;
    difference: number;
    trabajadas: number;
    planificadas: number;
    horarioDiferencia: number;
}

// Suma del control horario de un registro: las entradas diarias ya viajan
// en cada registro (recordInclude.dailyEntries). Estas tres columnas hacen
// que la revisión mensual CALCULE el control horario igual que la rejilla
// del empleado (trabajadas/planificadas/diferencia).
export const controlHorarioTotals = (record: any) => {
    const entries = record?.dailyEntries || [];
    const trabajadas = entries.reduce((sum: number, entry: any) => sum + Number(entry.workedHours || 0), 0);
    const planificadas = entries.reduce((sum: number, entry: any) => sum + Number(entry.scheduledHours || 0), 0);
    return { trabajadas, planificadas, diferencia: trabajadas - planificadas };
};
