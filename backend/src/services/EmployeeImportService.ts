import { isValid, parse as parseDateString } from 'date-fns';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { AuditService } from './AuditService';
import { EncryptionService } from './EncryptionService';
import { withRetry } from '../utils/dbRetry';
import { ExcelParser } from './ExcelParser';
import { createLogger } from './LoggerService';
import { upsertEmployeeVacationBalance } from './VacationBalanceService';
import { AppError } from '../utils/AppError';

const log = createLogger('EmployeeImportService');

type EmployeeImportFieldKey =
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

type FieldValueType = 'string' | 'date' | 'money' | 'boolean' | 'email' | 'phone' | 'dni';
type MatchConfidence = 'high' | 'medium' | 'low';

interface ImportFieldDefinition {
    key: EmployeeImportFieldKey;
    label: string;
    group: string;
    required?: boolean;
    description?: string;
    aliases: string[];
    valueType: FieldValueType;
}

interface ParsedImportFile {
    source: 'excel' | 'csv';
    headers: string[];
    rows: Record<string, any>[];
    meta: {
        encoding?: string;
        delimiter?: string;
    };
}

interface FieldSuggestion {
    fieldKey: EmployeeImportFieldKey;
    header: string;
    confidence: MatchConfidence;
    score: number;
    reason: string;
}

interface ImportPreviewRow {
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

const PREVIEW_ROW_LIMIT = 8;

const IMPORT_FIELDS: ImportFieldDefinition[] = [
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

const FIELD_MAP = new Map(IMPORT_FIELDS.map((field) => [field.key, field]));

function normalizeString(value: string): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function compactNormalize(value: string): string {
    return normalizeString(value).replace(/\s+/g, '');
}

function cleanText(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\s+/g, ' ').trim();
}

function hasMeaningfulRowData(row: Record<string, any>): boolean {
    return Object.values(row).some((value) => cleanText(value) !== '');
}

function detectUtf16Encoding(buffer: Buffer): 'utf-16le' | 'utf-16be' | null {
    if (buffer.length >= 2) {
        if (buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf-16le';
        if (buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf-16be';
    }

    const sampleSize = Math.min(buffer.length, 128);
    let evenNulls = 0;
    let oddNulls = 0;

    for (let index = 0; index < sampleSize; index += 1) {
        if (buffer[index] !== 0x00) continue;
        if (index % 2 === 0) {
            evenNulls += 1;
        } else {
            oddNulls += 1;
        }
    }

    const threshold = Math.max(4, Math.floor(sampleSize / 10));
    if (oddNulls >= threshold && oddNulls > evenNulls * 2) return 'utf-16le';
    if (evenNulls >= threshold && evenNulls > oddNulls * 2) return 'utf-16be';
    return null;
}

function decodeCsvBuffer(buffer: Buffer): { text: string; encoding: string } {
    const utf16Encoding = detectUtf16Encoding(buffer);
    if (utf16Encoding) {
        return {
            text: new TextDecoder(utf16Encoding).decode(buffer),
            encoding: utf16Encoding
        };
    }

    try {
        return {
            text: new TextDecoder('utf-8', { fatal: true }).decode(buffer),
            encoding: 'utf-8'
        };
    } catch {
        return {
            text: new TextDecoder('windows-1252').decode(buffer),
            encoding: 'windows-1252'
        };
    }
}

function getFirstNonEmptyLine(text: string): string {
    const lines = text.split(/\r?\n/);
    return lines.find((line) => line.trim()) || '';
}

function countDelimiter(line: string, delimiter: string): number {
    let count = 0;
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') {
            if (inQuotes && line[index + 1] === '"') {
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (!inQuotes && char === delimiter) count += 1;
    }

    return count;
}

function detectDelimiter(text: string): string {
    const firstLine = getFirstNonEmptyLine(text);
    const candidates = [',', ';', '\t', '|'];

    let bestDelimiter = ',';
    let bestCount = -1;

    for (const candidate of candidates) {
        const count = countDelimiter(firstLine, candidate);
        if (count > bestCount) {
            bestCount = count;
            bestDelimiter = candidate;
        }
    }

    return bestDelimiter;
}

function parseCsvText(text: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];

        if (inQuotes) {
            if (char === '"') {
                if (text[index + 1] === '"') {
                    currentField += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                currentField += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
            continue;
        }

        if (char === delimiter) {
            currentRow.push(currentField);
            currentField = '';
            continue;
        }

        if (char === '\r') {
            if (text[index + 1] === '\n') index += 1;
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = '';
            continue;
        }

        if (char === '\n') {
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = '';
            continue;
        }

        currentField += char;
    }

    if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }

    return rows
        .map((row) => row.map((cell) => cleanText(cell)))
        .filter((row) => row.some((cell) => cell !== ''));
}

function parseCsvBuffer(buffer: Buffer): ParsedImportFile {
    const decoded = decodeCsvBuffer(buffer);
    const text = decoded.text.replace(/^\uFEFF/, '');
    const delimiter = detectDelimiter(text);
    const parsedRows = parseCsvText(text, delimiter);

    if (parsedRows.length === 0) {
        throw new Error('Archivo CSV vacio o no valido.');
    }

    const headers = parsedRows[0].map((header, index) => cleanText(header) || `Columna ${index + 1}`);
    const rows = parsedRows.slice(1)
        .map((values) => {
            const row: Record<string, string> = {};
            headers.forEach((header, index) => {
                row[header] = cleanText(values[index] || '');
            });
            return row;
        })
        .filter((row) => hasMeaningfulRowData(row));

    return {
        source: 'csv',
        headers,
        rows,
        meta: {
            encoding: decoded.encoding,
            delimiter: delimiter === '\t' ? 'TAB' : delimiter
        }
    };
}

// Maximum number of data rows allowed in an imported Excel file.
// Set high enough for legitimate bulk imports but low enough to keep
// exceljs memory usage bounded. 5000 rows of employee data is well
// above any realistic single-tenant batch.
const MAX_IMPORT_ROWS = 5000;

async function parseInputFile(buffer: Buffer): Promise<ParsedImportFile> {
    const isExcel = buffer[0] === 0x50 && buffer[1] === 0x4b;

    if (isExcel) {
        // Load the workbook ONCE and extract headers + rows in a single
        // pass. Previous implementation called getHeaders() and
        // readSheetAsJson() back-to-back, parsing the entire xlsx twice
        // and doubling peak heap usage (observed OOM in production).
        const parsed = await ExcelParser.readSheetAsJson(buffer, { defval: '' });
        const headers = parsed.headers.map((header, index) => cleanText(header) || `Columna ${index + 1}`);

        if (parsed.rows.length > MAX_IMPORT_ROWS) {
            throw new AppError(
                `El archivo contiene ${parsed.rows.length} filas, pero el máximo permitido es ${MAX_IMPORT_ROWS}. Divide el archivo en lotes más pequeños.`,
                400
            );
        }

        const rows = parsed.rows
            .map((row) => {
                const normalizedRow: Record<string, any> = {};
                headers.forEach((header) => {
                    normalizedRow[header] = row[header] ?? '';
                });
                return normalizedRow;
            })
            .filter((row) => hasMeaningfulRowData(row));

        return {
            source: 'excel',
            headers,
            rows,
            meta: {}
        };
    }

    return parseCsvBuffer(buffer);
}

function collectSampleValues(rows: Record<string, any>[], header: string): string[] {
    const values: string[] = [];

    for (const row of rows) {
        const rawValue = row[header];
        const value = cleanText(rawValue);
        if (!value) continue;
        values.push(value);
        if (values.length >= 3) break;
    }

    return values;
}

function isLikelyEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isLikelyPhone(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 7;
}

function isLikelyDni(value: string): boolean {
    return /^[XYZ]?\d{5,8}[A-Z]$/i.test(value.trim());
}

function parseBool(value: any): boolean {
    if (typeof value === 'boolean') return value;
    const normalized = normalizeString(cleanText(value));
    return ['si', 's', 'yes', 'true', '1', 'x'].includes(normalized);
}

function parseMoney(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    const raw = cleanText(value);
    if (!raw) return null;

    let normalized = raw.replace(/\s+/g, '').replace(/€/g, '');

    if (normalized.includes(',') && normalized.includes('.')) {
        if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
            normalized = normalized.replace(/\./g, '').replace(',', '.');
        } else {
            normalized = normalized.replace(/,/g, '');
        }
    } else if (normalized.includes(',')) {
        normalized = normalized.replace(/\./g, '').replace(',', '.');
    }

    normalized = normalized.replace(/[^0-9.-]/g, '');
    if (!normalized || normalized === '-' || normalized === '.') return null;

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: any): Date | null {
    if (!value && value !== 0) return null;

    if (value instanceof Date) {
        return isValid(value) ? value : null;
    }

    if (typeof value === 'number') {
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        return isValid(date) ? date : null;
    }

    const raw = cleanText(value);
    if (!raw) return null;

    const formats = ['dd/MM/yyyy', 'd/M/yyyy', 'dd-MM-yyyy', 'd-M-yyyy', 'yyyy-MM-dd', 'dd.MM.yyyy', 'd.M.yyyy'];
    for (const format of formats) {
        const parsed = parseDateString(raw, format, new Date());
        if (isValid(parsed)) return parsed;
    }

    const fallback = new Date(raw);
    return isValid(fallback) ? fallback : null;
}

function formatPreviewDate(value: Date | null): string {
    if (!value) return '';
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseWeeklyHours(value: any): number | null {
    return parseMoney(value);
}

function normalizeGender(value: any): string | null {
    const raw = normalizeString(cleanText(value));
    if (!raw) return null;
    if (['hombre', 'masculino', 'male', 'm', 'varon', 'varón'].some((term) => raw.includes(term))) return 'MALE';
    if (['mujer', 'femenino', 'female', 'f'].some((term) => raw.includes(term))) return 'FEMALE';
    if (['otro', 'other', 'no binario'].some((term) => raw.includes(term))) return 'OTHER';
    return null;
}

function normalizeWorkingDayType(value: any): string {
    const raw = normalizeString(cleanText(value));
    if (!raw) return 'COMPLETE';
    if (['parcial', 'partial', 'part time', 'media jornada'].some((term) => raw.includes(term))) return 'PARTIAL';
    return 'COMPLETE';
}

function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function uniqueValues(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean)));
}

function toBigrams(value: string): string[] {
    const normalized = compactNormalize(value);
    if (normalized.length < 2) return normalized ? [normalized] : [];

    const grams: string[] = [];
    for (let index = 0; index < normalized.length - 1; index += 1) {
        grams.push(normalized.slice(index, index + 2));
    }
    return grams;
}

function diceCoefficient(left: string, right: string): number {
    if (!left || !right) return 0;
    if (left === right) return 1;

    const leftBigrams = toBigrams(left);
    const rightBigrams = toBigrams(right);

    if (leftBigrams.length === 0 || rightBigrams.length === 0) return 0;

    const rightPool = [...rightBigrams];
    let matches = 0;

    leftBigrams.forEach((gram) => {
        const matchIndex = rightPool.indexOf(gram);
        if (matchIndex >= 0) {
            matches += 1;
            rightPool.splice(matchIndex, 1);
        }
    });

    return (2 * matches) / (leftBigrams.length + rightBigrams.length);
}

function tokenOverlapScore(left: string, right: string): number {
    const leftTokens = normalizeString(left).split(' ').filter(Boolean);
    const rightTokens = normalizeString(right).split(' ').filter(Boolean);
    if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

    const rightSet = new Set(rightTokens);
    const matches = leftTokens.filter((token) => rightSet.has(token)).length;
    return matches / Math.max(leftTokens.length, rightTokens.length);
}

function similarityScore(left: string, right: string): number {
    const normalizedLeft = normalizeString(left);
    const normalizedRight = normalizeString(right);
    if (!normalizedLeft || !normalizedRight) return 0;
    if (normalizedLeft === normalizedRight) return 1;
    if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return 0.94;
    return Math.max(diceCoefficient(normalizedLeft, normalizedRight), tokenOverlapScore(normalizedLeft, normalizedRight));
}

function normalizeCompanyName(value: string): string {
    return normalizeString(value)
        .replace(/\bsociedad limitada unipersonal\b/g, ' ')
        .replace(/\bsociedad limitada nueva empresa\b/g, ' ')
        .replace(/\bsociedad limitada laboral\b/g, ' ')
        .replace(/\bsociedad limitada\b/g, ' ')
        .replace(/\bsociedad anonima\b/g, ' ')
        .replace(/\bsociedad cooperativa\b/g, ' ')
        .replace(/\bslu\b/g, ' ')
        .replace(/\bsll\b/g, ' ')
        .replace(/\bslne\b/g, ' ')
        .replace(/\bsl\b/g, ' ')
        .replace(/\bsa\b/g, ' ')
        .replace(/\bcoop\b/g, ' ')
        .replace(/\bsc\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function findBestExistingValue(rawValue: string, existingValues: string[], threshold: number): string | null {
    const cleanValue = cleanText(rawValue);
    if (!cleanValue || existingValues.length === 0) return null;

    const normalizedValue = normalizeString(cleanValue);
    const exact = existingValues.find((value) => normalizeString(value) === normalizedValue);
    if (exact) return exact;

    let bestMatch: string | null = null;
    let bestScore = 0;

    existingValues.forEach((candidate) => {
        const score = similarityScore(cleanValue, candidate);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = candidate;
        }
    });

    return bestScore >= threshold ? bestMatch : null;
}

function createTextValueResolver(existingValues: string[], threshold: number) {
    const knownValues = uniqueValues(existingValues);

    return {
        resolve(rawValue: string): string {
            const cleanValue = cleanText(rawValue);
            if (!cleanValue) return '';

            const matched = findBestExistingValue(cleanValue, knownValues, threshold);
            if (matched) return matched;

            knownValues.push(cleanValue);
            return cleanValue;
        }
    };
}

async function createAutoCompany(name: string, auditUserId?: string) {
    let attempts = 0;

    while (attempts < 5) {
        attempts += 1;
        const cif = `AUTO-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;

        try {
            const company = await prisma.company.create({
                data: {
                    name,
                    cif,
                    country: 'España'
                }
            });

            await AuditService.log('CREATE', 'COMPANY', company.id, {
                info: 'Auto-created from employee import',
                name: company.name,
                cif: company.cif
            }, auditUserId);

            return company;
        } catch (error: any) {
            if (error?.code === 'P2002' && attempts < 5) {
                continue;
            }
            throw error;
        }
    }

    throw new Error(`No se pudo crear la empresa automaticamente para "${name}".`);
}

async function buildCompanyResolver(options: ImportOptions, mapping: Partial<Record<EmployeeImportFieldKey, string>>) {
    if (options.forceCompanyId || !mapping.companyName) {
        return {
            async resolve() {
                return { companyId: options.forceCompanyId };
            }
        };
    }

    const knownCompanies = await prisma.company.findMany({
        select: { id: true, name: true, cif: true },
        orderBy: { name: 'asc' }
    });

    return {
        async resolve(rawCompanyName: string) {
            const companyName = cleanText(rawCompanyName);
            if (!companyName) return { companyId: undefined };

            const normalizedCompanyName = normalizeCompanyName(companyName);
            const exactBusinessMatch = knownCompanies.find((company) => normalizeCompanyName(company.name) === normalizedCompanyName);
            if (exactBusinessMatch) {
                return { companyId: exactBusinessMatch.id };
            }

            let matchedCompany = knownCompanies.reduce<{ id: string; name: string; cif: string } | null>((best, company) => {
                const score = similarityScore(normalizeCompanyName(company.name), normalizedCompanyName);
                if (score < 0.78) return best;
                if (!best) return company;
                return similarityScore(normalizeCompanyName(best.name), normalizedCompanyName) >= score ? best : company;
            }, null);
            if (!matchedCompany) {
                const bestMatch = findBestExistingValue(companyName, knownCompanies.map((company) => company.name), 0.78);
                if (bestMatch) {
                    matchedCompany = knownCompanies.find((company) => company.name === bestMatch) || null;
                }
            }

            if (matchedCompany) {
                return { companyId: matchedCompany?.id };
            }

            const createdCompany = await createAutoCompany(companyName, options.auditUserId);
            knownCompanies.push(createdCompany);
            return { companyId: createdCompany.id };
        }
    };
}

async function buildExistingFieldResolvers(options: ImportOptions) {
    const whereClause: any = { active: true };
    if (options.forceCompanyId) {
        whereClause.companyId = options.forceCompanyId;
    }

    const [departments, categories] = await Promise.all([
        prisma.employee.findMany({
            where: { ...whereClause, department: { not: null } },
            select: { department: true },
            distinct: ['department']
        }),
        prisma.employee.findMany({
            where: { ...whereClause, category: { not: null } },
            select: { category: true },
            distinct: ['category']
        })
    ]);

    return {
        departmentResolver: createTextValueResolver(departments.map((row) => row.department || ''), 0.8),
        categoryResolver: createTextValueResolver(categories.map((row) => row.category || ''), 0.8)
    };
}

function detectValueBonus(field: ImportFieldDefinition, sampleValues: string[]): number {
    if (sampleValues.length === 0) return 0;
    const matchCount = sampleValues.filter((value) => {
        if (field.valueType === 'email') return isLikelyEmail(value);
        if (field.valueType === 'phone') return isLikelyPhone(value);
        if (field.valueType === 'dni') return isLikelyDni(value);
        if (field.valueType === 'date') return !!parseDate(value);
        if (field.valueType === 'money') return parseMoney(value) !== null;
        if (field.valueType === 'boolean') return ['si', 'no', 'yes', 'true', 'false', '1', '0'].includes(normalizeString(value));
        return false;
    }).length;

    const ratio = matchCount / sampleValues.length;
    if (ratio >= 1) return 25;
    if (ratio >= 0.66) return 16;
    if (ratio >= 0.33) return 8;
    return 0;
}

function scoreFieldAgainstHeader(
    field: ImportFieldDefinition,
    header: string,
    sampleValues: string[],
    context: { hasLastNameHeader: boolean }
): { score: number; reason: string } {
    const normalizedHeader = normalizeString(header);
    const compactHeader = compactNormalize(header);

    let bestAliasScore = 0;
    let bestAlias = '';

    for (const alias of field.aliases) {
        const normalizedAlias = normalizeString(alias);
        const compactAlias = compactNormalize(alias);

        if (!normalizedAlias) continue;

        let score = 0;
        if (normalizedHeader === normalizedAlias || compactHeader === compactAlias) {
            score = 85;
        } else if (normalizedHeader.includes(normalizedAlias) || normalizedAlias.includes(normalizedHeader)) {
            score = 70;
        } else {
            const headerTokens = new Set(normalizedHeader.split(' ').filter(Boolean));
            const aliasTokens = normalizedAlias.split(' ').filter(Boolean);
            const overlap = aliasTokens.filter((token) => headerTokens.has(token)).length;
            if (overlap > 0) {
                score = 48 + overlap * 8;
            }
        }

        if (score > bestAliasScore) {
            bestAliasScore = score;
            bestAlias = alias;
        }
    }

    if (field.key === 'fullName' && normalizedHeader === 'nombre' && context.hasLastNameHeader) {
        bestAliasScore -= 18;
    }

    if (field.key === 'firstName' && normalizedHeader === 'nombre' && !context.hasLastNameHeader) {
        bestAliasScore -= 18;
    }

    if (field.key === 'phone' && ['movil', 'móvil'].includes(normalizedHeader)) {
        bestAliasScore += 10;
    }

    if (field.key === 'companyPhone' && ['movil', 'móvil', 'telefono', 'teléfono'].includes(normalizedHeader)) {
        bestAliasScore -= 10;
    }

    if (field.key === 'companyName' && normalizedHeader === 'empresa') {
        bestAliasScore += 12;
    }

    const valueBonus = detectValueBonus(field, sampleValues);
    const finalScore = bestAliasScore + valueBonus;
    const reason = bestAliasScore > 0
        ? `Coincide con "${bestAlias}"`
        : valueBonus > 0
            ? 'Detectado por el tipo de dato'
            : '';

    return { score: finalScore, reason };
}

function buildSuggestions(parsed: ParsedImportFile): FieldSuggestion[] {
    const headerSamples = new Map(parsed.headers.map((header) => [header, collectSampleValues(parsed.rows, header)]));
    const hasLastNameHeader = parsed.headers.some((header) => {
        const normalized = normalizeString(header);
        return normalized === 'apellido' || normalized === 'apellidos';
    });

    const candidates: Array<{
        fieldKey: EmployeeImportFieldKey;
        header: string;
        score: number;
        reason: string;
    }> = [];

    for (const field of IMPORT_FIELDS) {
        for (const header of parsed.headers) {
            const { score, reason } = scoreFieldAgainstHeader(field, header, headerSamples.get(header) || [], { hasLastNameHeader });
            if (score >= 52) {
                candidates.push({ fieldKey: field.key, header, score, reason });
            }
        }
    }

    candidates.sort((left, right) => right.score - left.score);

    const assignedFields = new Set<EmployeeImportFieldKey>();
    const assignedHeaders = new Set<string>();
    const suggestions: FieldSuggestion[] = [];

    for (const candidate of candidates) {
        if (assignedFields.has(candidate.fieldKey) || assignedHeaders.has(candidate.header)) continue;

        assignedFields.add(candidate.fieldKey);
        assignedHeaders.add(candidate.header);

        const confidence: MatchConfidence = candidate.score >= 88
            ? 'high'
            : candidate.score >= 70
                ? 'medium'
                : 'low';

        suggestions.push({
            fieldKey: candidate.fieldKey,
            header: candidate.header,
            confidence,
            score: candidate.score,
            reason: candidate.reason || 'Coincidencia aproximada'
        });
    }

    return suggestions.sort((left, right) => IMPORT_FIELDS.findIndex((field) => field.key === left.fieldKey) - IMPORT_FIELDS.findIndex((field) => field.key === right.fieldKey));
}

function sanitizeMapping(
    providedMapping: Partial<Record<EmployeeImportFieldKey, string>> | undefined,
    headers: string[]
): Partial<Record<EmployeeImportFieldKey, string>> {
    if (!providedMapping) return {};

    const headerSet = new Set(headers);
    const sanitized: Partial<Record<EmployeeImportFieldKey, string>> = {};

    for (const [fieldKey, header] of Object.entries(providedMapping)) {
        if (!FIELD_MAP.has(fieldKey as EmployeeImportFieldKey)) continue;
        if (!header || !headerSet.has(header)) continue;
        sanitized[fieldKey as EmployeeImportFieldKey] = header;
    }

    return sanitized;
}

function buildCurrentMapping(
    parsed: ParsedImportFile,
    providedMapping?: Partial<Record<EmployeeImportFieldKey, string>>
): {
    currentMapping: Partial<Record<EmployeeImportFieldKey, string>>;
    suggestions: FieldSuggestion[];
} {
    const suggestions = buildSuggestions(parsed);

    if (providedMapping !== undefined) {
        return {
            currentMapping: sanitizeMapping(providedMapping, parsed.headers),
            suggestions
        };
    }

    const currentMapping: Partial<Record<EmployeeImportFieldKey, string>> = {};
    suggestions.forEach((suggestion) => {
        currentMapping[suggestion.fieldKey] = suggestion.header;
    });

    return { currentMapping, suggestions };
}

function getMappedRawValue(
    row: Record<string, any>,
    mapping: Partial<Record<EmployeeImportFieldKey, string>>,
    fieldKey: EmployeeImportFieldKey
): any {
    const header = mapping[fieldKey];
    return header ? row[header] : undefined;
}

function getMappedString(
    row: Record<string, any>,
    mapping: Partial<Record<EmployeeImportFieldKey, string>>,
    fieldKey: EmployeeImportFieldKey
): string {
    return cleanText(getMappedRawValue(row, mapping, fieldKey));
}

function formatPreviewFieldValue(field: ImportFieldDefinition, rawValue: any): string {
    if (rawValue === null || rawValue === undefined || rawValue === '') return '';

    if (field.valueType === 'date') {
        const parsed = parseDate(rawValue);
        return parsed ? formatPreviewDate(parsed) : cleanText(rawValue);
    }

    if (field.valueType === 'money') {
        const parsed = parseMoney(rawValue);
        return parsed === null ? cleanText(rawValue) : String(parsed);
    }

    if (field.valueType === 'boolean') {
        return parseBool(rawValue) ? 'Si' : 'No';
    }

    return cleanText(rawValue);
}

function buildPreviewRowWarnings(
    row: Record<string, any>,
    rowNumber: number,
    mapping: Partial<Record<EmployeeImportFieldKey, string>>
): string[] {
    const warnings: string[] = [];
    const dni = getMappedString(row, mapping, 'dni');
    const fullName = getMappedString(row, mapping, 'fullName') || [
        getMappedString(row, mapping, 'firstName'),
        getMappedString(row, mapping, 'lastName')
    ].filter(Boolean).join(' ');

    if (!dni) warnings.push(`Fila ${rowNumber}: falta DNI / NIE.`);
    else if (!isLikelyDni(dni)) warnings.push(`Fila ${rowNumber}: el DNI / NIE parece invalido.`);

    if (!fullName) warnings.push(`Fila ${rowNumber}: falta nombre.`);

    for (const field of IMPORT_FIELDS) {
        const rawValue = getMappedRawValue(row, mapping, field.key);
        const textValue = cleanText(rawValue);
        if (!textValue) continue;

        if (field.valueType === 'date' && !parseDate(rawValue)) {
            warnings.push(`Fila ${rowNumber}: ${field.label} no tiene una fecha valida.`);
        }

        if (field.valueType === 'money' && parseMoney(rawValue) === null) {
            warnings.push(`Fila ${rowNumber}: ${field.label} no es numerico.`);
        }

        if (field.valueType === 'email' && !isLikelyEmail(textValue)) {
            warnings.push(`Fila ${rowNumber}: ${field.label} no parece un email valido.`);
        }

        if (field.valueType === 'phone' && !isLikelyPhone(textValue)) {
            warnings.push(`Fila ${rowNumber}: ${field.label} no parece un telefono valido.`);
        }

        if (field.key === 'managerId' && textValue && !isUuid(textValue)) {
            warnings.push(`Fila ${rowNumber}: el responsable no es un ID valido, se ignorara al importar.`);
        }
    }

    return warnings;
}

function buildPreviewRows(
    rows: Record<string, any>[],
    mapping: Partial<Record<EmployeeImportFieldKey, string>>
): ImportPreviewRow[] {
    const mappedFields = IMPORT_FIELDS.filter((field) => !!mapping[field.key]);

    return rows.slice(0, PREVIEW_ROW_LIMIT).map((row, index) => {
        const mapped: Partial<Record<EmployeeImportFieldKey, string>> = {};
        mappedFields.forEach((field) => {
            const rawValue = getMappedRawValue(row, mapping, field.key);
            const formatted = formatPreviewFieldValue(field, rawValue);
            if (formatted) {
                mapped[field.key] = formatted;
            }
        });

        return {
            rowNumber: index + 2,
            mapped,
            warnings: buildPreviewRowWarnings(row, index + 2, mapping)
        };
    });
}

function buildPreviewWarnings(
    parsed: ParsedImportFile,
    mapping: Partial<Record<EmployeeImportFieldKey, string>>,
    previewRows: ImportPreviewRow[],
    suggestions: FieldSuggestion[],
    options: ImportOptions
): string[] {
    const warnings: string[] = [];
    const mappedHeaders = new Set(Object.values(mapping));
    const suggestedMap = new Map(suggestions.map((suggestion) => [suggestion.fieldKey, suggestion]));

    if (!mapping.dni) {
        warnings.push('No se ha asignado la columna de DNI / NIE. Sin ella no se puede importar.');
    }

    if (!mapping.fullName && !mapping.firstName) {
        warnings.push('No se ha asignado ninguna columna de nombre.');
    }

    suggestions.forEach((suggestion) => {
        if (suggestion.confidence === 'low' && mapping[suggestion.fieldKey] === suggestion.header) {
            const field = FIELD_MAP.get(suggestion.fieldKey);
            warnings.push(`Revisa ${field?.label || suggestion.fieldKey}: la deteccion automatica es baja.`);
        }
    });

    if (mapping.companyName && options.forceCompanyId) {
        warnings.push('La empresa viene fija por el usuario actual; la columna Empresa se ignorara al confirmar.');
    }

    if (parsed.meta.encoding) {
        warnings.push(`Archivo ${parsed.source.toUpperCase()} detectado con codificacion ${parsed.meta.encoding}.`);
    }

    if (parsed.meta.delimiter) {
        warnings.push(`Separador CSV detectado: ${parsed.meta.delimiter}.`);
    }

    const rowsWithWarnings = previewRows.filter((row) => row.warnings.length > 0).length;
    if (rowsWithWarnings > 0) {
        warnings.push(`${rowsWithWarnings} fila(s) de la previsualizacion tienen avisos.`);
    }

    const unmappedHeaders = parsed.headers.filter((header) => !mappedHeaders.has(header));
    if (unmappedHeaders.length > 0) {
        warnings.push(`${unmappedHeaders.length} columna(s) del archivo aun no se usan en la importacion.`);
    }

    if (mapping.dni) {
        const dniSuggestion = suggestedMap.get('dni');
        if (!dniSuggestion) {
            warnings.push('La columna de DNI se ha asignado manualmente. Conviene revisar la vista previa antes de confirmar.');
        }
    }

    return warnings;
}

function isExampleRow(dni: string, fullName: string): boolean {
    const normalizedDni = normalizeString(dni);
    const normalizedName = normalizeString(fullName);
    return normalizedDni.includes('ejemplo') || normalizedName.includes('ejemplo');
}

export const EmployeeImportService = {
    previewFile: async (
        buffer: Buffer,
        options: ImportOptions = {},
        providedMapping?: Partial<Record<EmployeeImportFieldKey, string>>
    ): Promise<EmployeeImportPreview> => {
        log.info({ bufferSize: buffer.length, options }, 'Preparing employee import preview');

        const parsed = await parseInputFile(buffer);
        const { currentMapping, suggestions } = buildCurrentMapping(parsed, providedMapping);
        const previewRows = buildPreviewRows(parsed.rows, currentMapping);
        const warnings = buildPreviewWarnings(parsed, currentMapping, previewRows, suggestions, options);
        const mappedHeaders = new Set(Object.values(currentMapping));

        return {
            source: parsed.source,
            headers: parsed.headers,
            totalRows: parsed.rows.length,
            availableFields: IMPORT_FIELDS.map((field) => ({
                key: field.key,
                label: field.label,
                group: field.group,
                required: !!field.required,
                description: field.description
            })),
            currentMapping,
            suggestions,
            columns: parsed.headers.map((header) => ({
                header,
                sampleValues: collectSampleValues(parsed.rows, header),
                assignedFieldKey: (Object.entries(currentMapping).find(([, mappedHeader]) => mappedHeader === header)?.[0] as EmployeeImportFieldKey | undefined) || null
            })),
            previewRows,
            warnings,
            unmappedHeaders: parsed.headers.filter((header) => !mappedHeaders.has(header)),
            stats: {
                mappedFields: Object.keys(currentMapping).length,
                unmappedHeaders: parsed.headers.filter((header) => !mappedHeaders.has(header)).length,
                rowsWithWarnings: previewRows.filter((row) => row.warnings.length > 0).length
            }
        };
    },

    processFile: async (
        buffer: Buffer,
        options: ImportOptions = {},
        providedMapping?: Partial<Record<EmployeeImportFieldKey, string>>
    ) => {
        log.info({ bufferSize: buffer.length, options }, 'Starting employee import');

        const parsed = await parseInputFile(buffer);
        const { currentMapping } = buildCurrentMapping(parsed, providedMapping);
        const companyResolver = await buildCompanyResolver(options, currentMapping);
        const { departmentResolver, categoryResolver } = await buildExistingFieldResolvers(options);
        const importYear = new Date().getFullYear();

        let importedCount = 0;
        const errors: string[] = [];

        for (let index = 0; index < parsed.rows.length; index += 1) {
            const row = parsed.rows[index];
            const rowNumber = index + 2;

            if (!hasMeaningfulRowData(row)) continue;

            const dni = getMappedString(row, currentMapping, 'dni').toUpperCase();
            const fullNameInput = getMappedString(row, currentMapping, 'fullName');
            const firstNameInput = getMappedString(row, currentMapping, 'firstName');
            const lastNameInput = getMappedString(row, currentMapping, 'lastName');
            const fullName = cleanText(fullNameInput || [firstNameInput, lastNameInput].filter(Boolean).join(' '));

            if (isExampleRow(dni, fullName)) continue;

            if (!dni) {
                errors.push(`Fila ${rowNumber}: falta DNI / NIE.`);
                continue;
            }

            if (!fullName) {
                errors.push(`Fila ${rowNumber}: falta nombre del empleado.`);
                continue;
            }

            try {
                const resolvedCompany = await companyResolver.resolve(getMappedString(row, currentMapping, 'companyName'));
                const phone = getMappedString(row, currentMapping, 'phone');
                const companyPhone = getMappedString(row, currentMapping, 'companyPhone');
                const socialSecurityNumber = getMappedString(row, currentMapping, 'socialSecurityNumber');
                const iban = getMappedString(row, currentMapping, 'iban');
                const managerId = getMappedString(row, currentMapping, 'managerId');
                const annualGrossSalary = parseMoney(getMappedRawValue(row, currentMapping, 'annualGrossSalary'));
                const monthlyGrossSalary = parseMoney(getMappedRawValue(row, currentMapping, 'monthlyGrossSalary'));
                const vacationAnnualQuota = parseMoney(getMappedRawValue(row, currentMapping, 'vacationAnnualQuota'));
                const vacationCarryOver = parseMoney(getMappedRawValue(row, currentMapping, 'vacationCarryOver'));
                const vacationImportedUsed = parseMoney(getMappedRawValue(row, currentMapping, 'vacationImportedUsed'));
                const weeklyHours = parseWeeklyHours(getMappedRawValue(row, currentMapping, 'weeklyHours'));
                const firstName = firstNameInput || fullName;
                const lastName = lastNameInput || null;
                const contactName = getMappedString(row, currentMapping, 'emergencyContactName');
                const contactPhone = getMappedString(row, currentMapping, 'emergencyContactPhone');
                const contactRelationship = getMappedString(row, currentMapping, 'emergencyContactRelationship');

                const employeeData: any = {
                    dni,
                    name: fullName,
                    firstName,
                    lastName,
                    email: getMappedString(row, currentMapping, 'email') || null,
                    phone: phone || null,
                    companyPhone: companyPhone || null,
                    address: getMappedString(row, currentMapping, 'address') || null,
                    city: getMappedString(row, currentMapping, 'city') || null,
                    postalCode: getMappedString(row, currentMapping, 'postalCode') || null,
                    province: getMappedString(row, currentMapping, 'province') || null,
                    country: getMappedString(row, currentMapping, 'country') || 'España',
                    subaccount465: getMappedString(row, currentMapping, 'subaccount465') || null,
                    socialSecurityNumber: socialSecurityNumber ? EncryptionService.encrypt(socialSecurityNumber) : null,
                    iban: iban ? EncryptionService.encrypt(iban) : null,
                    gender: normalizeGender(getMappedRawValue(row, currentMapping, 'gender')),
                    dniExpiration: parseDate(getMappedRawValue(row, currentMapping, 'dniExpiration')),
                    birthDate: parseDate(getMappedRawValue(row, currentMapping, 'birthDate')),
                    entryDate: parseDate(getMappedRawValue(row, currentMapping, 'entryDate')),
                    callDate: parseDate(getMappedRawValue(row, currentMapping, 'callDate')),
                    contractInterruptionDate: parseDate(getMappedRawValue(row, currentMapping, 'contractInterruptionDate')),
                    lowDate: parseDate(getMappedRawValue(row, currentMapping, 'lowDate')),
                    department: departmentResolver.resolve(getMappedString(row, currentMapping, 'department')) || null,
                    category: categoryResolver.resolve(getMappedString(row, currentMapping, 'category')) || null,
                    jobTitle: getMappedString(row, currentMapping, 'jobTitle') || null,
                    contractType: getMappedString(row, currentMapping, 'contractType') || null,
                    agreementType: getMappedString(row, currentMapping, 'agreementType') || null,
                    registeredIn: getMappedString(row, currentMapping, 'registeredIn') || null,
                    lowReason: getMappedString(row, currentMapping, 'lowReason') || null,
                    monthlyGrossSalary,
                    annualGrossSalary,
                    drivingLicense: parseBool(getMappedRawValue(row, currentMapping, 'drivingLicense')),
                    drivingLicenseType: getMappedString(row, currentMapping, 'drivingLicenseType') || null,
                    drivingLicenseExpiration: parseDate(getMappedRawValue(row, currentMapping, 'drivingLicenseExpiration')),
                    companyId: resolvedCompany.companyId,
                    managerId: managerId && isUuid(managerId) ? managerId : null,
                    workingDayType: normalizeWorkingDayType(getMappedRawValue(row, currentMapping, 'workingDayType')),
                    weeklyHours,
                    privateNotes: getMappedString(row, currentMapping, 'privateNotes') || null,
                    active: true
                };

                if (contactName || contactPhone) {
                    employeeData.emergencyContacts = {
                        deleteMany: {},
                        create: [{
                            name: contactName || 'Contacto',
                            phone: contactPhone || '',
                            relationship: contactRelationship || null
                        }]
                    };
                }

                const existing = await prisma.employee.findUnique({ where: { dni } });

                if (existing) {
                    const updated = await withRetry(() => prisma.employee.update({
                        where: { id: existing.id },
                        data: employeeData
                    }), { operationName: 'importUpdateEmployee' });
                    await upsertEmployeeVacationBalance(updated, importYear, {
                        annualQuotaDays: vacationAnnualQuota,
                        carriedOverDays: vacationCarryOver,
                        importedUsedDays: vacationImportedUsed
                    });
                    await AuditService.log('UPDATE', 'EMPLOYEE', existing.id, { info: 'Import Bulk Update', name: fullName });
                } else {
                    const created = await withRetry(() => prisma.employee.create({
                        data: employeeData
                    }), { operationName: 'importCreateEmployee' });
                    await upsertEmployeeVacationBalance(created, importYear, {
                        annualQuotaDays: vacationAnnualQuota,
                        carriedOverDays: vacationCarryOver,
                        importedUsedDays: vacationImportedUsed
                    });
                    await AuditService.log('CREATE', 'EMPLOYEE', created.id, { info: 'Import Bulk Create', name: fullName });
                }

                importedCount += 1;
            } catch (error: any) {
                const message = error?.message || String(error);
                log.error({ rowNumber, error: message, stack: error?.stack }, 'Error importing employee row');
                errors.push(`Fila ${rowNumber} (${dni}): ${message}`);
            }
        }

        log.info({ importedCount, errorCount: errors.length }, 'Employee import completed');
        return { importedCount, errors };
    }
};
