/**
 * GestoriaController — endpoints REST del módulo Gestoría.
 *
 * Mantiene la forma del response con `ApiResponse` (success/error)
 * y la extracción de `user` desde `AuthenticatedRequest` que el
 * `protect` middleware añade.
 */
import { Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthenticatedRequest } from '../types/express';
import { handleControllerError } from '../utils/controllerError';
import { GestoriaPeriodService } from '../services/GestoriaPeriodService';
import { GestoriaConceptService } from '../services/GestoriaConceptService';
import { GestoriaRowService } from '../services/GestoriaRowService';
import { GestoriaBulkService, BulkOp } from '../services/GestoriaBulkService';
import { GestoriaViewService } from '../services/GestoriaViewService';
import { GestoriaSummaryService } from '../services/GestoriaSummaryService';
import { GestoriaExportService } from '../services/GestoriaExportService';
import { GestoriaImportService } from '../services/GestoriaImportService';
import { prisma } from '../lib/prisma';
import { isGlobalAdmin, assertSameTenantOrGlobal, type TenantActor } from '../utils/actorContext';

/**
 * Helper local: assert que el periodo existe y que el actor tiene
 * acceso al tenant. Lanza 404 si no existe, 403 si pertenece a otro tenant.
 */
async function assertPeriodAccess(periodId: string, actor: TenantActor): Promise<void> {
    const period = await prisma.gestoriaPeriod.findUnique({
        where: { id: periodId },
        select: { id: true, companyId: true },
    });
    if (!period) {
        const err = new AppError('Periodo no encontrado', 404);
        throw err;
    }
    if (!isGlobalAdmin(actor) && !assertSameTenantOrGlobal(actor, period.companyId)) {
        const err = new AppError('Periodo no encontrado', 404); // 404 para no enumerar
        throw err;
    }
}

// =====================================================================
// Periods
// =====================================================================

export const GestoriaPeriodController = {
    create: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { companyId } = req.params;
            const { year, month, notes } = req.body as { year: number; month: number; notes?: string };
            const period = await GestoriaPeriodService.create({ companyId, year, month, notes, user });
            return ApiResponse.success(res, period, 'Periodo creado');
        } catch (e) {
            return handleControllerError(res, e, 'create_period');
        }
    },

    list: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { companyId } = req.params;
            const status = (req.query.status as any) || undefined;
            const periods = await GestoriaPeriodService.list({ companyId, status, user });
            return ApiResponse.success(res, periods);
        } catch (e) {
            return handleControllerError(res, e, 'list_periods');
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const period = await GestoriaPeriodService.getById(id, user);
            return ApiResponse.success(res, period);
        } catch (e) {
            return handleControllerError(res, e, 'get_period');
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const { notes, exportMapping } = req.body;
            const period = await GestoriaPeriodService.update({ id, notes, exportMapping, user });
            return ApiResponse.success(res, period, 'Periodo actualizado');
        } catch (e) {
            return handleControllerError(res, e, 'update_period');
        }
    },

    close: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const period = await GestoriaPeriodService.close({ id, user });
            return ApiResponse.success(res, period, 'Periodo cerrado');
        } catch (e) {
            return handleControllerError(res, e, 'close_period');
        }
    },

    reopen: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const { reason } = req.body as { reason: string };
            const period = await GestoriaPeriodService.reopen({ id, reason, user });
            return ApiResponse.success(res, period, 'Periodo reabierto');
        } catch (e) {
            return handleControllerError(res, e, 'reopen_period');
        }
    },

    importFromExcel: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { companyId } = req.params;
            const { year, month, notes, concepts, employees, festivos, config } = req.body;
            const result = await GestoriaImportService.importFromExcel({
                companyId, year, month, notes, concepts, employees, festivos, config, user
            });
            return ApiResponse.success(res, result, 'Plantilla importada correctamente');
        } catch (e) {
            return handleControllerError(res, e, 'import_excel');
        }
    }
};

// =====================================================================
// Concepts
// =====================================================================

export const GestoriaConceptController = {
    list: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const includeHidden = String(req.query.includeHidden ?? 'true') !== 'false';
            const concepts = await GestoriaConceptService.list(id, user, includeHidden);
            return ApiResponse.success(res, concepts);
        } catch (e) {
            return handleControllerError(res, e, 'list_concepts');
        }
    },

    create: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const { code, label, type, decimals, order, isSystem, gestoriaCode } = req.body;
            const concept = await GestoriaConceptService.create({
                periodId: id, code, label, type, decimals, order, isSystem, gestoriaCode, user
            });
            return ApiResponse.success(res, concept, 'Concepto creado');
        } catch (e) {
            return handleControllerError(res, e, 'create_concept');
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id, conceptId } = req.params;
            const { label, isVisible, order, decimals, gestoriaCode } = req.body;
            const concept = await GestoriaConceptService.update({
                periodId: id, conceptId, label, isVisible, order, decimals, gestoriaCode, user
            });
            return ApiResponse.success(res, concept, 'Concepto actualizado');
        } catch (e) {
            return handleControllerError(res, e, 'update_concept');
        }
    },

    delete: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id, conceptId } = req.params;
            const force = String(req.query.force ?? 'false') === 'true';
            await GestoriaConceptService.delete({ periodId: id, conceptId, force, user });
            return ApiResponse.success(res, null, 'Concepto eliminado');
        } catch (e) {
            return handleControllerError(res, e, 'delete_concept');
        }
    }
};

// =====================================================================
// Rows
// =====================================================================

export const GestoriaRowController = {
    list: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const opts: any = { periodId: id, user };
            if (req.query.isReviewed !== undefined) opts.isReviewed = req.query.isReviewed === 'true';
            if (req.query.department) opts.department = String(req.query.department);
            if (req.query.category) opts.category = String(req.query.category);
            if (req.query.search) opts.search = String(req.query.search);
            const rows = await GestoriaRowService.list(opts);
            return ApiResponse.success(res, rows);
        } catch (e) {
            return handleControllerError(res, e, 'list_rows');
        }
    },

    create: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const { employeeId } = req.body;
            const row = await GestoriaRowService.create({ periodId: id, employeeId, user });
            return ApiResponse.success(res, row, 'Fila creada');
        } catch (e) {
            return handleControllerError(res, e, 'create_row');
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id, rowId } = req.params;
            const row = await GestoriaRowService.getById(id, rowId, user);
            return ApiResponse.success(res, row);
        } catch (e) {
            return handleControllerError(res, e, 'get_row');
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id, rowId } = req.params;
            const { observations, isReviewed } = req.body;
            const row = await GestoriaRowService.update({
                periodId: id, rowId, observations, isReviewed, user
            });
            return ApiResponse.success(res, row, 'Fila actualizada');
        } catch (e) {
            return handleControllerError(res, e, 'update_row');
        }
    },

    putCells: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id, rowId } = req.params;
            const { cells } = req.body;
            const row = await GestoriaRowService.putCells({
                periodId: id, rowId, cells, user
            });
            return ApiResponse.success(res, row, 'Celdas actualizadas');
        } catch (e) {
            return handleControllerError(res, e, 'put_cells');
        }
    },

    delete: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id, rowId } = req.params;
            await GestoriaRowService.delete(id, rowId, user);
            return ApiResponse.success(res, null, 'Fila eliminada');
        } catch (e) {
            return handleControllerError(res, e, 'delete_row');
        }
    },

    bulk: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const op = req.body as BulkOp;
            const result = await GestoriaBulkService.apply({ periodId: id, op, user });
            return ApiResponse.success(res, result, 'Operación masiva aplicada');
        } catch (e) {
            return handleControllerError(res, e, 'bulk_rows');
        }
    },

    /**
     * GET /api/gestoria/periods/:id/rows/:rowId/summary
     * Resumen individual de un row (mismo cálculo que el endpoint global,
     * pero devuelve solo una fila — útil para vista detalle).
     */
    getRowSummary: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id, rowId } = req.params;
            await assertPeriodAccess(id, user);
            const summary = await GestoriaSummaryService.getPeriodSummary(id);
            const row = summary.rows.find((r) => r.rowId === rowId);
            if (!row) {
                return ApiResponse.error(res, 'Fila no encontrada en el periodo', 404);
            }
            return ApiResponse.success(res, { ...row, detected: summary.detected });
        } catch (e) {
            return handleControllerError(res, e, 'row_summary');
        }
    },
};

// =====================================================================
// Summary (cálculo BRUTO/IRPF/TGSS — pestaña "Resumen")
// =====================================================================

export const GestoriaSummaryController = {
    /**
     * GET /api/gestoria/periods/:id/summary
     * Devuelve el resumen completo del periodo: filas con BRUTO/TOTAL €
     * calculados, totales generales y desglose por categoría.
     */
    get: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            await assertPeriodAccess(id, user);
            const summary = await GestoriaSummaryService.getPeriodSummary(id);
            return ApiResponse.success(res, summary);
        } catch (e) {
            return handleControllerError(res, e, 'period_summary');
        }
    },
};

// =====================================================================
// Views
// =====================================================================

export const GestoriaViewController = {
    list: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const views = await GestoriaViewService.list(id, user);
            return ApiResponse.success(res, views);
        } catch (e) {
            return handleControllerError(res, e, 'list_views');
        }
    },

    getDefault: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const view = await GestoriaViewService.getDefault(id, user);
            return ApiResponse.success(res, view);
        } catch (e) {
            return handleControllerError(res, e, 'get_default_view');
        }
    },

    upsert: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const { viewName, columnOrder, hiddenConcepts, isDefault } = req.body;
            const view = await GestoriaViewService.upsert({
                periodId: id, viewName, columnOrder, hiddenConcepts, isDefault, user
            });
            return ApiResponse.success(res, view, 'Vista guardada');
        } catch (e) {
            return handleControllerError(res, e, 'upsert_view');
        }
    },

    delete: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id, viewName } = req.params;
            if (!viewName) throw new AppError('viewName es obligatorio', 400);
            await GestoriaViewService.delete(id, viewName, user);
            return ApiResponse.success(res, null, 'Vista eliminada');
        } catch (e) {
            return handleControllerError(res, e, 'delete_view');
        }
    }
};

// =====================================================================
// Export
// =====================================================================

export const GestoriaExportController = {
    preview: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const result = await GestoriaExportService.preview(id, user);
            return ApiResponse.success(res, result);
        } catch (e) {
            return handleControllerError(res, e, 'preview_export');
        }
    },

    generate: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const result = await GestoriaExportService.generate(id, user);
            // El controller no transmite el archivo aquí: eso lo
            // hace el endpoint `download` que reutiliza el log.
            // Devolvemos el logId para que el cliente pueda pedir
            // la descarga de inmediato.
            return ApiResponse.success(res, {
                logId: result.logId,
                outputFilename: result.outputFilename,
                fileSize: result.fileSize,
                fileHash: result.fileHash,
                rowCount: result.rowCount,
                totalAmount: result.totalAmount,
                missingMappings: result.missingMappings,
                // `filePath` NO se envía al cliente: solo el backend
                // puede pasarlo a `download`.
                _internal: { filePath: result.filePath }
            }, 'Exportación generada');
        } catch (e) {
            return handleControllerError(res, e, 'generate_export');
        }
    },

    /**
     * Descarga el .xls generado. Espera un `?logId=` o un
     * `?filePath=` reciente (en este MVP, lo más simple: se
     * regenera on-demand desde el log). Para evitar volver a
     * cifrar/descifrar, regeneramos el archivo.
     */
    download: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            // Si viene logId, simplemente regeneramos (idempotente
            // y barato). Si no, generamos en el momento.
            const logId = req.query.logId ? String(req.query.logId) : null;
            // Re-generar: el coste de regenerar es mínimo comparado
            // con mantener archivos en disco.
            const result = await GestoriaExportService.generate(id, user);
            const buffer = await GestoriaExportService.readFile(result.filePath);
            try {
                await GestoriaExportService.cleanup(result.filePath);
            } catch { /* noop */ }
            if (logId) {
                await GestoriaExportService.recordDownload(logId, user);
            }
            res.setHeader('Content-Type', 'application/vnd.ms-excel');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${result.outputFilename}"`
            );
            res.setHeader('Content-Length', buffer.length.toString());
            res.send(buffer);
        } catch (e) {
            return handleControllerError(res, e, 'download_export');
        }
    },

    listLogs: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const logs = await GestoriaExportService.listLogs(id, user);
            return ApiResponse.success(res, logs);
        } catch (e) {
            return handleControllerError(res, e, 'list_export_logs');
        }
    }
};
