/**
 * GestoriaRowService — gestión de filas de empleado y celdas.
 *
 * Responsabilidades:
 *   - Crear filas para empleados (snapshot inmutable de
 *     employeeName/department/category)
 *   - Sustituir todas las celdas de una fila atómicamente (PUT)
 *   - Listar filas con sus celdas
 *   - Marcar filas como revisadas / no revisadas
 *   - Recalcular totales (totalHours, totalAmount) tras cada
 *     cambio en celdas
 *
 * Decisiones:
 *   - El snapshot se toma de la tabla `Employee` en el momento de
 *     crear la fila. Si el empleado cambia de departamento después,
 *     la fila del periodo muestra el snapshot. Si el empleado se
 *     borra (soft-delete), la fila persiste con employeeId=null.
 *   - El borrado de filas requiere periodo abierto.
 *   - Las celdas se validan contra el `type` del concepto
 *     (HOURS/PRICE/AMOUNT/PERCENT → numeric; BOOLEAN → boolean;
 *     TEXT → string). La conversión se hace aquí, no en el
 *     controller.
 */
import { prisma, Prisma } from '../lib/prisma';
import { createLogger } from './LoggerService';
import { AuditService, AuditAction, AuditEntity } from './AuditService';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../types/express';

const log = createLogger('GestoriaRowService');

export interface CreateRowInput {
    periodId: string;
    employeeId: string;
    user: AuthUser;
}

export interface UpdateRowInput {
    periodId: string;
    rowId: string;
    observations?: string | null;
    isReviewed?: boolean;
    user: AuthUser;
}

export interface PutCellsInput {
    periodId: string;
    rowId: string;
    /**
     * Array de `{ code, value }`. `value` puede ser number, string
     * o boolean; el service lo convierte al tipo correcto del
     * concepto.
     */
    cells: Array<{ code: string; value: unknown }>;
    user: AuthUser;
}

export interface ListRowsOptions {
    periodId: string;
    isReviewed?: boolean;
    department?: string;
    category?: string;
    search?: string;
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

async function assertOpen(periodId: string) {
    const period = await prisma.gestoriaPeriod.findUnique({
        where: { id: periodId },
        select: { status: true }
    });
    if (!period) throw new AppError('Periodo no encontrado', 404);
    if (period.status === 'CLOSED') {
        throw new AppError('El periodo está cerrado. Reábrelo para modificarlo.', 423);
    }
}

/**
 * Recalcula los totales de una fila a partir de sus celdas. Llamado
 * después de upserts. La operación es O(n) en el número de celdas
 * (típicamente < 30 por fila). Totales:
 *   - totalHours: SUM(numericValue) WHERE concept.type='HOURS'
 *   - totalAmount: SUM(numericValue) WHERE concept.type='AMOUNT'
 */
async function recomputeRowTotals(rowId: string, tx: Prisma.TransactionClient) {
    const cells = await tx.gestoriaCell.findMany({
        where: { rowId },
        include: { concept: { select: { type: true } } }
    });

    let totalHours: number | null = null;
    let totalAmount: number | null = null;
    for (const c of cells) {
        if (c.numericValue == null) continue;
        const v = Number(c.numericValue);
        if (c.concept.type === 'HOURS') {
            totalHours = (totalHours ?? 0) + v;
        } else if (c.concept.type === 'AMOUNT') {
            totalAmount = (totalAmount ?? 0) + v;
        }
    }
    await tx.gestoriaEmployeeRow.update({
        where: { id: rowId },
        data: {
            totalHours: totalHours === null ? null : totalHours.toFixed(2),
            totalAmount: totalAmount === null ? null : totalAmount.toFixed(2)
        }
    });
}

/**
 * Convierte un `value` arbitrario al tipo del concepto.
 * Devuelve `{ numericValue, textValue }` o lanza AppError(400) si
 * el tipo no encaja.
 */
function coerceCellValue(
    type: 'HOURS' | 'PRICE' | 'AMOUNT' | 'PERCENT' | 'BOOLEAN' | 'TEXT',
    value: unknown
): { numericValue: number | null; textValue: string | null } {
    if (value === null || value === undefined || value === '') {
        return { numericValue: null, textValue: null };
    }

    if (type === 'TEXT') {
        return { numericValue: null, textValue: String(value).slice(0, 2000) };
    }
    if (type === 'BOOLEAN') {
        if (typeof value === 'boolean') {
            return { numericValue: value ? 1 : 0, textValue: null };
        }
        if (value === 'true' || value === '1' || value === 1) {
            return { numericValue: 1, textValue: null };
        }
        if (value === 'false' || value === '0' || value === 0) {
            return { numericValue: 0, textValue: null };
        }
        throw new AppError('Valor booleano inválido', 400);
    }

    // Tipos numéricos
    let n: number;
    if (typeof value === 'number') {
        n = value;
    } else if (typeof value === 'string') {
        const s = value.trim();
        if (!s) return { numericValue: null, textValue: null };
        n = Number(s.replace(',', '.'));
    } else if (typeof value === 'boolean') {
        n = value ? 1 : 0;
    } else {
        throw new AppError('Tipo de valor no soportado', 400);
    }
    if (!Number.isFinite(n)) {
        throw new AppError('Valor numérico inválido', 400);
    }
    if (type === 'PERCENT' && (n < 0 || n > 100)) {
        // Porcentaje fuera de rango. No es error fatal: el usuario
        // puede usar 250 para "250%". Lo aceptamos pero logueamos.
        log.warn({ value: n }, 'Percent value outside [0,100]');
    }
    return { numericValue: n, textValue: null };
}

export const GestoriaRowService = {
    /**
     * Crea una fila para un empleado. Si ya existe, devuelve la
     * existente (idempotente). El snapshot se toma del Employee
     * actual — incluso si luego cambia.
     */
    async create(input: CreateRowInput) {
        const period = await assertPeriodAccess(input.periodId, input.user);
        await assertOpen(input.periodId);

        const employee = await prisma.employee.findFirst({
            where: {
                id: input.employeeId,
                companyId: period.companyId,
                deletedAt: null
            },
            select: { id: true, name: true, firstName: true, lastName: true, department: true, category: true }
        });
        if (!employee) {
            throw new AppError('Empleado no encontrado o no pertenece a la empresa', 404);
        }

        // Componer el nombre: priorizar lastName, firstName si
        // existen; si no, usar `name`.
        const composedName = [employee.lastName, employee.firstName].filter(Boolean).join(', ') || employee.name;

        const existing = await prisma.gestoriaEmployeeRow.findUnique({
            where: {
                periodId_employeeId: { periodId: input.periodId, employeeId: input.employeeId }
            }
        });
        if (existing) {
            return existing;
        }

        const created = await prisma.gestoriaEmployeeRow.create({
            data: {
                periodId: input.periodId,
                employeeId: input.employeeId,
                employeeName: composedName,
                department: employee.department ?? null,
                category: employee.category ?? null
            }
        });

        await AuditService.log(
            AuditAction.DATA_CREATE,
            AuditEntity.GESTORIA,
            created.id,
            { action: 'create_row', periodId: input.periodId, employeeId: input.employeeId },
            input.user.id,
            input.employeeId
        );

        return created;
    },

    /**
     * Lista filas con sus celdas. Devuelve solo filas de la
     * empresa del periodo. Filtros opcionales.
     */
    async list(opts: ListRowsOptions) {
        await assertPeriodAccess(opts.periodId, opts.user);

        const where: Prisma.GestoriaEmployeeRowWhereInput = { periodId: opts.periodId };
        if (opts.isReviewed !== undefined) where.isReviewed = opts.isReviewed;
        if (opts.department) where.department = opts.department;
        if (opts.category) where.category = opts.category;
        if (opts.search) {
            where.employeeName = { contains: opts.search, mode: 'insensitive' };
        }

        return prisma.gestoriaEmployeeRow.findMany({
            where,
            orderBy: [{ department: 'asc' }, { category: 'asc' }, { employeeName: 'asc' }],
            include: { cells: true }
        });
    },

    /**
     * Detalle de una fila con celdas.
     */
    async getById(periodId: string, rowId: string, user: AuthUser) {
        await assertPeriodAccess(periodId, user);
        const row = await prisma.gestoriaEmployeeRow.findFirst({
            where: { id: rowId, periodId },
            include: { cells: true }
        });
        if (!row) throw new AppError('Fila no encontrada', 404);
        return row;
    },

    /**
     * Edita observaciones y/o isReviewed. NO requiere periodo
     * abierto (el flag `isReviewed` es un metadato, no un dato
     * de la liquidación).
     */
    async update(input: UpdateRowInput) {
        await assertPeriodAccess(input.periodId, input.user);
        const row = await prisma.gestoriaEmployeeRow.findFirst({
            where: { id: input.rowId, periodId: input.periodId }
        });
        if (!row) throw new AppError('Fila no encontrada', 404);

        const data: Prisma.GestoriaEmployeeRowUpdateInput = {};
        if (input.observations !== undefined) data.observations = input.observations;
        if (input.isReviewed !== undefined) {
            data.isReviewed = input.isReviewed;
            data.reviewedAt = input.isReviewed ? new Date() : null;
            data.reviewedById = input.isReviewed ? input.user.id : null;
        }

        const updated = await prisma.gestoriaEmployeeRow.update({
            where: { id: input.rowId },
            data
        });

        await AuditService.log(
            AuditAction.DATA_UPDATE,
            AuditEntity.GESTORIA,
            input.rowId,
            { action: 'update_row', periodId: input.periodId, fields: Object.keys(data) },
            input.user.id,
            row.employeeId ?? undefined
        );

        return updated;
    },

    /**
     * Sustituye el conjunto de celdas de una fila. Atómico: o se
     * actualizan TODAS, o ninguna. Si el periodo está cerrado,
     * rechaza con 423.
     */
    async putCells(input: PutCellsInput) {
        await assertPeriodAccess(input.periodId, input.user);
        await assertOpen(input.periodId);

        const row = await prisma.gestoriaEmployeeRow.findFirst({
            where: { id: input.rowId, periodId: input.periodId }
        });
        if (!row) throw new AppError('Fila no encontrada', 404);

        // Cargar conceptos del periodo y mapear code → concept
        const concepts = await prisma.gestoriaConcept.findMany({
            where: { periodId: input.periodId }
        });
        const byCode = new Map<string, (typeof concepts)[number]>();
        for (const c of concepts) byCode.set(c.code, c);

        // Validar y convertir valores
        type CellUpsert = {
            conceptId: string;
            numericValue: number | null;
            textValue: string | null;
        };
        const upserts: CellUpsert[] = [];
        for (const c of input.cells) {
            const code = c.code.toUpperCase();
            const concept = byCode.get(code);
            if (!concept) {
                throw new AppError(`Concepto desconocido: "${code}"`, 400);
            }
            const coerced = coerceCellValue(concept.type, c.value);
            upserts.push({
                conceptId: concept.id,
                numericValue: coerced.numericValue,
                textValue: coerced.textValue
            });
        }

        // Aplicar upserts en transacción
        await prisma.$transaction(async (tx) => {
            for (const u of upserts) {
                await tx.gestoriaCell.upsert({
                    where: { rowId_conceptId: { rowId: input.rowId, conceptId: u.conceptId } },
                    update: {
                        numericValue: u.numericValue === null ? null : u.numericValue,
                        textValue: u.textValue
                    },
                    create: {
                        rowId: input.rowId,
                        conceptId: u.conceptId,
                        numericValue: u.numericValue === null ? null : u.numericValue,
                        textValue: u.textValue
                    }
                });
            }
            await recomputeRowTotals(input.rowId, tx);
        });

        // Recargar fila con celdas + totales
        const refreshed = await prisma.gestoriaEmployeeRow.findUnique({
            where: { id: input.rowId },
            include: { cells: true }
        });

        await AuditService.log(
            AuditAction.DATA_UPDATE,
            AuditEntity.GESTORIA,
            input.rowId,
            { action: 'put_cells', periodId: input.periodId, count: upserts.length },
            input.user.id,
            row.employeeId ?? undefined
        );

        return refreshed;
    },

    /**
     * Elimina una fila. Requiere periodo abierto.
     */
    async delete(periodId: string, rowId: string, user: AuthUser) {
        await assertPeriodAccess(periodId, user);
        await assertOpen(periodId);
        const row = await prisma.gestoriaEmployeeRow.findFirst({
            where: { id: rowId, periodId }
        });
        if (!row) throw new AppError('Fila no encontrada', 404);
        await prisma.gestoriaEmployeeRow.delete({ where: { id: rowId } });
        await AuditService.log(
            AuditAction.DATA_DELETE,
            AuditEntity.GESTORIA,
            rowId,
            { action: 'delete_row', periodId },
            user.id,
            row.employeeId ?? undefined
        );
    }
};
