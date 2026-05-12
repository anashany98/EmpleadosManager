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
        name: z.string().optional(),
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
        importedUsedDays: z.coerce.number().min(0).max(1000)
    })
});
