import { describe, it, expect } from 'vitest';
import { ValidationService } from './ValidationService';
import { PayrollRow } from '@prisma/client';

describe('ValidationService', () => {
    describe('validateRows', () => {
        it('should return OK status for valid payroll row', () => {
            const row: PayrollRow = {
                id: '1',
                batchId: 'batch1',
                employeeId: 'emp1',
                bruto: 3000,
                ssEmpresa: 300,
                ssTrabajador: 200,
                irpf: 400,
                neto: 2400,
                rawEmployeeName: null,
                extraData: null,
                status: 'PENDING',
                validationNotes: null,
                employee: null,
                batch: null,
                items: []
            };

            const result = ValidationService.validateRows([row]);

            expect(result[0].status).toBe('OK');
            expect(result[0].messages).toHaveLength(0);
        });

        it('should return WARNING when employeeId is missing but accounting balances', () => {
            const row: PayrollRow = {
                id: '1',
                batchId: 'batch1',
                employeeId: null as any,
                bruto: 3000,
                ssEmpresa: 300,
                ssTrabajador: 200,
                irpf: 400,
                neto: 2400,
                rawEmployeeName: 'John Doe',
                extraData: null,
                status: 'PENDING',
                validationNotes: null,
                employee: null,
                batch: null,
                items: []
            };

            const result = ValidationService.validateRows([row]);

            expect(result[0].status).toBe('WARNING');
            expect(result[0].messages[0]).toContain('Empleado no identificado');
        });

        it('should return ERROR when accounting does not balance', () => {
            const row: PayrollRow = {
                id: '1',
                batchId: 'batch1',
                employeeId: 'emp1',
                bruto: 3000,
                ssEmpresa: 300,
                ssTrabajador: 200,
                irpf: 400,
                neto: 2000,
                rawEmployeeName: null,
                extraData: null,
                status: 'PENDING',
                validationNotes: null,
                employee: null,
                batch: null,
                items: []
            };

            const result = ValidationService.validateRows([row]);

            expect(result[0].status).toBe('ERROR');
            expect(result[0].messages[0]).toContain('Descuadre contable');
        });

        it('should validate multiple rows', () => {
            const rows: PayrollRow[] = [
                {
                    id: '1',
                    batchId: 'batch1',
                    employeeId: 'emp1',
                    bruto: 3000,
                    ssEmpresa: 300,
                    ssTrabajador: 200,
                    irpf: 400,
                    neto: 2400,
                    rawEmployeeName: null,
                    extraData: null,
                    status: 'PENDING',
                    validationNotes: null,
                    employee: null,
                    batch: null,
                    items: []
                },
                {
                    id: '2',
                    batchId: 'batch1',
                    employeeId: null as any,
                    bruto: 4000,
                    ssEmpresa: 400,
                    ssTrabajador: 250,
                    irpf: 500,
                    neto: 3250,
                    rawEmployeeName: 'Jane Doe',
                    extraData: null,
                    status: 'PENDING',
                    validationNotes: null,
                    employee: null,
                    batch: null,
                    items: []
                }
            ];

            const results = ValidationService.validateRows(rows);

            expect(results).toHaveLength(2);
            expect(results[0].status).toBe('OK');
            expect(results[1].status).toBe('WARNING');
        });
    });
});
