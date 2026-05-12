import { describe, it, expect } from 'vitest';
import { loginSchema, passwordResetRequestSchema, passwordResetSchema, generateAccessSchema } from './authSchemas';
import { uuidParamSchema, idParamSchema } from './commonSchemas';
import { createEmployeeSchema, updateEmployeeSchema } from './employeeSchemas';
import { vacationCreateSchema } from './vacationSchemas';
import { expenseCreateSchema, expenseEmployeeParamSchema } from './expenseSchemas';

describe('Auth Schemas', () => {
    describe('loginSchema', () => {
        it('should validate valid email login', () => {
            const result = loginSchema.safeParse({
                body: { email: 'test@example.com', password: 'password123' }
            });
            expect(result.success).toBe(true);
        });

        it('should validate valid DNI login', () => {
            const result = loginSchema.safeParse({
                body: { dni: '12345678A', password: 'password123' }
            });
            expect(result.success).toBe(true);
        });

        it('should validate valid identifier login', () => {
            const result = loginSchema.safeParse({
                body: { identifier: 'johndoe', password: 'password123' }
            });
            expect(result.success).toBe(true);
        });

        it('should reject login without password', () => {
            const result = loginSchema.safeParse({
                body: { email: 'test@example.com' }
            });
            expect(result.success).toBe(false);
        });

        it('should reject login without any identifier', () => {
            const result = loginSchema.safeParse({
                body: { password: 'password123' }
            });
            expect(result.success).toBe(false);
        });

        it('should reject invalid email format', () => {
            const result = loginSchema.safeParse({
                body: { email: 'not-an-email', password: 'password123' }
            });
            expect(result.success).toBe(false);
        });
    });

    describe('passwordResetRequestSchema', () => {
        it('should validate valid identifier', () => {
            const result = passwordResetRequestSchema.safeParse({
                body: { identifier: 'test@example.com' }
            });
            expect(result.success).toBe(true);
        });

        it('should reject empty identifier', () => {
            const result = passwordResetRequestSchema.safeParse({
                body: { identifier: '' }
            });
            expect(result.success).toBe(false);
        });
    });

    describe('passwordResetSchema', () => {
        it('should validate valid reset request', () => {
            const result = passwordResetSchema.safeParse({
                body: { token: 'abc123token', newPassword: 'newpassword123' }
            });
            expect(result.success).toBe(true);
        });

        it('should reject short password', () => {
            const result = passwordResetSchema.safeParse({
                body: { token: 'abc123token', newPassword: 'short' }
            });
            expect(result.success).toBe(false);
        });
    });

    describe('generateAccessSchema', () => {
        it('should validate valid employeeId', () => {
            const result = generateAccessSchema.safeParse({
                body: { employeeId: '550e8400-e29b-41d4-a716-446655440000' }
            });
            expect(result.success).toBe(true);
        });

        it('should reject empty employeeId', () => {
            const result = generateAccessSchema.safeParse({
                body: { employeeId: '' }
            });
            expect(result.success).toBe(false);
        });
    });
});

describe('Common Schemas', () => {
    describe('uuidParamSchema', () => {
        it('should validate valid UUID', () => {
            const result = uuidParamSchema.safeParse({
                params: { id: '550e8400-e29b-41d4-a716-446655440000' }
            });
            expect(result.success).toBe(true);
        });

        it('should reject invalid UUID', () => {
            const result = uuidParamSchema.safeParse({
                params: { id: 'not-a-uuid' }
            });
            expect(result.success).toBe(false);
        });
    });

    describe('idParamSchema', () => {
        it('should validate non-empty id', () => {
            const result = idParamSchema.safeParse({
                params: { id: '123' }
            });
            expect(result.success).toBe(true);
        });

        it('should reject empty id', () => {
            const result = idParamSchema.safeParse({
                params: { id: '' }
            });
            expect(result.success).toBe(false);
        });
    });
});

describe('Employee Schemas', () => {
    describe('createEmployeeSchema', () => {
        it('should validate valid employee data', () => {
            const result = createEmployeeSchema.safeParse({
                body: { dni: '12345678A', firstName: 'John', lastName: 'Doe' }
            });
            expect(result.success).toBe(true);
        });

        it('should reject missing DNI', () => {
            const result = createEmployeeSchema.safeParse({
                body: { firstName: 'John', lastName: 'Doe' }
            });
            expect(result.success).toBe(false);
        });

        it('should reject invalid email format', () => {
            const result = createEmployeeSchema.safeParse({
                body: { dni: '12345678A', firstName: 'John', lastName: 'Doe', email: 'invalid' }
            });
            expect(result.success).toBe(false);
        });

        it('should validate emergency contacts', () => {
            const result = createEmployeeSchema.safeParse({
                body: {
                    dni: '12345678A',
                    firstName: 'John',
                    lastName: 'Doe',
                    emergencyContacts: [{ name: 'Jane', phone: '600123456' }]
                }
            });
            expect(result.success).toBe(true);
        });
    });

    describe('updateEmployeeSchema', () => {
        it('should validate partial update with name', () => {
            const result = updateEmployeeSchema.safeParse({
                body: { name: 'Updated Name' }
            });
            expect(result.success).toBe(true);
        });

        it('should validate private notes updates', () => {
            const result = updateEmployeeSchema.safeParse({
                body: { privateNotes: 'Observacion interna RRHH' }
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.body.privateNotes).toBe('Observacion interna RRHH');
            }
        });

        it('should validate empty update', () => {
            const result = updateEmployeeSchema.safeParse({ body: {} });
            expect(result.success).toBe(true);
        });

        it('should reject invalid email', () => {
            const result = updateEmployeeSchema.safeParse({
                body: { email: 'not-valid' }
            });
            expect(result.success).toBe(false);
        });
    });
});

describe('Vacation Schemas', () => {
    it('accepts vacation payloads without reason', () => {
        const result = vacationCreateSchema.safeParse({
            body: {
                employeeId: 'emp-1',
                startDate: '2026-05-01T00:00:00.000Z',
                endDate: '2026-05-02T00:00:00.000Z',
                type: 'VACATION',
                reason: null
            }
        });

        expect(result.success).toBe(true);
    });
});

describe('Expense Schemas', () => {
    it('accepts multipart form payloads and normalizes category aliases', () => {
        const result = expenseCreateSchema.safeParse({
            body: {
                employeeId: 'emp-1',
                category: 'DIETAS',
                description: '',
                amount: '12.50',
                date: '2026-04-28',
                paymentMethod: 'COMPANY_CARD'
            }
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.body.category).toBe('MEALS');
            expect(result.data.body.amount).toBe(12.5);
            expect(result.data.body.paymentMethod).toBe('COMPANY_CARD');
        }
    });

    it('accepts legacy expense category aliases', () => {
        const cases = [
            ['MEAL', 'MEALS'],
            ['TRAVEL', 'TRANSPORT'],
            ['TRANSPORTE', 'TRANSPORT'],
            ['ALOJAMIENTO', 'ACCOMMODATION'],
            ['MATERIAL', 'SUPPLIES'],
            ['OTROS', 'OTHER']
        ];

        for (const [input, expected] of cases) {
            const result = expenseCreateSchema.safeParse({
                body: {
                    employeeId: 'emp-1',
                    category: input,
                    amount: '1.00',
                    date: '2026-04-28'
                }
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.body.category).toBe(expected);
            }
        }
    });

    it('rejects invalid expense amount and category', () => {
        const result = expenseCreateSchema.safeParse({
            body: {
                employeeId: 'emp-1',
                category: 'INVALID',
                amount: '-1',
                date: '2026-04-28'
            }
        });

        expect(result.success).toBe(false);
    });

    it('validates employee expense route params', () => {
        const result = expenseEmployeeParamSchema.safeParse({
            params: { employeeId: 'emp-1' }
        });

        expect(result.success).toBe(true);
    });
});
