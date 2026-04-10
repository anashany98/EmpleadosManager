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
    'privateNotes', 'country', 'companyPhone'
];

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
    return {
        dni: body.dni,
        name: body.name || `${body.firstName} ${body.lastName}`,
        firstName: body.firstName,
        lastName: body.lastName,
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
        country: body.country || 'España',
        active: true
    };
}

export function buildCompanyEmployeeUpdateData(body: Record<string, any>) {
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

    return updateData;
}

