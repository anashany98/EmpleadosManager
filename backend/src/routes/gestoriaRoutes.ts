/**
 * Rutas REST del módulo Gestoría.
 *
 * Patrón consistente con el resto del proyecto:
 *   - `protect` global en registerRoutes
 *   - `checkPermission(module, level)` o `authorize(policy, resolver)`
 *     para aislamiento multi-tenant
 *   - `validateResource(schema)` para Zod
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authorize } from '../middlewares/authMiddleware';
import { validateResource } from '../middlewares/validateResource';
import {
    GestoriaPeriodController,
    GestoriaConceptController,
    GestoriaRowController,
    GestoriaViewController,
    GestoriaExportController,
    GestoriaSummaryController
} from '../controllers/GestoriaController';
import {
    createPeriodSchema,
    updatePeriodSchema,
    reopenPeriodSchema,
    periodIdParamSchema,
    createConceptSchema,
    updateConceptSchema,
    conceptIdParamSchema,
    createRowSchema,
    updateRowSchema,
    rowIdParamSchema,
    putCellsSchema,
    bulkRowOpSchema,
    upsertViewSchema,
    listRowsQuerySchema,
    importFromExcelSchema
} from '../schemas/gestoriaSchemas';

const router = Router();

/**
 * Resolver común para aislar periodos por empresa.
 * Devuelve `{ employeeId?: null, companyId }` para autorizar
 * contra `gestoria.*`. Si el periodo no existe, devuelve null
 * (lo que hace que la policy falle con 403/404).
 */
const resolvePeriodTarget = async (req: any) => {
    const id = req.params.id;
    if (!id) return null;
    const period = await prisma.gestoriaPeriod.findUnique({
        where: { id },
        select: { companyId: true }
    });
    return period ? { employeeId: null, companyId: period.companyId } : null;
};

/**
 * Resolver para /companies/:companyId/periods. Permite autorizar
 * la creación si el usuario tiene acceso a la empresa.
 */
const resolveCompanyTarget = async (req: any) => {
    const companyId = req.params.companyId;
    if (!companyId) return null;
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true }
    });
    return company ? { employeeId: null, companyId: company.id } : null;
};

// =====================================================================
// Periods
// =====================================================================

router.get(
    '/companies/:companyId/periods',
    authorize('gestoria.read', resolveCompanyTarget),
    GestoriaPeriodController.list
);

router.post(
    '/companies/:companyId/periods',
    authorize('gestoria.write', resolveCompanyTarget),
    validateResource(createPeriodSchema),
    GestoriaPeriodController.create
);

router.get(
    '/periods/:id',
    authorize('gestoria.read', resolvePeriodTarget),
    validateResource(periodIdParamSchema),
    GestoriaPeriodController.getById
);

router.patch(
    '/periods/:id',
    authorize('gestoria.write', resolvePeriodTarget),
    validateResource(updatePeriodSchema),
    GestoriaPeriodController.update
);

router.post(
    '/periods/:id/close',
    authorize('gestoria.close', resolvePeriodTarget),
    validateResource(periodIdParamSchema),
    GestoriaPeriodController.close
);

router.post(
    '/periods/:id/reopen',
    authorize('gestoria.close', resolvePeriodTarget),
    validateResource(reopenPeriodSchema),
    GestoriaPeriodController.reopen
);

router.post(
    '/companies/:companyId/import',
    authorize('gestoria.write', resolveCompanyTarget),
    validateResource(importFromExcelSchema),
    GestoriaPeriodController.importFromExcel
);

// =====================================================================
// Concepts
// =====================================================================

router.get(
    '/periods/:id/concepts',
    authorize('gestoria.read', resolvePeriodTarget),
    validateResource(periodIdParamSchema),
    GestoriaConceptController.list
);

router.post(
    '/periods/:id/concepts',
    authorize('gestoria.write', resolvePeriodTarget),
    validateResource(createConceptSchema),
    GestoriaConceptController.create
);

router.patch(
    '/periods/:id/concepts/:conceptId',
    authorize('gestoria.write', resolvePeriodTarget),
    validateResource(updateConceptSchema),
    GestoriaConceptController.update
);

router.delete(
    '/periods/:id/concepts/:conceptId',
    authorize('gestoria.write', resolvePeriodTarget),
    validateResource(conceptIdParamSchema),
    GestoriaConceptController.delete
);

// =====================================================================
// Rows
// =====================================================================

router.get(
    '/periods/:id/rows',
    authorize('gestoria.read', resolvePeriodTarget),
    validateResource(listRowsQuerySchema),
    GestoriaRowController.list
);

router.post(
    '/periods/:id/rows',
    authorize('gestoria.write', resolvePeriodTarget),
    validateResource(createRowSchema),
    GestoriaRowController.create
);

router.get(
    '/periods/:id/rows/:rowId',
    authorize('gestoria.read', resolvePeriodTarget),
    validateResource(rowIdParamSchema),
    GestoriaRowController.getById
);

router.patch(
    '/periods/:id/rows/:rowId',
    authorize('gestoria.write', resolvePeriodTarget),
    validateResource(updateRowSchema),
    GestoriaRowController.update
);

router.put(
    '/periods/:id/rows/:rowId/cells',
    authorize('gestoria.write', resolvePeriodTarget),
    validateResource(putCellsSchema),
    GestoriaRowController.putCells
);

router.delete(
    '/periods/:id/rows/:rowId',
    authorize('gestoria.write', resolvePeriodTarget),
    validateResource(rowIdParamSchema),
    GestoriaRowController.delete
);

router.post(
    '/periods/:id/rows/bulk',
    authorize('gestoria.write', resolvePeriodTarget),
    validateResource(bulkRowOpSchema),
    GestoriaRowController.bulk
);

// =====================================================================
// Summary (cálculo BRUTO/IRPF/TGSS para la pestaña "Resumen")
// =====================================================================

router.get(
    '/periods/:id/summary',
    authorize('gestoria.read', resolvePeriodTarget),
    validateResource(periodIdParamSchema),
    GestoriaSummaryController.get
);

router.get(
    '/periods/:id/rows/:rowId/summary',
    authorize('gestoria.read', resolvePeriodTarget),
    validateResource(rowIdParamSchema),
    GestoriaRowController.getRowSummary
);

// =====================================================================
// Views
// =====================================================================

router.get(
    '/periods/:id/views',
    authorize('gestoria.read', resolvePeriodTarget),
    validateResource(periodIdParamSchema),
    GestoriaViewController.list
);

router.get(
    '/periods/:id/views/default',
    authorize('gestoria.read', resolvePeriodTarget),
    validateResource(periodIdParamSchema),
    GestoriaViewController.getDefault
);

router.post(
    '/periods/:id/views',
    authorize('gestoria.write', resolvePeriodTarget),
    validateResource(upsertViewSchema),
    GestoriaViewController.upsert
);

router.delete(
    '/periods/:id/views/:viewName',
    authorize('gestoria.write', resolvePeriodTarget),
    GestoriaViewController.delete
);

// =====================================================================
// Export
// =====================================================================

router.get(
    '/periods/:id/export/preview',
    authorize('gestoria.read', resolvePeriodTarget),
    validateResource(periodIdParamSchema),
    GestoriaExportController.preview
);

router.post(
    '/periods/:id/export',
    authorize('gestoria.export', resolvePeriodTarget),
    validateResource(periodIdParamSchema),
    GestoriaExportController.generate
);

router.get(
    '/periods/:id/export/download',
    authorize('gestoria.export', resolvePeriodTarget),
    validateResource(periodIdParamSchema),
    GestoriaExportController.download
);

router.get(
    '/periods/:id/exports',
    authorize('gestoria.read', resolvePeriodTarget),
    validateResource(periodIdParamSchema),
    GestoriaExportController.listLogs
);

export default router;
