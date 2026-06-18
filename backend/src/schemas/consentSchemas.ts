import { z } from 'zod';
import { CONSENT_PURPOSES } from '../services/ConsentService';

const purposeValues = Object.values(CONSENT_PURPOSES) as [string, ...string[]];

export const consentGrantSchema = z.object({
    body: z.object({
        purpose: z.enum(purposeValues as [typeof purposeValues[number], ...typeof purposeValues[number][]]),
        granted: z.boolean().optional().default(true),
        employeeId: z.string().uuid().optional(),
        policyVersion: z.string().min(1).max(20).optional(),
        notes: z.string().max(500).optional()
    })
});

export const consentIdParamSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    })
});

export const consentEmployeeParamSchema = z.object({
    params: z.object({
        employeeId: z.string().uuid()
    })
});
