export interface EmergencyContact {
    name: string;
    phone: string;
    relationship: string;
}

export interface EmployeeFormData {
    firstName: string;
    lastName: string;
    dni: string;
    email: string;
    phone: string;
    companyPhone: string;
    address: string;
    city: string;
    postalCode: string;
    subaccount465: string;
    socialSecurityNumber: string;
    iban: string;
    companyId: string;
    department: string;
    category: string;
    contractType: string;
    agreementType: string;
    jobTitle: string;
    entryDate: string;
    exitDate: string;
    callDate: string;
    contractInterruptionDate: string;
    lowDate: string;
    lowReason: string;
    dniExpiration: string;
    birthDate: string;
    country: string;
    province: string;
    registeredIn: string;
    drivingLicense: boolean;
    drivingLicenseType: string;
    drivingLicenseExpiration: string;
    emergencyContacts: EmergencyContact[];
    workingDayType: string;
    weeklyHours: string;
    gender: string;
    annualGrossSalary: string;
    monthlyGrossSalary: string;
    managerId: string;
    privateNotes: string;
    active: boolean;
}

export interface CompanyOption {
    id: string;
    name: string;
}

export interface EmployeeOption {
    id: string;
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
}

export interface NewEmergencyContact {
    name: string;
    phone: string;
    relationship: string;
}

export interface EmployeeViewRecord {
    id?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    dni?: string;
    department?: string;
    phone?: string;
    companyPhone?: string;
    gender?: string;
    subaccount465?: string;
    vacationDaysTotal?: number;
    entryDate?: string;
    seniorityDate?: string;
    companyId?: string;
    category?: string;
    contractType?: string;
    agreementType?: string;
    jobTitle?: string;
    exitDate?: string;
    callDate?: string;
    contractInterruptionDate?: string;
    lowDate?: string;
    lowReason?: string;
    dniExpiration?: string;
    birthDate?: string;
    country?: string;
    province?: string;
    registeredIn?: string;
    drivingLicense?: boolean;
    drivingLicenseType?: string;
    drivingLicenseExpiration?: string;
    emergencyContacts?: EmergencyContact[];
    workingDayType?: string;
    weeklyHours?: string | number;
    annualGrossSalary?: string | number;
    monthlyGrossSalary?: string | number;
    managerId?: string;
    privateNotes?: string;
    active?: boolean;
    [key: string]: unknown;
}

export interface AuditLogEntry {
    id: string;
    action: string;
    createdAt: string;
    user?: {
        firstName?: string;
        lastName?: string;
    } | null;
}

export interface OvertimeRate {
    category?: string;
    overtimeRate?: number;
    holidayOvertimeRate?: number;
}

export interface OvertimeEntry {
    id: string;
    date: string;
    hours: number;
    rate: number;
    total: number;
}

export const createDefaultEmployeeFormData = (): EmployeeFormData => ({
    firstName: '',
    lastName: '',
    dni: '',
    email: '',
    phone: '',
    companyPhone: '',
    address: '',
    city: '',
    postalCode: '',
    subaccount465: '',
    socialSecurityNumber: '',
    iban: '',
    companyId: '',
    department: '',
    category: '',
    contractType: '',
    agreementType: '',
    jobTitle: '',
    entryDate: '',
    exitDate: '',
    callDate: '',
    contractInterruptionDate: '',
    lowDate: '',
    lowReason: '',
    dniExpiration: '',
    birthDate: '',
    country: 'España',
    province: '',
    registeredIn: '',
    drivingLicense: false,
    drivingLicenseType: '',
    drivingLicenseExpiration: '',
    emergencyContacts: [],
    workingDayType: 'COMPLETE',
    weeklyHours: '',
    gender: '',
    annualGrossSalary: '',
    monthlyGrossSalary: '',
    managerId: '',
    privateNotes: '',
    active: true
});
