import { EncryptionService } from './EncryptionService';
import { SalaryEncryption } from './SalaryEncryption';
import { sanitizeText } from '../utils/sanitize';
import { Prisma } from '@prisma/client';

const EMPLOYEE_DATE_FIELDS = [
    'entryDate', 'exitDate', 'callDate', 'contractInterruptionDate', 'lowDate',
    'dniExpiration', 'birthDate', 'drivingLicenseExpiration'
];

const EMPLOYEE_STRING_FIELDS = [
    'name', 'firstName', 'lastName', 'email', 'phone', 'address', 'city', 'postalCode',
    'subaccount465', 'department',
    'category', 'contractType', 'agreementType', 'jobTitle', 'province', 'registeredIn',
    'drivingLicenseType', 'gender', 'managerId', 'lowReason', 'workingDayType',
    'privateNotes', 'country', 'companyPhone', 'companyShortPhone',
    'vacationYear', 'vacationAnnualQuota', 'vacationCarryOver', 'vacationImportedUsed'
];

type EmployeeIdentitySource = {
    name?: unknown;
    firstName?: unknown;
    lastName?: unknown;
};

function normalizeEmployeeIdentityValue(value: unknown): string | null {
    if (typeof value !== 'string') {
        return value == null ? null : String(value).trim() || null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const normalized = trimmed.toLowerCase();
    if (normalized === 'null' || normalized === 'undefined') {
        return null;
    }

    return trimmed;
}

function resolveEmployeeIdentity(source: EmployeeIdentitySource, current?: EmployeeIdentitySource) {
    const firstName = normalizeEmployeeIdentityValue(source.firstName ?? current?.firstName);
    const lastName = normalizeEmployeeIdentityValue(source.lastName ?? current?.lastName);
    const explicitName = source.name !== undefined
        ? normalizeEmployeeIdentityValue(source.name)
        : normalizeEmployeeIdentityValue(current?.name);
    const combinedName = [firstName, lastName].filter(Boolean).join(' ').trim();

    return {
        firstName,
        lastName,
        name: source.name !== undefined
            ? (explicitName || combinedName || '')
            : (combinedName || explicitName || '')
    };
}

function normalizeDni(value: unknown): string | null {
    const text = sanitizeText(value);
    return text ? text.replace(/\s+/g, '').toUpperCase() : null;
}

function normalizeSocialSecurityNumber(value: unknown): string | null {
    const text = sanitizeText(value);
    return text ? text.replace(/[\s-]/g, '') : null;
}

function normalizeIban(value: unknown): string | null {
    const text = sanitizeText(value);
    return text ? text.replace(/\s+/g, '').toUpperCase() : null;
}

function encryptNullable(value: string | null): string | null {
    return value ? EncryptionService.encrypt(value) : null;
}

function mapEmergencyContacts(contacts: unknown) {
    if (!Array.isArray(contacts) || contacts.length === 0) {
        return undefined;
    }

    return contacts.slice(0, 5).map((contact: any) => ({
        name: sanitizeText(contact.name) || '',
        phone: sanitizeText(contact.phone) || '',
        relationship: sanitizeText(contact.relationship)
    }));
}

export function buildEmergencyContactsCreate(contacts: unknown) {
    const mappedContacts = mapEmergencyContacts(contacts);
    if (!mappedContacts) {
        return undefined;
    }

    return { create: mappedContacts };
}

export function buildEmergencyContactsReplace(contacts: unknown) {
    const mappedContacts = mapEmergencyContacts(contacts);
    if (!mappedContacts) {
        return undefined;
    }

    return {
        deleteMany: {},
        create: mappedContacts
    };
}

export function buildEmployeeCreateData(body: Record<string, any>, effectiveCompanyId: string | null | undefined): Prisma.EmployeeUncheckedCreateInput {
    const identity = resolveEmployeeIdentity(body);
    const dni = normalizeDni(body.dni);

    if (!dni) {
        throw new Error('DNI is required to create an employee');
    }

    const encryptedDni = encryptNullable(dni);
    if (!encryptedDni) {
        throw new Error('DNI encryption failed');
    }

    const socialSecurityNumber = normalizeSocialSecurityNumber(body.socialSecurityNumber);
    const encryptedSocialSecurityNumber = encryptNullable(socialSecurityNumber);
    const iban = normalizeIban(body.iban);
    const encryptedIban = encryptNullable(iban);

    return {
        // Keep DNI searchable/unique for login and imports. The encrypted copy is
        // stored in dniEnc for future full PII-at-rest migration.
        dni,
        dniEnc: encryptedDni,
        // `name` is required by the schema. `sanitizeText` returns
        // `string | null`, so we coerce the null branch to the empty
        // string. The validator upstream is responsible for rejecting
        // empty names.
        name: sanitizeText(identity.name) ?? '',
        firstName: sanitizeText(identity.firstName),
        lastName: sanitizeText(identity.lastName),
        email: sanitizeText(body.email),
        phone: sanitizeText(body.phone),
        companyPhone: sanitizeText(body.companyPhone),
        address: sanitizeText(body.address),
        city: sanitizeText(body.city),
        postalCode: sanitizeText(body.postalCode),
        subaccount465: sanitizeText(body.subaccount465),
        // Backward-compatible encrypted legacy columns plus new *Enc source fields.
        socialSecurityNumber: encryptedSocialSecurityNumber,
        socialSecurityNumberEnc: encryptedSocialSecurityNumber,
        iban: encryptedIban,
        ibanEnc: encryptedIban,
        companyId: effectiveCompanyId ?? undefined,
        department: sanitizeText(body.department),
        category: sanitizeText(body.category),
        contractType: sanitizeText(body.contractType),
        agreementType: sanitizeText(body.agreementType),
        jobTitle: sanitizeText(body.jobTitle),
        entryDate: body.entryDate ? new Date(body.entryDate) : undefined,
        callDate: body.callDate ? new Date(body.callDate) : undefined,
        contractInterruptionDate: body.contractInterruptionDate ? new Date(body.contractInterruptionDate) : undefined,
        dniExpiration: body.dniExpiration ? new Date(body.dniExpiration) : undefined,
        birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
        province: sanitizeText(body.province),
        registeredIn: sanitizeText(body.registeredIn),
        drivingLicense: body.drivingLicense === true || body.drivingLicense === 'true',
        drivingLicenseType: sanitizeText(body.drivingLicenseType),
        drivingLicenseExpiration: body.drivingLicenseExpiration ? new Date(body.drivingLicenseExpiration) : undefined,
        emergencyContacts: buildEmergencyContactsCreate(body.emergencyContacts),
        workingDayType: body.workingDayType || 'COMPLETE',
        weeklyHours: body.weeklyHours ? parseFloat(body.weeklyHours) : null,
        gender: body.gender || null,
        managerId: body.managerId || null,
        privateNotes: sanitizeText(body.privateNotes),
        annualGrossSalary: 0,
        monthlyGrossSalary: 0,
        annualTotalSalary: 0,
        monthlyTotalSalary: 0,
        // Salaries are encrypted at rest via SalaryEncryption. The
        // helper below populates the `*Enc` columns with AES-256-GCM
        // ciphertext and zeroes the legacy Decimal columns.
        ...SalaryEncryption.applyEncryptedSalaries({}, body),
        companyShortPhone: sanitizeText(body.companyShortPhone),
        country: sanitizeText(body.country) || 'España',
        active: true
    };
}

export function buildCompanyEmployeeUpdateData(body: Record<string, any>, current?: EmployeeIdentitySource) {
    const updateData: Record<string, any> = {};

    EMPLOYEE_STRING_FIELDS.forEach((field) => {
        if (body[field] !== undefined) {
            updateData[field] = body[field];
        }
    });

    EMPLOYEE_DATE_FIELDS.forEach((field) => {
        if (body[field] !== undefined) {
            updateData[field] = body[field] ? new Date(body[field]) : null;
        }
    });

    // Prisma 5.x requires relation syntax for FK columns on update operations.
    // The generated client does NOT accept `<fkField>: '...'` as an update arg,
    // so we translate every `<relation>Id` body field to `<relation>: { connect }`.
    const RELATION_FK_FIELDS: Record<string, string> = {
        companyId: 'company',
        managerId: 'manager',
    };
    for (const [fkField, relation] of Object.entries(RELATION_FK_FIELDS)) {
        if (body[fkField] !== undefined) {
            if (body[fkField] === null || body[fkField] === '') {
                updateData[relation] = { disconnect: true };
            } else {
                updateData[relation] = { connect: { id: body[fkField] } };
            }
        }
    }

    if (body.active !== undefined) {
        updateData.active = body.active;
    }

    if (body.drivingLicense !== undefined) {
        updateData.drivingLicense = body.drivingLicense === true || body.drivingLicense === 'true';
    }

    if (body.weeklyHours !== undefined) {
        updateData.weeklyHours = body.weeklyHours ? parseFloat(body.weeklyHours) : null;
    }

    // Salaries: encrypt via SalaryEncryption. The helper zeroes the
    // legacy Decimal column so the encrypted column is the only
    // authoritative source. We invoke the helper for each defined
    // salary field individually so partial updates (e.g. only
    // annualGrossSalary) preserve the other encrypted columns.
    const SALARY_FIELDS = SalaryEncryption.SALARY_FIELDS;
    for (const field of SALARY_FIELDS) {
        if (body[field] !== undefined) {
            const encField = SalaryEncryption.FIELD_TO_ENC[field];
            const ciphertext = SalaryEncryption.encryptSalary(body[field]);
            updateData[encField] = ciphertext;
            updateData[field] = 0; // non-authoritative
        }
    }

    if (body.socialSecurityNumber !== undefined) {
        const normalized = normalizeSocialSecurityNumber(body.socialSecurityNumber);
        const encrypted = encryptNullable(normalized);
        updateData.socialSecurityNumber = encrypted;
        updateData.socialSecurityNumberEnc = encrypted;
    }

    if (body.iban !== undefined) {
        const normalized = normalizeIban(body.iban);
        const encrypted = encryptNullable(normalized);
        updateData.iban = encrypted;
        updateData.ibanEnc = encrypted;
    }

    if (body.dni !== undefined) {
        const dni = normalizeDni(body.dni);
        updateData.dni = dni || undefined;
        updateData.dniEnc = encryptNullable(dni);
    }

    const emergencyContacts = buildEmergencyContactsReplace(body.emergencyContacts);
    if (emergencyContacts) {
        updateData.emergencyContacts = emergencyContacts;
    }

    if (body.name !== undefined || body.firstName !== undefined || body.lastName !== undefined) {
        const identity = resolveEmployeeIdentity(body, current);
        updateData.name = identity.name;

        if (body.firstName !== undefined) {
            updateData.firstName = identity.firstName;
        }

        if (body.lastName !== undefined) {
            updateData.lastName = identity.lastName;
        }
    }

    return updateData;
}
