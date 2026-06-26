import { z } from 'zod';
import { 
    createDniValidator, 
    createIbanValidator, 
    createEmailValidator, 
    createPhoneValidator 
} from './validationPatterns';

export const createEmployeeSchema = z.object({
    body: z.object({
        dni: createDniValidator(),
        name: z.string().optional(),
        firstName: z.string().min(1, "El nombre es obligatorio"),
        lastName: z.string().min(1, "Los apellidos son obligatorios"),
        email: createEmailValidator(),
        privateNotes: z.string().optional().nullable(),
        subaccount465: z.string().optional().nullable(),
        weeklyHours: z.union([z.string(), z.number()]).optional().nullable(),
        annualGrossSalary: z.union([z.string(), z.number()]).optional().nullable(),
        monthlyGrossSalary: z.union([z.string(), z.number()]).optional().nullable(),
        annualTotalSalary: z.union([z.string(), z.number()]).optional().nullable(),
        monthlyTotalSalary: z.union([z.string(), z.number()]).optional().nullable(),
        companyShortPhone: z.string().optional().nullable(),
        country: z.string().optional(),
        phone: createPhoneValidator(),
        iban: createIbanValidator(),
        emergencyContacts: z.array(z.object({
            name: z.string(),
            phone: createPhoneValidator(),
            relationship: z.string().optional().nullable()
        })).optional().nullable()
    }),
});

export const updateEmployeeSchema = z.object({
    body: z.object({
        dni: createDniValidator().optional(),
        name: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: createEmailValidator(),
        privateNotes: z.string().optional().nullable(),
        subaccount465: z.string().optional().nullable(),
        weeklyHours: z.union([z.string(), z.number()]).optional().nullable(),
        annualGrossSalary: z.union([z.string(), z.number()]).optional().nullable(),
        monthlyGrossSalary: z.union([z.string(), z.number()]).optional().nullable(),
        annualTotalSalary: z.union([z.string(), z.number()]).optional().nullable(),
        monthlyTotalSalary: z.union([z.string(), z.number()]).optional().nullable(),
        companyShortPhone: z.string().optional().nullable(),
        phone: createPhoneValidator(),
        iban: createIbanValidator(),
        address: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        postalCode: z.string().optional().nullable(),
        socialSecurityNumber: z.string().optional().nullable(),
        companyId: z.string().optional().nullable(),
        department: z.string().optional().nullable(),
        category: z.string().optional().nullable(),
        contractType: z.string().optional().nullable(),
        agreementType: z.string().optional().nullable(),
        jobTitle: z.string().optional().nullable(),
        entryDate: z.union([z.string(), z.date()]).optional().nullable(),
        exitDate: z.union([z.string(), z.date()]).optional().nullable(),
        callDate: z.union([z.string(), z.date()]).optional().nullable(),
        contractInterruptionDate: z.union([z.string(), z.date()]).optional().nullable(),
        lowDate: z.union([z.string(), z.date()]).optional().nullable(),
        lowReason: z.string().optional().nullable(),
        dniExpiration: z.union([z.string(), z.date()]).optional().nullable(),
        birthDate: z.union([z.string(), z.date()]).optional().nullable(),
        province: z.string().optional().nullable(),
        registeredIn: z.string().optional().nullable(),
        drivingLicense: z.union([z.boolean(), z.string()]).optional(),
        drivingLicenseType: z.string().optional().nullable(),
        drivingLicenseExpiration: z.union([z.string(), z.date()]).optional().nullable(),
        gender: z.string().optional().nullable(),
        workingDayType: z.string().optional().nullable(),
        managerId: z.string().optional().nullable(),
        active: z.boolean().optional(),
        vacationDaysTotal: z.union([z.string(), z.number()]).optional().nullable(),
        vacationYear: z.coerce.number().int().optional().optional(),
        vacationAnnualQuota: z.coerce.number().optional().nullable(),
        vacationCarryOver: z.coerce.number().optional().nullable(),
        vacationImportedUsed: z.coerce.number().optional().nullable(),
        emergencyContacts: z.array(z.object({
            name: z.string(),
            phone: createPhoneValidator(),
            relationship: z.string().optional().nullable()
        })).optional().nullable()
    }),
});

export const updateEmployeePrivateNotesSchema = z.object({
    body: z.object({
        note: z.string().optional().nullable()
    })
});

export const employeeVacationBalanceQuerySchema = z.object({
    query: z.object({
        year: z.coerce.number().int().min(2000).max(2100).optional()
    })
});

export const updateEmployeeVacationBalanceSchema = z.object({
    body: z.object({
        year: z.coerce.number().int().min(2000).max(2100),
        annualQuotaDays: z.coerce.number().min(0).max(366),
        carriedOverDays: z.coerce.number().min(0).max(1000),
        importedUsedDays: z.coerce.number().min(0).max(1000),
        advancedDays: z.coerce.number().min(0).max(366).optional()
    })
});
