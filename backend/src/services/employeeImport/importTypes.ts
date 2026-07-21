export type EmployeeImportFieldKey =
    | 'dni'
    | 'fullName'
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'phone'
    | 'companyPhone'
    | 'address'
    | 'city'
    | 'postalCode'
    | 'province'
    | 'country'
    | 'socialSecurityNumber'
    | 'iban'
    | 'gender'
    | 'subaccount465'
    | 'department'
    | 'category'
    | 'jobTitle'
    | 'contractType'
    | 'agreementType'
    | 'registeredIn'
    | 'managerId'
    | 'workingDayType'
    | 'weeklyHours'
    | 'entryDate'
    | 'birthDate'
    | 'dniExpiration'
    | 'callDate'
    | 'contractInterruptionDate'
    | 'lowDate'
    | 'lowReason'
    | 'monthlyGrossSalary'
    | 'annualGrossSalary'
    | 'vacationAnnualQuota'
    | 'vacationCarryOver'
    | 'vacationImportedUsed'
    | 'drivingLicense'
    | 'drivingLicenseType'
    | 'drivingLicenseExpiration'
    | 'privateNotes'
    | 'emergencyContactName'
    | 'emergencyContactPhone'
    | 'emergencyContactRelationship'
    | 'companyName';

export type FieldValueType = 'string' | 'date' | 'money' | 'boolean' | 'email' | 'phone' | 'dni';
export type MatchConfidence = 'high' | 'medium' | 'low';

export interface ImportFieldDefinition {
    key: EmployeeImportFieldKey;
    label: string;
    group: string;
    required?: boolean;
    description?: string;
    aliases: string[];
    valueType: FieldValueType;
}

export interface ParsedImportFile {
    source: 'excel' | 'csv';
    headers: string[];
    rows: Record<string, any>[];
    meta: {
        encoding?: string;
        delimiter?: string;
    };
}

export interface FieldSuggestion {
    fieldKey: EmployeeImportFieldKey;
    header: string;
    confidence: MatchConfidence;
    score: number;
    reason: string;
}

export interface ImportPreviewRow {
    rowNumber: number;
    mapped: Partial<Record<EmployeeImportFieldKey, string>>;
    warnings: string[];
}

export interface ImportOptions {
    forceCompanyId?: string;
    skipCompanyValidation?: boolean;
    auditUserId?: string;
}

export interface EmployeeImportPreview {
    source: 'excel' | 'csv';
    headers: string[];
    totalRows: number;
    availableFields: Array<{
        key: EmployeeImportFieldKey;
        label: string;
        group: string;
        required: boolean;
        description?: string;
    }>;
    currentMapping: Partial<Record<EmployeeImportFieldKey, string>>;
    suggestions: FieldSuggestion[];
    columns: Array<{
        header: string;
        sampleValues: string[];
        assignedFieldKey: EmployeeImportFieldKey | null;
    }>;
    previewRows: ImportPreviewRow[];
    warnings: string[];
    unmappedHeaders: string[];
    stats: {
        mappedFields: number;
        unmappedHeaders: number;
        rowsWithWarnings: number;
    };
}

export const PREVIEW_ROW_LIMIT = 8;

export const MAX_IMPORT_ROWS = 5000;

export const IMPORT_FIELDS: ImportFieldDefinition[] = [
    {
        key: 'dni',
        label: 'DNI / NIE',
        group: 'Identificacion',
        required: true,
        description: 'Documento identificativo unico del empleado.',
        aliases: ['dni', 'nif', 'nie', 'identificacion', 'identificación', 'documento identidad'],
        valueType: 'dni'
    },
    {
        key: 'fullName',
        label: 'Nombre completo',
        group: 'Personal',
        required: true,
        description: 'Usalo cuando el archivo trae nombre y apellidos en una sola columna.',
        aliases: ['nombre completo', 'nombre y apellidos', 'empleado', 'trabajador', 'name', 'nombre'],
        valueType: 'string'
    },
    {
        key: 'firstName',
        label: 'Nombre',
        group: 'Personal',
        aliases: ['nombre', 'first name', 'firstname', 'given name'],
        valueType: 'string'
    },
    {
        key: 'lastName',
        label: 'Apellidos',
        group: 'Personal',
        aliases: ['apellido', 'apellidos', 'last name', 'lastname', 'surname'],
        valueType: 'string'
    },
    {
        key: 'email',
        label: 'Email',
        group: 'Contacto',
        aliases: ['email', 'e-mail', 'correo', 'correo electronico', 'correo electrónico', 'mail'],
        valueType: 'email'
    },
    {
        key: 'phone',
        label: 'Telefono principal',
        group: 'Contacto',
        aliases: ['telefono', 'teléfono', 'movil', 'móvil', 'mobile', 'celular', 'telefono movil', 'teléfono móvil'],
        valueType: 'phone'
    },
    {
        key: 'companyPhone',
        label: 'Telefono de empresa',
        group: 'Contacto',
        aliases: ['telefono empresa', 'teléfono empresa', 'movil empresa', 'móvil empresa', 'telefono corporativo', 'teléfono corporativo'],
        valueType: 'phone'
    },
    {
        key: 'address',
        label: 'Direccion',
        group: 'Direccion',
        aliases: ['direccion', 'dirección', 'domicilio', 'calle', 'address'],
        valueType: 'string'
    },
    {
        key: 'city',
        label: 'Ciudad',
        group: 'Direccion',
        aliases: ['ciudad', 'poblacion', 'población', 'municipio', 'localidad', 'city'],
        valueType: 'string'
    },
    {
        key: 'postalCode',
        label: 'Codigo postal',
        group: 'Direccion',
        aliases: ['codigo postal', 'código postal', 'cp', 'postal code'],
        valueType: 'string'
    },
    {
        key: 'province',
        label: 'Provincia',
        group: 'Direccion',
        aliases: ['provincia', 'province'],
        valueType: 'string'
    },
    {
        key: 'country',
        label: 'Pais',
        group: 'Direccion',
        aliases: ['pais', 'país', 'country'],
        valueType: 'string'
    },
    {
        key: 'socialSecurityNumber',
        label: 'Numero Seguridad Social',
        group: 'Identificacion',
        aliases: ['seguridad social', 'numero seguridad social', 'nss', 'nº ss', 'n ss'],
        valueType: 'string'
    },
    {
        key: 'iban',
        label: 'IBAN',
        group: 'Financiero',
        aliases: ['iban', 'cuenta bancaria iban'],
        valueType: 'string'
    },
    {
        key: 'gender',
        label: 'Genero',
        group: 'Personal',
        aliases: ['sexo', 'genero', 'género', 'gender'],
        valueType: 'string'
    },
    {
        key: 'subaccount465',
        label: 'Subcuenta 465',
        group: 'Financiero',
        aliases: ['subcuenta 465', 'subcuenta', 'cuenta 465'],
        valueType: 'string'
    },
    {
        key: 'department',
        label: 'Departamento',
        group: 'Laboral',
        aliases: ['departamento', 'area', 'área', 'departament'],
        valueType: 'string'
    },
    {
        key: 'category',
        label: 'Categoria',
        group: 'Laboral',
        aliases: ['categoria', 'categoría', 'grupo profesional'],
        valueType: 'string'
    },
    {
        key: 'jobTitle',
        label: 'Puesto',
        group: 'Laboral',
        aliases: ['puesto', 'cargo', 'job title', 'puesto trabajo'],
        valueType: 'string'
    },
    {
        key: 'contractType',
        label: 'Tipo de contrato',
        group: 'Laboral',
        aliases: ['tipo contrato', 'tipo de contrato', 'contrato'],
        valueType: 'string'
    },
    {
        key: 'agreementType',
        label: 'Convenio',
        group: 'Laboral',
        aliases: ['convenio'],
        valueType: 'string'
    },
    {
        key: 'registeredIn',
        label: 'Empadronado / registrado en',
        group: 'Direccion',
        aliases: ['lugar registro', 'registro', 'empadronado', 'registrado en'],
        valueType: 'string'
    },
    {
        key: 'managerId',
        label: 'Responsable (ID)',
        group: 'Laboral',
        description: 'Solo se importa si el valor es un ID valido de empleado.',
        aliases: ['id responsable', 'responsable id', 'manager id', 'supervisor id', 'responsable'],
        valueType: 'string'
    },
    {
        key: 'workingDayType',
        label: 'Tipo de jornada',
        group: 'Laboral',
        aliases: ['tipo jornada', 'jornada', 'working day type', 'jornada laboral'],
        valueType: 'string'
    },
    {
        key: 'weeklyHours',
        label: 'Horas semanales',
        group: 'Laboral',
        aliases: ['horas semanales', 'horas semana', 'weekly hours'],
        valueType: 'money'
    },
    {
        key: 'entryDate',
        label: 'Fecha de entrada',
        group: 'Fechas',
        aliases: ['fecha entrada', 'fecha antig', 'fecha antig.', 'antiguedad', 'antigüedad', 'fecha alta'],
        valueType: 'date'
    },
    {
        key: 'birthDate',
        label: 'Fecha de nacimiento',
        group: 'Fechas',
        aliases: ['fecha nacimiento', 'fecha nac', 'nacimiento', 'birth date'],
        valueType: 'date'
    },
    {
        key: 'dniExpiration',
        label: 'Caducidad DNI',
        group: 'Fechas',
        aliases: ['dni vencimiento', 'fecha vencimiento dni', 'vencimiento dni', 'caducidad dni'],
        valueType: 'date'
    },
    {
        key: 'callDate',
        label: 'Fecha de llamamiento',
        group: 'Fechas',
        aliases: ['llamada fijo disc', 'llamada', 'llamamiento'],
        valueType: 'date'
    },
    {
        key: 'contractInterruptionDate',
        label: 'Interrupcion contrato',
        group: 'Fechas',
        aliases: ['interrupcion fijo disc', 'interrupción fijo disc', 'interrupcion contrato', 'interrupción contrato'],
        valueType: 'date'
    },
    {
        key: 'lowDate',
        label: 'Fecha baja',
        group: 'Fechas',
        aliases: ['fecha baja', 'baja'],
        valueType: 'date'
    },
    {
        key: 'lowReason',
        label: 'Motivo baja',
        group: 'Laboral',
        aliases: ['motivo baja', 'motivo'],
        valueType: 'string'
    },
    {
        key: 'monthlyGrossSalary',
        label: 'Salario bruto mensual',
        group: 'Financiero',
        aliases: ['sueldo base', 'salario mensual', 'sueldo mensual', 'bruto mensual', 'salario'],
        valueType: 'money'
    },
    {
        key: 'annualGrossSalary',
        label: 'Salario bruto anual',
        group: 'Financiero',
        aliases: ['salario anual', 'sueldo anual', 'bruto anual'],
        valueType: 'money'
    },
    {
        key: 'vacationAnnualQuota',
        label: 'Vacaciones anuales',
        group: 'Vacaciones',
        description: 'Cupo anual del ejercicio actual en dias naturales.',
        aliases: ['vacaciones anuales', 'cupo vacaciones', 'cupo anual vacaciones', 'dias vacaciones anuales', 'dias naturales vacaciones'],
        valueType: 'money'
    },
    {
        key: 'vacationCarryOver',
        label: 'Vacaciones arrastradas',
        group: 'Vacaciones',
        description: 'Dias acumulados del ejercicio anterior.',
        aliases: ['vacaciones arrastradas', 'vacaciones acumuladas', 'arrastre vacaciones', 'saldo arrastrado vacaciones', 'carry over vacaciones'],
        valueType: 'money'
    },
    {
        key: 'vacationImportedUsed',
        label: 'Vacaciones gastadas',
        group: 'Vacaciones',
        description: 'Dias ya consumidos antes de migrar o completar solicitudes en la app.',
        aliases: ['vacaciones gastadas', 'vacaciones usadas', 'vacaciones consumidas', 'dias usados vacaciones', 'dias gastados vacaciones', 'vacaciones disfrutadas'],
        valueType: 'money'
    },
    {
        key: 'drivingLicense',
        label: 'Tiene carnet de conducir',
        group: 'Personal',
        aliases: ['carnet conducir', 'permiso conducir', 'licencia conducir', 'carnet'],
        valueType: 'boolean'
    },
    {
        key: 'drivingLicenseType',
        label: 'Tipo de carnet',
        group: 'Personal',
        aliases: ['tipo carnet', 'tipo permiso'],
        valueType: 'string'
    },
    {
        key: 'drivingLicenseExpiration',
        label: 'Caducidad carnet',
        group: 'Fechas',
        aliases: ['vencimiento carnet', 'caducidad carnet', 'vencimiento permiso'],
        valueType: 'date'
    },
    {
        key: 'privateNotes',
        label: 'Notas privadas',
        group: 'Otros',
        aliases: ['notas', 'notas privadas', 'observaciones', 'comentarios'],
        valueType: 'string'
    },
    {
        key: 'emergencyContactName',
        label: 'Nombre contacto emergencia',
        group: 'Emergencia',
        aliases: ['contacto emergencia nombre', 'nombre contacto emergencia', 'contacto nombre'],
        valueType: 'string'
    },
    {
        key: 'emergencyContactPhone',
        label: 'Telefono contacto emergencia',
        group: 'Emergencia',
        aliases: ['contacto emergencia telefono', 'contacto emergencia teléfono', 'telefono contacto emergencia', 'teléfono contacto emergencia'],
        valueType: 'phone'
    },
    {
        key: 'emergencyContactRelationship',
        label: 'Relacion contacto emergencia',
        group: 'Emergencia',
        aliases: ['contacto emergencia relacion', 'contacto emergencia relación', 'relacion contacto emergencia', 'parentesco'],
        valueType: 'string'
    },
    {
        key: 'companyName',
        label: 'Empresa',
        group: 'Laboral',
        description: 'Solo se usa si la importacion no esta bloqueada a una empresa concreta.',
        aliases: ['empresa', 'empresa centro', 'centro', 'company'],
        valueType: 'string'
    }
];

export const FIELD_MAP = new Map(IMPORT_FIELDS.map((field) => [field.key, field]));
