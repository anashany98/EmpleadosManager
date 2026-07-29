/**
 * GestoriaViewService — vistas personalizadas de columnas.
 *
 * Una vista es un (usuario, periodo) → `{ viewName, columnOrder,
 * hiddenConcepts, isDefault }`. Permite al usuario guardar
 * configuraciones de columnas en el grid del "Control general"
 * (ocultar conceptos, reordenar columnas).
 *
 * El controller expone:
 *   - list: vistas del usuario actual para un periodo
 *   - upsert: crear / actualizar por (userId, periodId, viewName)
 *   - getDefault: vista por defecto (la marcada isDefault, o la
 *     primera por createdAt)
 */
import { prisma } from '../lib/prisma';
import { AuditService, AuditAction, AuditEntity } from './AuditService';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../types/express';

export interface UpsertViewInput {
    periodId: string;
    viewName: string;
    columnOrder: string[];
    hiddenConcepts: string[];
    isDefault?: boolean;
    user: AuthUser;
}

async function assertPeriodAccess(periodId: string, user: AuthUser) {
    const period = await prisma.gestoriaPeriod.findUnique({
        where: { id: periodId }
    });
    if (!period) throw new AppError('Periodo no encontrado', 404);
    if (user.role !== 'admin' && period.companyId !== user.companyId) {
        throw new AppError('No tienes acceso a este periodo', 403);
    }
    return period;
}

export const GestoriaViewService = {
    async list(periodId: string, user: AuthUser) {
        await assertPeriodAccess(periodId, user);
        return prisma.gestoriaColumnView.findMany({
            where: { userId: user.id, periodId },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
        });
    },

    async getDefault(periodId: string, user: AuthUser) {
        await assertPeriodAccess(periodId, user);
        const def = await prisma.gestoriaColumnView.findFirst({
            where: { userId: user.id, periodId, isDefault: true }
        });
        if (def) return def;
        return prisma.gestoriaColumnView.findFirst({
            where: { userId: user.id, periodId },
            orderBy: { createdAt: 'asc' }
        });
    },

    async upsert(input: UpsertViewInput) {
        await assertPeriodAccess(input.periodId, input.user);

        // Si isDefault=true, desmarcar las demás
        if (input.isDefault) {
            await prisma.gestoriaColumnView.updateMany({
                where: { userId: input.user.id, periodId: input.periodId, NOT: { viewName: input.viewName } },
                data: { isDefault: false }
            });
        }

        // Normalizar codes a UPPER
        const order = input.columnOrder.map((c) => c.toUpperCase());
        const hidden = input.hiddenConcepts.map((c) => c.toUpperCase());

        const view = await prisma.gestoriaColumnView.upsert({
            where: {
                userId_periodId_viewName: {
                    userId: input.user.id,
                    periodId: input.periodId,
                    viewName: input.viewName
                }
            },
            update: {
                columnOrder: order,
                hiddenConcepts: hidden,
                isDefault: input.isDefault ?? false
            },
            create: {
                userId: input.user.id,
                periodId: input.periodId,
                viewName: input.viewName,
                columnOrder: order,
                hiddenConcepts: hidden,
                isDefault: input.isDefault ?? false
            }
        });

        await AuditService.log(
            AuditAction.DATA_CREATE,
            AuditEntity.GESTORIA,
            view.id,
            { action: 'upsert_view', periodId: input.periodId, viewName: input.viewName },
            input.user.id
        );

        return view;
    },

    async delete(periodId: string, viewName: string, user: AuthUser) {
        await assertPeriodAccess(periodId, user);
        const view = await prisma.gestoriaColumnView.findUnique({
            where: {
                userId_periodId_viewName: {
                    userId: user.id,
                    periodId,
                    viewName
                }
            }
        });
        if (!view) throw new AppError('Vista no encontrada', 404);
        await prisma.gestoriaColumnView.delete({ where: { id: view.id } });
        await AuditService.log(
            AuditAction.DATA_DELETE,
            AuditEntity.GESTORIA,
            view.id,
            { action: 'delete_view', periodId, viewName },
            user.id
        );
    }
};
