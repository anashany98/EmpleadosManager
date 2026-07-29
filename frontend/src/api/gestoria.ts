/**
 * API client para el módulo "Preparación para gestoría".
 *
 * Tipos compartidos con el backend (Prisma genera los tipos pero
 * aquí los declaramos manualmente para no importar Prisma en el
 * bundle del frontend). Mantener en sync con `schema.prisma`.
 */
import { api, API_URL } from './client';

export type GestoriaPeriodStatus = 'OPEN' | 'CLOSED';

export type GestoriaConceptType = 'HOURS' | 'PRICE' | 'AMOUNT' | 'PERCENT' | 'BOOLEAN' | 'TEXT';

export interface GestoriaPeriod {
    id: string;
    companyId: string;
    year: number;
    month: number;
    status: GestoriaPeriodStatus;
    exportMapping: Record<string, string> | null;
    notes: string | null;
    closedAt: string | null;
    closedById: string | null;
    reopenReason: string | null;
    reopenedAt: string | null;
    reopenedById: string | null;
    createdById: string;
    createdAt: string;
    updatedAt: string;
    _count?: {
        rows: number;
        concepts: number;
        exportLogs: number;
    };
}

export interface GestoriaConcept {
    id: string;
    periodId: string;
    code: string;
    label: string;
    type: GestoriaConceptType;
    decimals: number;
    isSystem: boolean;
    isVisible: boolean;
    order: number;
    /**
     * Codigo de plantilla .xls de gestoria al que se mapea este
     * concepto (p. ej. "044" → columna D en la plantilla estandar).
     * Si es null/undefined, el concepto no se exporta salvo que se
     * defina manualmente en la pantalla de export.
     */
    gestoriaCode: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface GestoriaCell {
    id: string;
    rowId: string;
    conceptId: string;
    numericValue: number | null;
    textValue: string | null;
    sourceType: string | null;
    sourceRefId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface GestoriaEmployeeRow {
    id: string;
    periodId: string;
    employeeId: string | null;
    employeeName: string;
    department: string | null;
    category: string | null;
    observations: string | null;
    isReviewed: boolean;
    reviewedAt: string | null;
    reviewedById: string | null;
    totalHours: number | null;
    totalAmount: number | null;
    createdAt: string;
    updatedAt: string;
    cells?: GestoriaCell[];
}

export interface GestoriaColumnView {
    id: string;
    userId: string;
    periodId: string;
    viewName: string;
    columnOrder: string[];
    hiddenConcepts: string[];
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

// ─── Summary (cálculo BRUTO/IRPF/TGSS) ──────────────────────────────

export interface GestoriaSummaryRow {
    rowId: string;
    employeeId: string | null;
    employeeName: string;
    department: string | null;
    category: string | null;
    horasExtra: number;
    horasFinde: number;
    precioExtra: number;
    precioFinde: number;
    totalHorasExtra: number;
    totalHorasFinde: number;
    totalEuros: number;
    irpf: number;
    tgss: number;
    porcentajeNeto: number;
    bruto: number;
    diferencia: number;
    isReviewed: boolean;
}

export interface GestoriaSummary {
    periodId: string;
    detected: {
        horasExtra: string | null;
        horasFinde: string | null;
        precioExtra: string | null;
        precioFinde: string | null;
        irpf: string | null;
        tgss: string | null;
        missing: string[];
    };
    rows: GestoriaSummaryRow[];
    totals: {
        horasExtra: number;
        horasFinde: number;
        totalEuros: number;
        bruto: number;
        diferencia: number;
    };
    byCategory: Array<{ category: string; employees: number; totalEuros: number; bruto: number }>;
}

export interface GestoriaExportLog {
    id: string;
    periodId: string;
    generatedById: string;
    outputFilename: string;
    fileSize: number;
    fileHash: string;
    rowCount: number;
    totalAmount: number | null;
    mappingSnapshot: Record<string, string>;
    notes: string | null;
    downloadCount: number;
    generatedAt: string;
}

export interface GestoriaExportPreview {
    rowCount: number;
    totalAmount: number;
    missingMappings: string[];
    /**
     * Mapping EFFECTIVO que se usara al generar (mezcla de gestoriaCode
     * auto-derivado + exportMapping manual). El UI lo muestra tal cual.
     */
    effectiveMapping: Record<string, string>;
    /** Solo el mapping manual del periodo (lo que escribio el operador). */
    manualMapping: Record<string, string>;
    /** Solo el mapping auto-derivado de los `gestoriaCode` de los conceptos. */
    autoMapping: Record<string, string>;
    sample: Array<{ sheet?: string; values: Record<string, unknown> }>;
    templateReady: boolean;
    templatePath: string;
    passwordConfigured: boolean;
    /** Codigos de plantilla .xls soportados (044, 048, 050, 182, 434, 604, 791). */
    supportedGestoriaCodes: string[];
}

/** @deprecated mantener por retro-compat: alias de `effectiveMapping`. */
export interface LegacyGestoriaExportPreview {
    exportMapping: Record<string, string>;
}

export interface GestoriaExportResult {
    logId: string;
    outputFilename: string;
    fileSize: number;
    fileHash: string;
    rowCount: number;
    totalAmount: number | null;
    missingMappings: string[];
}

const base = '/gestoria';

export const gestoriaApi = {
    // Periods
    listPeriods: (companyId: string, status?: GestoriaPeriodStatus) =>
        api.get<GestoriaPeriod[]>(`${base}/companies/${companyId}/periods`, {
            params: status ? { status } : undefined
        }),
    createPeriod: (companyId: string, body: { year: number; month: number; notes?: string }) =>
        api.post<GestoriaPeriod>(`${base}/companies/${companyId}/periods`, body),
    getPeriod: (id: string) => api.get<GestoriaPeriod>(`${base}/periods/${id}`),
    updatePeriod: (id: string, body: { notes?: string | null; exportMapping?: Record<string, string> | null }) =>
        api.patch<GestoriaPeriod>(`${base}/periods/${id}`, body),
    closePeriod: (id: string) => api.post<GestoriaPeriod>(`${base}/periods/${id}/close`, {}),
    reopenPeriod: (id: string, reason: string) =>
        api.post<GestoriaPeriod>(`${base}/periods/${id}/reopen`, { reason }),

    // Concepts
    listConcepts: (periodId: string, includeHidden = true) =>
        api.get<GestoriaConcept[]>(`${base}/periods/${periodId}/concepts`, {
            params: { includeHidden }
        }),
    createConcept: (periodId: string, body: { code: string; label: string; type: GestoriaConceptType; decimals?: number; gestoriaCode?: string | null }) =>
        api.post<GestoriaConcept>(`${base}/periods/${periodId}/concepts`, body),
    updateConcept: (periodId: string, conceptId: string, body: { label?: string; isVisible?: boolean; order?: number; decimals?: number; gestoriaCode?: string | null }) =>
        api.patch<GestoriaConcept>(`${base}/periods/${periodId}/concepts/${conceptId}`, body),
    deleteConcept: (periodId: string, conceptId: string, force = false) =>
        api.delete<void>(`${base}/periods/${periodId}/concepts/${conceptId}?force=${force}`),

    // Rows
    listRows: (periodId: string, params?: { isReviewed?: boolean; department?: string; category?: string; search?: string }) =>
        api.get<GestoriaEmployeeRow[]>(`${base}/periods/${periodId}/rows`, { params }),
    createRow: (periodId: string, employeeId: string) =>
        api.post<GestoriaEmployeeRow>(`${base}/periods/${periodId}/rows`, { employeeId }),
    getRow: (periodId: string, rowId: string) =>
        api.get<GestoriaEmployeeRow>(`${base}/periods/${periodId}/rows/${rowId}`),
    updateRow: (periodId: string, rowId: string, body: { observations?: string | null; isReviewed?: boolean }) =>
        api.patch<GestoriaEmployeeRow>(`${base}/periods/${periodId}/rows/${rowId}`, body),
    putCells: (periodId: string, rowId: string, cells: Array<{ code: string; value: unknown }>) =>
        api.put<GestoriaEmployeeRow>(`${base}/periods/${periodId}/rows/${rowId}/cells`, { cells }),
    deleteRow: (periodId: string, rowId: string) =>
        api.delete<void>(`${base}/periods/${periodId}/rows/${rowId}`),
    bulk: (
        periodId: string,
        op:
            | { operation: 'setCell'; employeeId: string; code: string; value: unknown }
            | { operation: 'clearCell'; employeeId: string; code: string }
            | { operation: 'setReviewed'; employeeIds: string[]; isReviewed: boolean }
            | { operation: 'deleteRows'; rowIds: string[] }
    ) => api.post<{ affected: number }>(`${base}/periods/${periodId}/rows/bulk`, op),

    // Views
    listViews: (periodId: string) =>
        api.get<GestoriaColumnView[]>(`${base}/periods/${periodId}/views`),
    getDefaultView: (periodId: string) =>
        api.get<GestoriaColumnView | null>(`${base}/periods/${periodId}/views/default`),
    upsertView: (periodId: string, body: { viewName: string; columnOrder: string[]; hiddenConcepts: string[]; isDefault?: boolean }) =>
        api.post<GestoriaColumnView>(`${base}/periods/${periodId}/views`, body),
    deleteView: (periodId: string, viewName: string) =>
        api.delete<void>(`${base}/periods/${periodId}/views/${encodeURIComponent(viewName)}`),

    // Export
    previewExport: (periodId: string) =>
        api.get<GestoriaExportPreview>(`${base}/periods/${periodId}/export/preview`),

    // Summary (cálculo BRUTO/IRPF/TGSS para la pestaña "Resumen")
    getSummary: (periodId: string) =>
        api.get<GestoriaSummary>(`${base}/periods/${periodId}/summary`),
    generateExport: (periodId: string) =>
        api.post<GestoriaExportResult>(`${base}/periods/${periodId}/export`, {}),
    listExportLogs: (periodId: string) =>
        api.get<GestoriaExportLog[]>(`${base}/periods/${periodId}/exports`),
    downloadExport: (periodId: string, logId?: string) => {
        // Construir URL absoluta para que el browser inicie descarga
        return `${API_URL}${base}/periods/${periodId}/export/download${logId ? `?logId=${encodeURIComponent(logId)}` : ''}`;
    }
};
