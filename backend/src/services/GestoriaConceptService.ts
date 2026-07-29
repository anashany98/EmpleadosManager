/**
 * GestoriaConceptService — gestión de conceptos dinámicos.
 *
 * Responsabilidades:
 *   - Listar / crear / editar / eliminar conceptos de un periodo
 *   - Validar unicidad de `code` dentro del periodo (case-insensitive)
 *   - Respetar el flag `isSystem` (los conceptos predefinidos del
 *     Excel original no se pueden eliminar, solo ocultar/renombrar)
 *
 * Decisiones:
 *   - El borrado es HARD (cascade) porque el modelo `GestoriaCell`
 *     también se borra en cascada. Si la fila tiene celdas con
 *     datos, se permite borrar solo si `force=true`.
 *   - El código se normaliza a UPPER. La validación es case-
 *     insensitive en el INSERT (el `@@unique([periodId, code])`
 *     del Prisma es case-sensitive por defecto en PostgreSQL;
 *     añadimos un `mode: 'insensitive'` para que coincida con UX).
 */
import { prisma, Prisma } from '../lib/prisma';
import { AuditService, AuditAction, AuditEntity } from './AuditService';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../types/express';

export interface CreateConceptInput {
    periodId: string;
    code: string;
    label: string;
    type: 'HOURS' | 'PRICE' | 'AMOUNT' | 'PERCENT' | 'BOOLEAN' | 'TEXT';
    decimals?: number;
    order?: number;
    isSystem?: boolean;
    /**
     * Codigo de plantilla .xls de gestoria al que mapear el concepto
     * (p. ej. "044", "048", …). Si se omite, el operador debera
     * configurar el mapping a mano en la pantalla de export.
     */
    gestoriaCode?: string | null;
    user: AuthUser;
}

export interface UpdateConceptInput {
    periodId: string;
    conceptId: string;
    label?: string;
    isVisible?: boolean;
    order?: number;
    decimals?: number;
    /**
     * Ver CreateConceptInput.gestoriaCode. Pasar `null` explicitamente
     * para limpiar el mapeo.
     */
    gestoriaCode?: string | null;
    user: AuthUser;
}

export interface DeleteConceptInput {
    periodId: string;
    conceptId: string;
    force?: boolean;
    user: AuthUser;
}

/**
 * Devuelve el periodo o lanza 404. NO valida acceso multi-tenant;
 * se hace en cada operación pública.
 */
async function getPeriodOrThrow(periodId: string) {
    const period = await prisma.gestoriaPeriod.findUnique({
        where: { id: periodId }
    });
    if (!period) throw new AppError('Periodo no encontrado', 404);
    return period;
}

async function assertPeriodAccess(periodId: string, user: AuthUser) {
    const period = await getPeriodOrThrow(periodId);
    if (user.role !== 'admin' && period.companyId !== user.companyId) {
        throw new AppError('No tienes acceso a este periodo', 403);
    }
    return period;
}

export const GestoriaConceptService = {
    /**
     * Lista los conceptos de un periodo. Por defecto, devuelve solo
     * los visibles; `includeHidden=true` los devuelve todos.
     */
    async list(periodId: string, user: AuthUser, includeHidden = true) {
        await assertPeriodAccess(periodId, user);
        return prisma.gestoriaConcept.findMany({
            where: { periodId, ...(includeHidden ? {} : { isVisible: true }) },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
        });
    },

    /**
     * Crea un concepto. `code` se normaliza a UPPER.
     */
    async create(input: CreateConceptInput) {
        await assertPeriodAccess(input.periodId, input.user);

        const code = input.code.trim().toUpperCase();

        // Unicidad case-insensitive
        const existing = await prisma.gestoriaConcept.findFirst({
            where: {
                periodId: input.periodId,
                code: { equals: code, mode: 'insensitive' }
            }
        });
        if (existing) {
            throw new AppError(`Ya existe un concepto con código "${code}"`, 409);
        }

        // Si no se pasa `order`, lo colocamos al final.
        let order = input.order;
        if (order === undefined) {
            const max = await prisma.gestoriaConcept.aggregate({
                where: { periodId: input.periodId },
                _max: { order: true }
            });
            order = (max._max.order ?? -1) + 1;
        }

        const created = await prisma.gestoriaConcept.create({
            data: {
                periodId: input.periodId,
                code,
                label: input.label.trim(),
                type: input.type,
                decimals: input.decimals ?? 2,
                order,
                isSystem: input.isSystem ?? false,
                gestoriaCode: input.gestoriaCode ?? null
            }
        });

        await AuditService.log(
            AuditAction.DATA_CREATE,
            AuditEntity.GESTORIA,
            created.id,
            {
                action: 'create_concept',
                periodId: input.periodId,
                code,
                type: input.type
            },
            input.user.id
        );

        return created;
    },

    /**
     * Edita label / isVisible / order / decimals. NO permite cambiar
     * el `code` ni el `type` (eso rompería celdas existentes).
     */
    async update(input: UpdateConceptInput) {
        await assertPeriodAccess(input.periodId, input.user);
        const concept = await prisma.gestoriaConcept.findUnique({
            where: { id: input.conceptId }
        });
        if (!concept || concept.periodId !== input.periodId) {
            throw new AppError('Concepto no encontrado en este periodo', 404);
        }

        const data: Prisma.GestoriaConceptUpdateInput = {};
        if (input.label !== undefined) data.label = input.label.trim();
        if (input.isVisible !== undefined) data.isVisible = input.isVisible;
        if (input.order !== undefined) data.order = input.order;
        if (input.decimals !== undefined) data.decimals = input.decimals;
        // gestoriaCode: distinguir "no enviado" (undefined → no tocar) de
        // "limpiar" (null → escribir null). Zod ya normaliza undefined.
        if (input.gestoriaCode !== undefined) {
            data.gestoriaCode = input.gestoriaCode ?? null;
        }

        const updated = await prisma.gestoriaConcept.update({
            where: { id: input.conceptId },
            data
        });

        await AuditService.log(
            AuditAction.DATA_UPDATE,
            AuditEntity.GESTORIA,
            input.conceptId,
            { action: 'update_concept', periodId: input.periodId, fields: Object.keys(data) },
            input.user.id
        );

        return updated;
    },

    /**
     * Elimina un concepto. Si tiene celdas, exige `force=true` y
     * también bloquea si el periodo está cerrado. Los conceptos del
     * sistema (`isSystem=true`) no se pueden borrar.
     */
    async delete(input: DeleteConceptInput) {
        const period = await assertPeriodAccess(input.periodId, input.user);
        if (period.status === 'CLOSED') {
            throw new AppError('El periodo está cerrado. Reábrelo para modificarlo.', 423);
        }
        const concept = await prisma.gestoriaConcept.findUnique({
            where: { id: input.conceptId },
            include: { _count: { select: { cells: true } } }
        });
        if (!concept || concept.periodId !== input.periodId) {
            throw new AppError('Concepto no encontrado en este periodo', 404);
        }
        if (concept.isSystem) {
            throw new AppError('Los conceptos del sistema no se pueden eliminar', 409);
        }
        if (concept._count.cells > 0 && !input.force) {
            throw new AppError(
                `El concepto tiene ${concept._count.cells} celdas. Use force=true para eliminarlas todas.`,
                409
            );
        }

        await prisma.gestoriaConcept.delete({ where: { id: input.conceptId } });

        await AuditService.log(
            AuditAction.DATA_DELETE,
            AuditEntity.GESTORIA,
            input.conceptId,
            {
                action: 'delete_concept',
                periodId: input.periodId,
                code: concept.code,
                cascadedCells: concept._count.cells
            },
            input.user.id
        );
    }
};
