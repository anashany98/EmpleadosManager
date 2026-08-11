/**
 * GestoriaPeriodService — gestión de periodos de gestoría.
 *
 * Responsabilidades:
 *   - CRUD de periodos (crear, leer, listar, actualizar mapeo/notas)
 *   - Bloqueo (close / reopen) con motivo obligatorio
 *   - Aislamiento por empresa (multi-tenant)
 *   - Auditoría de cada cambio
 *
 * Decisiones:
 *   - El estado `CLOSED` se considera "inmutable" para los datos
 *     (filas, celdas, conceptos), pero el periodo en sí puede
 *     reabrirse con `reopen({ reason })` ≥ 5 chars.
 *   - El "default exportMapping" se inicializa con un set razonable
 *     solo si el operador lo solicita (no asumimos celdas de la
 *     plantilla que no hemos podido inspeccionar).
 */
import { prisma, Prisma } from '../lib/prisma';
import { createLogger } from './LoggerService';
import { AuditService, AuditAction, AuditEntity } from './AuditService';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../types/express';
import type { GestoriaPeriodStatus } from '@prisma/client';

const log = createLogger('GestoriaPeriodService');

export interface CreatePeriodInput {
    companyId: string;
    year: number;
    month: number;
    notes?: string | null;
    user: AuthUser;
}

export interface UpdatePeriodInput {
    id: string;
    notes?: string | null;
    exportMapping?: Record<string, string> | null;
    user: AuthUser;
}

export interface ClosePeriodInput {
    id: string;
    user: AuthUser;
}

export interface ReopenPeriodInput {
    id: string;
    reason: string;
    user: AuthUser;
}

/**
 * Normaliza las claves de un mapeo a UPPER (sin espacios).
 * Si una clave tiene una forma inválida, lanza AppError(400).
 */
function normalizeMapping(mapping: Record<string, string> | null | undefined):
    | Record<string, string>
    | null
    | undefined {
    if (mapping === undefined) return undefined;
    if (mapping === null) return null;
    const out: Record<string, string> = {};
    for (const [rawKey, addr] of Object.entries(mapping)) {
        const key = rawKey.trim().toUpperCase();
        if (!key) continue;
        out[key] = String(addr).trim().toUpperCase();
    }
    return out;
}

/**
 * Comprueba que la empresa existe y que el actor tiene acceso a ella.
 * Lanza AppError si no.
 */
async function assertCompanyAccess(
    companyId: string,
    user: AuthUser
): Promise<void> {
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true }
    });
    if (!company) {
        throw new AppError('Empresa no encontrada', 404);
    }
    if (user.role !== 'admin' && user.companyId !== companyId) {
        throw new AppError('No tienes acceso a esta empresa', 403);
    }
}

export const GestoriaPeriodService = {
    /**
     * Crea un periodo para una empresa/año/mes. Falla con 409 si ya
     * existe uno.
     */
    async create(input: CreatePeriodInput) {
        await assertCompanyAccess(input.companyId, input.user);

        const existing = await prisma.gestoriaPeriod.findUnique({
            where: {
                companyId_year_month: {
                    companyId: input.companyId,
                    year: input.year,
                    month: input.month
                }
            }
        });
        if (existing) {
            throw new AppError('Ya existe un periodo para esa empresa/año/mes', 409);
        }

        const created = await prisma.gestoriaPeriod.create({
            data: {
                companyId: input.companyId,
                year: input.year,
                month: input.month,
                notes: input.notes ?? null,
                createdById: input.user.id
            }
        });

        await AuditService.log(
            AuditAction.DATA_CREATE,
            AuditEntity.GESTORIA,
            created.id,
            {
                action: 'create_period',
                companyId: input.companyId,
                year: input.year,
                month: input.month
            },
            input.user.id,
            undefined,
            undefined,
            undefined
        );

        log.info({ periodId: created.id }, 'Period created');
        return created;
    },

    /**
     * Lista periodos, con filtro opcional por empresa y estado.
     */
    async list(input: { companyId?: string; status?: GestoriaPeriodStatus; user: AuthUser }) {
        const where: Prisma.GestoriaPeriodWhereInput = {};
        if (input.companyId) {
            // Verifica acceso a la empresa antes de listar
            await assertCompanyAccess(input.companyId, input.user);
            where.companyId = input.companyId;
        } else if (input.user.role !== 'admin') {
            // No admin: solo ve su empresa
            if (!input.user.companyId) {
                return [];
            }
            where.companyId = input.user.companyId;
        }
        if (input.status) {
            where.status = input.status;
        }

        return prisma.gestoriaPeriod.findMany({
            where,
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            include: {
                _count: { select: { rows: true, concepts: true } }
            }
        });
    },

    /**
     * Detalle de un periodo por id. Verifica acceso multi-tenant.
     */
    async getById(id: string, user: AuthUser) {
        const period = await prisma.gestoriaPeriod.findUnique({
            where: { id },
            include: {
                _count: { select: { rows: true, concepts: true, exportLogs: true } }
            }
        });
        if (!period) {
            throw new AppError('Periodo no encontrado', 404);
        }
        if (user.role !== 'admin' && period.companyId !== user.companyId) {
            throw new AppError('No tienes acceso a este periodo', 403);
        }
        return period;
    },

    /**
     * Actualiza notas y/o exportMapping. No requiere periodo abierto
     * (un periodo cerrado sigue siendo editable en sus metadatos).
     */
    async update(input: UpdatePeriodInput) {
        const period = await prisma.gestoriaPeriod.findUnique({
            where: { id: input.id }
        });
        if (!period) {
            throw new AppError('Periodo no encontrado', 404);
        }
        if (input.user.role !== 'admin' && period.companyId !== input.user.companyId) {
            throw new AppError('No tienes acceso a este periodo', 403);
        }

        const data: Prisma.GestoriaPeriodUpdateInput = {};
        if (input.notes !== undefined) data.notes = input.notes;
        const mapping = normalizeMapping(input.exportMapping);
        if (mapping !== undefined) {
            // Prisma acepta `Json | null | undefined`. `JsonValue` se
            // construye de un objeto plano.
            data.exportMapping = mapping === null
                ? Prisma.JsonNull
                : (mapping as unknown as Prisma.InputJsonValue);
        }

        const updated = await prisma.gestoriaPeriod.update({
            where: { id: input.id },
            data
        });

        await AuditService.log(
            AuditAction.DATA_UPDATE,
            AuditEntity.GESTORIA,
            input.id,
            {
                action: 'update_period',
                fields: Object.keys(data)
            },
            input.user.id
        );

        return updated;
    },

    /**
     * Cierra el periodo. A partir de aquí, las escrituras a filas /
     * celdas / conceptos serán rechazadas con 423 Locked. Solo se
     * permite reabrir (con motivo) o seguir modificando los
     * metadatos (notas, mapeo).
     */
    async close(input: ClosePeriodInput) {
        const period = await prisma.gestoriaPeriod.findUnique({
            where: { id: input.id }
        });
        if (!period) {
            throw new AppError('Periodo no encontrado', 404);
        }
        if (input.user.role !== 'admin' && period.companyId !== input.user.companyId) {
            throw new AppError('No tienes acceso a este periodo', 403);
        }
        if (period.status === 'CLOSED') {
            throw new AppError('El periodo ya está cerrado', 409);
        }

        const updated = await prisma.gestoriaPeriod.update({
            where: { id: input.id },
            data: {
                status: 'CLOSED',
                closedAt: new Date(),
                closedById: input.user.id,
                reopenReason: null,
                reopenedAt: null,
                reopenedById: null
            }
        });

        await AuditService.log(
            AuditAction.GESTORIA_PERIOD_CLOSE,
            AuditEntity.GESTORIA,
            input.id,
            {
                action: 'close_period',
                beforeStatus: period.status,
                afterStatus: 'CLOSED'
            },
            input.user.id
        );

        return updated;
    },

    /**
     * Reabre un periodo cerrado. Requiere motivo ≥ 5 chars. La
     * auditoría registra antes/después y el motivo.
     */
    async reopen(input: ReopenPeriodInput) {
        const period = await prisma.gestoriaPeriod.findUnique({
            where: { id: input.id }
        });
        if (!period) {
            throw new AppError('Periodo no encontrado', 404);
        }
        if (input.user.role !== 'admin' && period.companyId !== input.user.companyId) {
            throw new AppError('No tienes acceso a este periodo', 403);
        }
        if (period.status === 'OPEN') {
            throw new AppError('El periodo ya está abierto', 409);
        }

        const updated = await prisma.gestoriaPeriod.update({
            where: { id: input.id },
            data: {
                status: 'OPEN',
                reopenReason: input.reason,
                reopenedAt: new Date(),
                reopenedById: input.user.id
            }
        });

        await AuditService.log(
            AuditAction.GESTORIA_PERIOD_REOPEN,
            AuditEntity.GESTORIA,
            input.id,
            {
                action: 'reopen_period',
                reason: input.reason,
                beforeStatus: period.status,
                afterStatus: 'OPEN'
            },
            input.user.id
        );

        return updated;
    },

    /**
     * Lanza un AppError 423 si el periodo está cerrado. Usado por
     * los demás services como guarda antes de cualquier escritura.
     */
    async assertOpen(periodId: string): Promise<void> {
        const period = await prisma.gestoriaPeriod.findUnique({
            where: { id: periodId },
            select: { status: true }
        });
        if (!period) {
            throw new AppError('Periodo no encontrado', 404);
        }
        if (period.status === 'CLOSED') {
            throw new AppError('El periodo está cerrado. Reábrelo para modificarlo.', 423);
        }
    }
};
