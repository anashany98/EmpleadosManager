import type { Request, Response } from 'express';
import { PayrollControlService } from '../services/PayrollControlService';
import { PayrollControlImportService } from '../services/PayrollControlImportService';
import { validateUpload } from '../config/multer';
import { ApiResponse } from '../utils/ApiResponse';
import { handleControllerError } from '../utils/controllerError';
import type { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';
import { AppError } from '../utils/AppError';
import { prisma } from '../lib/prisma';
import { isGlobalAdmin } from '../utils/actorContext';
import {
    employeeRecordBodySchema,
    updateDailyEntriesSchema,
    exportGestoriaSchema,
    createConceptConfigSchema,
    historyQuerySchema,
    periodQuerySchema,
    restoreCellSchema,
    updateConceptValueSchema,
    updatePeriodStatusSchema,
    updateRecordCellSchema,
    timeSheetImportSchema
} from '../schemas/payrollControlSchemas';

const log = createLogger('PayrollControlController');

function requireUser(req: Request) {
    const user = (req as AuthenticatedRequest).user;
    if (!user) throw new AppError('No autenticado.', 401);
    return user;
}

function assertTenantAccess(user: NonNullable<AuthenticatedRequest['user']>, companyId: string | null | undefined) {
    if (isGlobalAdmin(user)) return;
    if (!user.companyId || !companyId || user.companyId !== companyId) {
        throw new AppError('Acceso denegado a datos de otra empresa.', 403);
    }
}

function assertPeriodAdministrator(user: NonNullable<AuthenticatedRequest['user']>) {
    if (user.role !== 'admin') throw new AppError('Solo un administrador de la empresa puede cerrar, enviar o reabrir períodos.', 403);
}

function auditData(action: string, entity: string, entityId: string, userId: string, metadata: Record<string, unknown>) {
    return { action, entity, entityId, userId, metadata: JSON.stringify(metadata) };
}

async function recordCompanyId(recordId: string) {
    const record = await prisma.payrollControlRecord.findUnique({ where: { id: recordId }, include: { period: true } });
    if (!record) throw new AppError('Registro no encontrado.', 404);
    return record;
}

export const PayrollControlController = {
    listPeriods: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const query = historyQuerySchema.parse(req.query);
            const companyId = isGlobalAdmin(user) ? query.companyId : user.companyId;
            if (!companyId) throw new AppError('Un administrador global debe indicar la empresa.', 400);
            assertTenantAccess(user, companyId);
            return ApiResponse.success(res, await PayrollControlService.listPeriods(companyId, query.limit));
        } catch (error: unknown) {
            log.error({ error }, 'Error fetching payroll control history');
            return handleControllerError(res, error, 'Error al obtener el historial mensual de RRHH');
        }
    },

    createPeriod: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const payload = periodQuerySchema.parse(req.body);
            const companyId = isGlobalAdmin(user) ? payload.companyId : user.companyId;
            if (!companyId) throw new AppError('Un administrador global debe indicar la empresa.', 400);
            assertTenantAccess(user, companyId);
            return ApiResponse.success(
                res,
                await PayrollControlService.createPeriod(companyId, payload.year, payload.month, user.id),
                'Período creado y empleados activos asignados.',
                201
            );
        } catch (error: unknown) {
            log.error({ error }, 'Error creating payroll control period');
            return handleControllerError(res, error, 'Error al crear el período mensual de RRHH');
        }
    },

    listExports: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const period = await prisma.payrollControlPeriod.findUnique({ where: { id: req.params.periodId } });
            if (!period) throw new AppError('Período no encontrado.', 404);
            assertTenantAccess(user, period.companyId);
            return ApiResponse.success(res, await PayrollControlService.listExports(period.id));
        } catch (error: unknown) {
            log.error({ error }, 'Error fetching payroll export history');
            return handleControllerError(res, error, 'Error al obtener el historial de exportaciones');
        }
    },

    listConcepts: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const companyId = isGlobalAdmin(user) ? String(req.query.companyId || '') : user.companyId;
            if (!companyId) throw new AppError('Un administrador global debe indicar la empresa.', 400);
            assertTenantAccess(user, companyId);
            return ApiResponse.success(res, await prisma.payrollControlConceptConfig.findMany({ where: { companyId }, orderBy: { order: 'asc' } }));
        } catch (error: unknown) {
            return handleControllerError(res, error, 'Error al obtener los conceptos configurables');
        }
    },

    createConcept: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            assertPeriodAdministrator(user);
            const payload = createConceptConfigSchema.parse(req.body);
            const companyId = isGlobalAdmin(user) ? payload.companyId : user.companyId;
            if (!companyId) throw new AppError('Debe indicar la empresa del concepto.', 400);
            assertTenantAccess(user, companyId);
            const config = await prisma.$transaction(async (tx) => {
                const created = await tx.payrollControlConceptConfig.create({ data: { ...payload, companyId } });
                const records = await tx.payrollControlRecord.findMany({
                    where: { period: { companyId, status: { in: ['DRAFT', 'IN_REVIEW', 'REOPENED'] } } },
                    select: { id: true }
                });
                if (records.length) await tx.payrollControlConceptValue.createMany({ data: records.map((record) => ({
                    recordId: record.id, conceptConfigId: created.id, key: created.key, label: created.label, gestoriaCode: created.gestoriaCode, value: 0
                })) });
                await tx.auditLog.create({ data: auditData('CREATE_CONTROL_CONCEPT', 'PAYROLL_CONTROL_CONCEPT', created.id, user.id, { companyId, key: created.key, gestoriaCode: created.gestoriaCode }) });
                return created;
            });
            return ApiResponse.success(res, config, 'Concepto creado.');
        } catch (error: unknown) {
            return handleControllerError(res, error, 'Error al crear el concepto configurable');
        }
    },

    getPeriod: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const query = periodQuerySchema.parse(req.query);
            const companyId = isGlobalAdmin(user) ? query.companyId : user.companyId;
            if (!companyId) throw new AppError('Un administrador global debe indicar la empresa.', 400);
            assertTenantAccess(user, companyId);
            const period = await PayrollControlService.getPeriod(companyId, query.year, query.month);
            if (!period) throw new AppError('El período mensual todavía no existe. Debe crearlo de forma explícita.', 404);
            return ApiResponse.success(res, period);
        } catch (error: unknown) {
            log.error({ error }, 'Error fetching payroll control period');
            return handleControllerError(res, error, 'Error al obtener el control general de RRHH');
        }
    },

    updateRecord: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const record = await recordCompanyId(req.params.id);
            assertTenantAccess(user, record.period.companyId);
            const payload = updateRecordCellSchema.parse(req.body);
            return ApiResponse.success(res, await PayrollControlService.updateRecordCell(record.id, payload, user.id), 'Registro actualizado.');
        } catch (error: unknown) {
            log.error({ error }, 'Error updating payroll control record');
            return handleControllerError(res, error, 'Error al actualizar el registro de control');
        }
    },

    restoreCell: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const record = await recordCompanyId(req.params.id);
            assertTenantAccess(user, record.period.companyId);
            const payload = restoreCellSchema.parse(req.body);
            return ApiResponse.success(res, await PayrollControlService.restoreCalculatedCell(record.id, payload.fieldName, payload.expectedVersion, user.id));
        } catch (error: unknown) {
            log.error({ error }, 'Error restoring payroll calculation');
            return handleControllerError(res, error, 'Error al restaurar el cálculo automático');
        }
    },

    updateConceptValue: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const record = await recordCompanyId(req.params.id);
            assertTenantAccess(user, record.period.companyId);
            const payload = updateConceptValueSchema.parse(req.body);
            return ApiResponse.success(res, await PayrollControlService.updateConceptValue(record.id, payload, payload.expectedVersion, user.id));
        } catch (error: unknown) {
            log.error({ error }, 'Error updating payroll concept');
            return handleControllerError(res, error, 'Error al actualizar el concepto mensual');
        }
    },

    updatePeriodStatus: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const payload = updatePeriodStatusSchema.parse(req.body);
            const period = await prisma.payrollControlPeriod.findUnique({ where: { id: payload.periodId } });
            if (!period) throw new AppError('Período no encontrado.', 404);
            assertTenantAccess(user, period.companyId);
            if (payload.status === 'CLOSED' || payload.status === 'REOPENED' || payload.status === 'SENT_TO_AGENCY') assertPeriodAdministrator(user);
            return ApiResponse.success(res, await PayrollControlService.updatePeriodStatus(payload.periodId, payload.status, payload.reopenReason, user.id));
        } catch (error: unknown) {
            log.error({ error }, 'Error updating payroll period status');
            return handleControllerError(res, error, 'Error al cambiar el estado del período');
        }
    },

    getEmployeeRecord: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const query = periodQuerySchema.omit({ companyId: true }).parse(req.query);
            const employee = await prisma.employee.findUnique({ where: { id: req.params.employeeId }, select: { companyId: true } });
            if (!employee) throw new AppError('Empleado no encontrado.', 404);
            assertTenantAccess(user, employee.companyId);
            return ApiResponse.success(res, await PayrollControlService.getEmployeeRecord(req.params.employeeId, query.year, query.month));
        } catch (error: unknown) {
            log.error({ error }, 'Error fetching employee payroll control');
            return handleControllerError(res, error, 'Error al obtener el control horario del empleado');
        }
    },

    initEmployeePeriod: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const body = periodQuerySchema.omit({ companyId: true }).parse(req.body);
            const employee = await prisma.employee.findUnique({ where: { id: req.params.employeeId }, select: { companyId: true } });
            if (!employee?.companyId) throw new AppError('Empleado sin empresa asignada.', 404);
            assertTenantAccess(user, employee.companyId);
            const period = await PayrollControlService.getPeriod(employee.companyId, body.year, body.month);
            if (!period) {
                await PayrollControlService.createPeriod(employee.companyId, body.year, body.month, user.id);
            }
            const info = await PayrollControlService.getEmployeeRecord(req.params.employeeId, body.year, body.month);
            return ApiResponse.success(res, info, 'Período mensual inicializado.');
        } catch (error: unknown) {
            log.error({ error }, 'Error initializing employee payroll control period');
            return handleControllerError(res, error, 'Error al inicializar el período mensual');
        }
    },

    updateEmployeeRecord: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const body = employeeRecordBodySchema.parse(req.body);
            const employee = await prisma.employee.findUnique({ where: { id: req.params.employeeId }, select: { companyId: true } });
            if (!employee?.companyId) throw new AppError('Empleado no encontrado.', 404);
            assertTenantAccess(user, employee.companyId);
            const { year, month, ...payload } = body;
            let info = await PayrollControlService.getEmployeeRecord(req.params.employeeId, year, month);
            if (!info.record) {
                if (info.periodStatus === 'NOT_CREATED') {
                    await PayrollControlService.createPeriod(employee.companyId, year, month, user.id);
                    info = await PayrollControlService.getEmployeeRecord(req.params.employeeId, year, month);
                }
                if (!info.record) throw new AppError('No existe registro mensual para el empleado.', 404);
            }
            return ApiResponse.success(res, await PayrollControlService.updateRecordCell(info.record.id, payload, user.id), 'Control horario guardado.');
        } catch (error: unknown) {
            log.error({ error }, 'Error updating employee payroll control');
            return handleControllerError(res, error, 'Error al guardar el control horario');
        }
    },

    updateEmployeeDailyEntries: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const body = updateDailyEntriesSchema.parse(req.body);
            const employee = await prisma.employee.findUnique({ where: { id: req.params.employeeId }, select: { companyId: true } });
            if (!employee?.companyId) throw new AppError('Empleado no encontrado.', 404);
            assertTenantAccess(user, employee.companyId);
            let info = await PayrollControlService.getEmployeeRecord(req.params.employeeId, body.year, body.month);
            if (!info.record) {
                if (info.periodStatus === 'NOT_CREATED') {
                    await PayrollControlService.createPeriod(employee.companyId, body.year, body.month, user.id);
                    info = await PayrollControlService.getEmployeeRecord(req.params.employeeId, body.year, body.month);
                }
                if (!info.record) throw new AppError('No existe registro mensual para el empleado.', 404);
            }
            return ApiResponse.success(
                res,
                await PayrollControlService.updateDailyEntries(info.record.id, info.record.version, body.entries, user.id),
                'Detalle diario guardado.'
            );
        } catch (error: unknown) {
            log.error({ error }, 'Error updating employee daily payroll control');
            return handleControllerError(res, error, 'Error al guardar el detalle diario');
        }
    },

    previewEmployeeTimeSheetImport: async (req: Request, res: Response) => {
        try {
            if (!req.file) throw new AppError('Selecciona un archivo Excel para importar.', 400);
            validateUpload(req.file);
            const user = requireUser(req);
            const body = timeSheetImportSchema.parse(req.body);
            const employee = await prisma.employee.findUnique({ where: { id: req.params.employeeId }, select: { companyId: true } });
            if (!employee) throw new AppError('Empleado no encontrado.', 404);
            assertTenantAccess(user, employee.companyId);
            return ApiResponse.success(res, await PayrollControlImportService.preview(req.file.buffer, body.year, body.month));
        } catch (error: unknown) {
            log.error({ error }, 'Error previewing employee timesheet import');
            return handleControllerError(res, error, 'Error al procesar la vista previa del Excel');
        }
    },

    importEmployeeTimeSheet: async (req: Request, res: Response) => {
        try {
            if (!req.file) throw new AppError('Selecciona un archivo Excel para importar.', 400);
            validateUpload(req.file);
            const user = requireUser(req);
            const body = timeSheetImportSchema.parse(req.body);
            const employee = await prisma.employee.findUnique({ where: { id: req.params.employeeId }, select: { companyId: true } });
            if (!employee) throw new AppError('Empleado no encontrado.', 404);
            assertTenantAccess(user, employee.companyId);
            const info = await PayrollControlService.getEmployeeRecord(req.params.employeeId, body.year, body.month);
            if (!info.record) throw new AppError('No existe registro mensual para el empleado.', 404);
            const expectedVersion = req.body.expectedVersion !== undefined ? Number(req.body.expectedVersion) : info.record.version;
            const result = await PayrollControlImportService.import(
                req.file.buffer,
                info.record.id,
                expectedVersion,
                body.year,
                body.month,
                user.id
            );
            return ApiResponse.success(res, result, 'Detalle horario importado correctamente desde Excel.');
        } catch (error: unknown) {
            log.error({ error }, 'Error importing employee timesheet');
            return handleControllerError(res, error, 'Error al importar las horas desde Excel');
        }
    },

    previewGestoria: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const payload = exportGestoriaSchema.parse(req.body);
            const period = await prisma.payrollControlPeriod.findUnique({ where: { id: payload.periodId } });
            if (!period) throw new AppError('Período no encontrado.', 404);
            assertTenantAccess(user, period.companyId);
            return ApiResponse.success(res, await PayrollControlService.buildGestoriaPreview(payload.periodId));
        } catch (error: unknown) {
            log.error({ error }, 'Error previewing gestoria export');
            return handleControllerError(res, error, 'Error al previsualizar la exportación a gestoría');
        }
    },

    exportToGestoria: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            assertPeriodAdministrator(user);
            const payload = exportGestoriaSchema.parse(req.body);
            const period = await prisma.payrollControlPeriod.findUnique({ where: { id: payload.periodId } });
            if (!period) throw new AppError('Período no encontrado.', 404);
            assertTenantAccess(user, period.companyId);
            const result = await PayrollControlService.exportToGestoria(payload.periodId, user.id);
            return ApiResponse.success(res, result, 'Archivo para gestoría generado correctamente.');
        } catch (error: unknown) {
            log.error({ error }, 'Error exporting to gestoria');
            return handleControllerError(res, error, 'Error al exportar los datos a gestoría');
        }
    },

    downloadExport: async (req: Request, res: Response) => {
        try {
            const user = requireUser(req);
            const exportRecord = await PayrollControlService.getExport(req.params.exportId);
            assertTenantAccess(user, exportRecord.period.companyId);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${exportRecord.filename}"`);
            return res.send(exportRecord.content);
        } catch (error: unknown) {
            log.error({ error }, 'Error downloading gestoria export');
            return handleControllerError(res, error, 'Error al descargar la exportación de gestoría');
        }
    }
};
