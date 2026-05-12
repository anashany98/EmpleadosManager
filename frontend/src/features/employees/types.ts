export interface Employee {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    dni: string;
    subaccount465: string;
    department?: string;
    phone?: string;
    active: boolean;
}

export interface FilterState {
    department: string;
    status: 'all' | 'active' | 'inactive';
}

export interface EmployeeImportField {
    key: string;
    label: string;
    group: string;
    required: boolean;
    description?: string;
}

export interface EmployeeImportSuggestion {
    fieldKey: string;
    header: string;
    confidence: 'high' | 'medium' | 'low';
    score: number;
    reason: string;
}

export interface EmployeeImportColumn {
    header: string;
    sampleValues: string[];
    assignedFieldKey: string | null;
}

export interface EmployeeImportPreviewRow {
    rowNumber: number;
    mapped: Record<string, string>;
    warnings: string[];
}

export interface EmployeeImportPreview {
    source: 'excel' | 'csv';
    headers: string[];
    totalRows: number;
    availableFields: EmployeeImportField[];
    currentMapping: Record<string, string>;
    suggestions: EmployeeImportSuggestion[];
    columns: EmployeeImportColumn[];
    previewRows: EmployeeImportPreviewRow[];
    warnings: string[];
    unmappedHeaders: string[];
    stats: {
        mappedFields: number;
        unmappedHeaders: number;
        rowsWithWarnings: number;
    };
}
