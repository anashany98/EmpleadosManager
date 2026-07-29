import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { createLogger } from '../services/LoggerService';
import { EmployeeScheduleService } from '../services/EmployeeScheduleService';
import { AuthenticatedRequest } from '../types/express';
import { isGlobalAdmin, assertSameTenantOrGlobal, type TenantActor } from '../utils/actorContext';

const log = createLogger('EmployeeScheduleController');

// ─── Helpers ────────────────────────────────────────────────────────

async function assertCanEditEmployee(employeeId: string, actor: TenantActor) {
    if (isGlobalAdmin(actor)) return;
    const emp = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, companyId: true, deletedAt: true },
    });
    if (!emp || emp.deletedAt) {
        const err = new Error('Empleado no encontrado');
        (err as Error & { status?: number }).status = 404;
        throw err;
    }
    if (!assertSameTenantOrGlobal(actor, emp.companyId)) {
        const err = new Error('Empleado no encontrado');
        (err as Error & { status?: number }).status = 404;
        throw err;
    }
}

function parseYearMonth(req: Request): { year: number; month: number } {
    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
        const err = new Error('year inválido (rango 2000-2100)');
        (err as Error & { status?: number }).status = 400;
        throw err;
    }
    if (!Number.isFinite(month) || month < 1 || month > 12) {
        const err = new Error('month inválido (rango 1-12)');
        (err as Error & { status?: number }).status = 400;
        throw err;
    }
    return { year, month };
}

// ─── Controller ─────────────────────────────────────────────────────

export const EmployeeScheduleController = {
    /**
     * GET /api/employees/:id/schedule?year=YYYY&month=MM
     * Devuelve todas las entradas del mes más el día computado.
     */
    getMonth: async (req: Request, res: Response) => {
        try {
            const user = (req as AuthenticatedRequest).user;
            const employeeId = req.params.id;
            await assertCanEditEmployee(employeeId, user as TenantActor);
            const { year, month } = parseYearMonth(req);
            const summary = await EmployeeScheduleService.getMonth(employeeId, year, month);
            return ApiResponse.success(res, summary);
        } catch (e) {
            log.error('getMonth failed: ' + (e instanceof Error ? e.message : String(e)));
            return ApiResponse.error(res, e instanceof Error ? e.message : 'Error', (e as { status?: number }).status ?? 500);
        }
    },

    /**
     * PUT /api/employees/:id/schedule
     * Body: { date: 'YYYY-MM-DD', entry1?, exit1?, entry2?, exit2?, discountMin?, notes? }
     * Crea o actualiza el día.
     */
    upsertDay: async (req: Request, res: Response) => {
        try {
            const user = (req as AuthenticatedRequest).user;
            const employeeId = req.params.id;
            await assertCanEditEmployee(employeeId, user as TenantActor);
            const { date, entry1, exit1, entry2, exit2, discountMin, notes } = req.body ?? {};
            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return ApiResponse.error(res, 'date debe ser YYYY-MM-DD', 400);
            }
            // Light validation: HH:mm
            for (const k of ['entry1', 'exit1', 'entry2', 'exit2'] as const) {
                const v = req.body?.[k];
                if (v !== undefined && v !== null && v !== '' && !/^\d{1,2}:\d{2}$/.test(String(v))) {
                    return ApiResponse.error(res, `${k} debe tener formato HH:mm`, 400);
                }
            }
            const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } });
            const result = await EmployeeScheduleService.upsertDay(employeeId, emp?.companyId ?? null, {
                date,
                entry1: entry1 || null,
                exit1: exit1 || null,
                entry2: entry2 || null,
                exit2: exit2 || null,
                discountMin: typeof discountMin === 'number' ? discountMin : 0,
                notes: notes || null,
            });
            return ApiResponse.success(res, result);
        } catch (e) {
            log.error('upsertDay failed: ' + (e instanceof Error ? e.message : String(e)));
            return ApiResponse.error(res, e instanceof Error ? e.message : 'Error', (e as { status?: number }).status ?? 500);
        }
    },

    /**
     * DELETE /api/employees/:id/schedule/:date
     */
    deleteDay: async (req: Request, res: Response) => {
        try {
            const user = (req as AuthenticatedRequest).user;
            const employeeId = req.params.id;
            const date = req.params.date;
            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return ApiResponse.error(res, 'date debe ser YYYY-MM-DD', 400);
            }
            await assertCanEditEmployee(employeeId, user as TenantActor);
            const result = await EmployeeScheduleService.deleteDay(employeeId, date);
            return ApiResponse.success(res, { deleted: result.count });
        } catch (e) {
            log.error('deleteDay failed: ' + (e instanceof Error ? e.message : String(e)));
            return ApiResponse.error(res, e instanceof Error ? e.message : 'Error', (e as { status?: number }).status ?? 500);
        }
    },
};
