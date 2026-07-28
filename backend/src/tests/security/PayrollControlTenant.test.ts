import { describe, expect, it } from 'vitest';
import { exportGestoriaSchema, historyQuerySchema, restoreCellSchema, updatePeriodStatusSchema, updateRecordCellSchema } from '../../schemas/payrollControlSchemas';
import { isGlobalAdmin } from '../../utils/actorContext';

describe('Payroll control - contrato de seguridad', () => {
    it('requiere versión para que una edición no pueda sobrescribir cambios concurrentes', () => {
        expect(updateRecordCellSchema.safeParse({ expectedVersion: 3, overtimeHours: 10 }).success).toBe(true);
        expect(updateRecordCellSchema.safeParse({ overtimeHours: 10 }).success).toBe(false);
    });

    it('rechaza identidad, empresa y período en un payload de celda', () => {
        const result = updateRecordCellSchema.safeParse({ expectedVersion: 1, overtimeHours: 10, employeeId: 'x', companyId: 'x', periodId: 'x', name: 'Alterado' });
        expect(result.success).toBe(false);
    });

    it('solo permite restaurar resultados calculados', () => {
        expect(restoreCellSchema.safeParse({ expectedVersion: 1, fieldName: 'gross' }).success).toBe(true);
        expect(restoreCellSchema.safeParse({ expectedVersion: 1, fieldName: 'overtimeHours' }).success).toBe(false);
    });

    it('exige motivo para la reapertura y no expone EXPORTED como transición de API', () => {
        expect(updatePeriodStatusSchema.safeParse({ periodId: '123e4567-e89b-12d3-a456-426614174000', status: 'REOPENED', reopenReason: 'Corrección aprobada' }).success).toBe(true);
        expect(updatePeriodStatusSchema.safeParse({ periodId: '123e4567-e89b-12d3-a456-426614174000', status: 'REOPENED' }).success).toBe(false);
        expect(updatePeriodStatusSchema.safeParse({ periodId: '123e4567-e89b-12d3-a456-426614174000', status: 'EXPORTED' }).success).toBe(false);
    });

    it('distingue un administrador global de un administrador de empresa', () => {
        expect(isGlobalAdmin({ id: 'global', role: 'admin', companyId: null })).toBe(true);
        expect(isGlobalAdmin({ id: 'company-admin', role: 'admin', companyId: 'company-a' })).toBe(false);
    });

    it('mantiene el identificador de exportación estricto', () => {
        expect(exportGestoriaSchema.safeParse({ periodId: '123e4567-e89b-12d3-a456-426614174000' }).success).toBe(true);
        expect(exportGestoriaSchema.safeParse({ periodId: 'not-a-uuid' }).success).toBe(false);
    });

    it('valida el alcance de empresa y limita el tamaño del historial mensual', () => {
        expect(historyQuerySchema.safeParse({
            companyId: '123e4567-e89b-12d3-a456-426614174000',
            limit: 24
        }).success).toBe(true);
        expect(historyQuerySchema.safeParse({ companyId: 'otra-empresa', limit: 24 }).success).toBe(false);
        expect(historyQuerySchema.safeParse({ limit: 120 }).success).toBe(false);
    });
});
