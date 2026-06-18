import {
    AccessTarget,
    canAccessPolicy,
    SELF_EDITABLE_EMPLOYEE_FIELDS
} from '../../../shared/authz';
import { EncryptionService } from '../services/EncryptionService';
import { SalaryEncryption } from '../services/SalaryEncryption';
import { AuthUser } from '../types/express';

interface EmployeeTargetLike {
    id: string;
    companyId?: string | null;
}

type EmployeeRecord = Record<string, any>;

export function buildEmployeeAccessTarget(employee: EmployeeTargetLike): AccessTarget {
    return {
        employeeId: employee.id,
        companyId: employee.companyId || null
    };
}

export function canReadEmployeeSensitiveData(user: AuthUser, employee: EmployeeTargetLike): boolean {
    return canAccessPolicy('employee.read.sensitive', user, buildEmployeeAccessTarget(employee));
}

export function canReadEmployeeDetail(user: AuthUser, employee: EmployeeTargetLike): boolean {
    return canAccessPolicy('employee.read.detail', user, buildEmployeeAccessTarget(employee));
}

export function canManageEmployee(user: AuthUser, employee: EmployeeTargetLike): boolean {
    return canAccessPolicy('employee.write.company', user, buildEmployeeAccessTarget(employee));
}

export function canSelfEditEmployee(user: AuthUser, employee: EmployeeTargetLike): boolean {
    return canAccessPolicy('employee.write.self', user, buildEmployeeAccessTarget(employee));
}

export function sanitizeEmployeeListItem(employee: EmployeeRecord) {
    const {
        socialSecurityNumber,
        iban,
        annualGrossSalary,
        monthlyGrossSalary,
        annualTotalSalary,
        monthlyTotalSalary,
        privateNotes,
        payrollRows,
        users,
        companyShortPhone,
        subaccount465,
        ...safeEmployee
    } = employee;

    void socialSecurityNumber;
    void iban;
    void annualGrossSalary;
    void monthlyGrossSalary;
    void annualTotalSalary;
    void monthlyTotalSalary;
    void privateNotes;
    void payrollRows;
    void users;
    void companyShortPhone;
    void subaccount465;

    return safeEmployee;
}

export function sanitizeEmployeeDetail(employee: EmployeeRecord, includeSensitive: boolean) {
    const safeEmployee = sanitizeEmployeeListItem(employee);

    if (!includeSensitive) {
        return safeEmployee;
    }

    // Decrypt sensitive fields. The salary fields are stored
    // encrypted-at-rest; we delegate to SalaryEncryption so the
    // plaintext is reconstructed from the *Enc columns.
    const decryptedSalaries = SalaryEncryption.decryptEmployeeSalaries(employee);

    return {
        ...safeEmployee,
        socialSecurityNumber: EncryptionService.decrypt(employee.socialSecurityNumber),
        iban: EncryptionService.decrypt(employee.iban),
        annualGrossSalary: decryptedSalaries.annualGrossSalary,
        monthlyGrossSalary: decryptedSalaries.monthlyGrossSalary,
        annualTotalSalary: decryptedSalaries.annualTotalSalary,
        monthlyTotalSalary: decryptedSalaries.monthlyTotalSalary,
        privateNotes: employee.privateNotes,
        payrollRows: employee.payrollRows
    };
}

export function buildEmployeePortabilityReport(employee: EmployeeRecord, generatedBy: string) {
    return {
        ...employee,
        socialSecurityNumber: EncryptionService.decrypt(employee.socialSecurityNumber),
        iban: EncryptionService.decrypt(employee.iban),
        _metadata: {
            reportGeneratedAt: new Date(),
            generatedBy,
            legalBasis: 'RGPD - Derecho de Acceso / Portabilidad'
        }
    };
}

export function buildSelfEmployeeUpdateData(body: Record<string, any>) {
    const updateData: Record<string, any> = {};

    SELF_EDITABLE_EMPLOYEE_FIELDS.forEach((field) => {
        if (field === 'emergencyContacts') {
            return;
        }

        if (body[field] !== undefined) {
            updateData[field] = body[field];
        }
    });

    if (Array.isArray(body.emergencyContacts)) {
        updateData.emergencyContacts = {
            deleteMany: {},
            create: body.emergencyContacts.slice(0, 5).map((contact: Record<string, any>) => ({
                name: contact.name,
                phone: contact.phone,
                relationship: contact.relationship
            }))
        };
    }

    return updateData;
}
