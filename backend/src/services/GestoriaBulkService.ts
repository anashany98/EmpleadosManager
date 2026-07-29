/**
 * GestoriaBulkService — operaciones masivas sobre filas / celdas.
 *
 * Usado por la pantalla de "Control general" para:
 *   - setCell { employeeId, code, value }: aplica un valor a la
 *     celda de un empleado concreto
 *   - clearCell { employeeId, code }: borra el valor de una celda
 *   - setReviewed { employeeIds, isReviewed }: marca/desmarca
 *     varias filas como revisadas
 *   - deleteRows { rowIds }: elimina varias filas
 *
 * Validaciones:
 *   - El periodo debe estar abierto (todas las operaciones que
 *     modifican datos).
 *   - `setCell` y `clearCell` se enrutan a `GestoriaRowService` para
 *     reutilizar la coerción de tipos.
 */
import { prisma } from '../lib/prisma';
import { AuditService, AuditAction, AuditEntity } from './AuditService';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../types/express';
import { GestoriaRowService } from './GestoriaRowService';

export type BulkOp =
    | { operation: 'setCell'; employeeId: string; code: string; value: unknown }
    | { operation: 'clearCell'; employeeId: string; code: string }
    | { operation: 'setReviewed'; employeeIds: string[]; isReviewed: boolean }
    | { operation: 'deleteRows'; rowIds: string[] };

export interface BulkInput {
    periodId: string;
    op: BulkOp;
    user: AuthUser;
}

export interface BulkResult {
    affected: number;
    details?: Record<string, unknown>;
}

export const GestoriaBulkService = {
    async apply(input: BulkInput): Promise<BulkResult> {
        const op = input.op;

        if (op.operation === 'setCell' || op.operation === 'clearCell') {
            // 1) Asegurar que la fila existe (idempotente).
            const row = await GestoriaRowService.create({
                periodId: input.periodId,
                employeeId: op.employeeId,
                user: input.user
            });
            // 2) Aplicar el cambio de celda usando putCells con un
            //    único elemento. Reutiliza la coerción.
            const value = op.operation === 'setCell' ? op.value : '';
            await GestoriaRowService.putCells({
                periodId: input.periodId,
                rowId: row.id,
                cells: [{ code: op.code, value }],
                user: input.user
            });
            await AuditService.log(
                AuditAction.DATA_UPDATE,
                AuditEntity.GESTORIA,
                row.id,
                { action: 'bulk_setCell', code: op.code },
                input.user.id,
                op.employeeId
            );
            return { affected: 1 };
        }

        if (op.operation === 'setReviewed') {
            // No requiere periodo abierto (es un flag meta).
            const period = await prisma.gestoriaPeriod.findUnique({
                where: { id: input.periodId }
            });
            if (!period) throw new AppError('Periodo no encontrado', 404);
            if (input.user.role !== 'admin' && period.companyId !== input.user.companyId) {
                throw new AppError('No tienes acceso a este periodo', 403);
            }

            const result = await prisma.gestoriaEmployeeRow.updateMany({
                where: { periodId: input.periodId, id: { in: op.employeeIds } },
                data: {
                    isReviewed: op.isReviewed,
                    reviewedAt: op.isReviewed ? new Date() : null,
                    reviewedById: op.isReviewed ? input.user.id : null
                }
            });

            await AuditService.log(
                AuditAction.DATA_UPDATE,
                AuditEntity.GESTORIA,
                input.periodId,
                {
                    action: 'bulk_setReviewed',
                    isReviewed: op.isReviewed,
                    count: op.employeeIds.length
                },
                input.user.id
            );

            return { affected: result.count };
        }

        if (op.operation === 'deleteRows') {
            for (const rowId of op.rowIds) {
                await GestoriaRowService.delete(input.periodId, rowId, input.user);
            }
            return { affected: op.rowIds.length };
        }

        throw new AppError('Operación desconocida', 400);
    }
};
