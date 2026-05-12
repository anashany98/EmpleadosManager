import { EncryptionService } from './EncryptionService';

const EMPLOYEE_DATE_FIELDS = [
    'entryDate', 'exitDate', 'callDate', 'contractInterruptionDate', 'lowDate',
    'dniExpiration', 'birthDate', 'drivingLicenseExpiration'
];

const EMPLOYEE_STRING_FIELDS = [
    'name', 'firstName', 'lastName', 'email', 'phone', 'address', 'city', 'postalCode',
    'subaccount465', 'department', 'socialSecurityNumber', 'iban', 'companyId',
    'category', 'contractType', 'agreementType', 'jobTitle', 'province', 'registeredIn',
    'drivingLicenseType', 'gender', 'managerId', 'lowReason', 'workingDayType',
    'privateNotes', 'country', 'companyPhone', 'companyShortPhone'
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

function mapEmergencyContacts(contacts: unknown) {
    if (!Array.isArray(contacts) || contacts.length === 0) {
        return undefined;
    }

    return contacts.slice(0, 5).map((contact: any) => ({
        name: contact.name,
        phone: contact.phone,
        relationship: contact.relationship
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

export function buildEmployeeCreateData(body: Record<string, any>, effectiveCompanyId: string | null | undefined) {
    const identity = resolveEmployeeIdentity(body);

    return {
        dni: body.dni,
        name: identity.name,
        firstName: identity.firstName,
        lastName: identity.lastName,
        email: body.email,
        phone: body.phone,
        companyPhone: body.companyPhone,
        address: body.address,
        city: body.city,
        postalCode: body.postalCode,
        subaccount465: body.subaccount465 || null,
        socialSecurityNumber: EncryptionService.encrypt(body.socialSecurityNumber),
        iban: EncryptionService.encrypt(body.iban),
        companyId: effectiveCompanyId,
        department: body.department,
        category: body.category,
        contractType: body.contractType,
        agreementType: body.agreementType,
        jobTitle: body.jobTitle,
        entryDate: body.entryDate ? new Date(body.entryDate) : undefined,
        callDate: body.callDate ? new Date(body.callDate) : undefined,
        contractInterruptionDate: body.contractInterruptionDate ? new Date(body.contractInterruptionDate) : undefined,
        dniExpiration: body.dniExpiration ? new Date(body.dniExpiration) : undefined,
        birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
        province: body.province || null,
        registeredIn: body.registeredIn || null,
        drivingLicense: body.drivingLicense === true || body.drivingLicense === 'true',
        drivingLicenseType: body.drivingLicenseType || null,
        drivingLicenseExpiration: body.drivingLicenseExpiration ? new Date(body.drivingLicenseExpiration) : undefined,
        emergencyContacts: buildEmergencyContactsCreate(body.emergencyContacts),
        workingDayType: body.workingDayType || 'COMPLETE',
        weeklyHours: body.weeklyHours ? parseFloat(body.weeklyHours) : null,
        gender: body.gender || null,
        managerId: body.managerId || null,
        privateNotes: body.privateNotes || null,
  annualGrossSalary: body.annualGrossSalary ? parseFloat(body.annualGrossSalary) : 0,
  monthlyGrossSalary: body.monthlyGrossSalary ? parseFloat(body.monthlyGrossSalary) : 0,
  annualTotalSalary: body.annualTotalSalary ? parseFloat(body.annualTotalSalary) : 0,
  monthlyTotalSalary: body.monthlyTotalSalary ? parseFloat(body.monthlyTotalSalary) : 0,
  companyShortPhone: body.companyShortPhone || null,
        country: body.country || 'España',
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

    if (body.active !== undefined) {
        updateData.active = body.active;
    }

    if (body.drivingLicense !== undefined) {
        updateData.drivingLicense = body.drivingLicense === true || body.drivingLicense === 'true';
    }

    if (body.weeklyHours !== undefined) {
        updateData.weeklyHours = body.weeklyHours ? parseFloat(body.weeklyHours) : null;
    }

    if (body.annualGrossSalary !== undefined) {
        updateData.annualGrossSalary = body.annualGrossSalary ? parseFloat(body.annualGrossSalary) : 0;
    }

  if (body.monthlyGrossSalary !== undefined) {
    updateData.monthlyGrossSalary = body.monthlyGrossSalary ? parseFloat(body.monthlyGrossSalary) : 0;
  }

  if (body.annualTotalSalary !== undefined) {
    updateData.annualTotalSalary = body.annualTotalSalary ? parseFloat(body.annualTotalSalary) : 0;
  }

  if (body.monthlyTotalSalary !== undefined) {
    updateData.monthlyTotalSalary = body.monthlyTotalSalary ? parseFloat(body.monthlyTotalSalary) : 0;
  }

    if (updateData.socialSecurityNumber) {
        updateData.socialSecurityNumber = EncryptionService.encrypt(updateData.socialSecurityNumber);
    }

    if (updateData.iban) {
        updateData.iban = EncryptionService.encrypt(updateData.iban);
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
