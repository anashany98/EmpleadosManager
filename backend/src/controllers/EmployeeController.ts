import { Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import * as ExcelJS from 'exceljs';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';
import {
    EmployeeService,
    EmployeeMedicalService,
    EmployeeTrainingService,
    EmployeeVacationService,
    EmployeeNotesService
} from '../services/EmployeeService';
import { AuditService } from '../services/AuditService';

const log = createLogger('EmployeeController');

export const EmployeeController = {
    getAll: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            log.info({ userId: user?.id, role: user?.role, companyId: user?.companyId, employeeId: user?.employeeId, query: req.query }, 'DEBUG getAll called');
            const result = await EmployeeService.getAll(user, req.query);
            log.info({ count: result.data.length, total: result.meta.total }, 'DEBUG getAll result');
            return ApiResponse.paginated(res, result.data, result.meta);
        } catch (error: any) {
            log.error({ error }, 'Error fetching employees');
            return ApiResponse.error(res, error.message || 'Error al obtener empleados', error.statusCode || 500);
        }
    },

    getDepartments: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const departments = await EmployeeService.getDepartments(user);
            return ApiResponse.success(res, departments);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al obtener departamentos', error.statusCode || 500);
        }
    },

    getHierarchy: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const hierarchy = await EmployeeService.getHierarchy(user);
            return ApiResponse.success(res, hierarchy);
        } catch (error: any) {
            log.error({ error }, 'Error fetching hierarchy');
            return ApiResponse.error(res, error.message || 'Error al obtener jerarquía', error.statusCode || 500);
        }
    },

    importEmployees: async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return ApiResponse.error(res, 'No se ha subido ningún archivo', 400);
            }

            const { user } = req as AuthenticatedRequest;

            const isGlobalAdmin = !user.companyId && user.role === 'admin';

            if (!isGlobalAdmin && !user.companyId) {
                return ApiResponse.error(res, 'No tienes una empresa asignada para importar empleados', 400);
            }

            const importOptions = {
                forceCompanyId: user.companyId || undefined,
                skipCompanyValidation: isGlobalAdmin
            };

            const { EmployeeImportService } = await import('../services/EmployeeImportService');
            const result = await EmployeeImportService.processFile(req.file.buffer, importOptions);

            const userId = (req as AuthenticatedRequest).user?.id;
            await AuditService.log('IMPORT', 'EMPLOYEE', 'MULTIPLE', { count: result.importedCount }, userId);

            return ApiResponse.success(res, result, `Importación completada. ${result.importedCount} empleados procesados.`);
        } catch (error: any) {
            log.error({ error }, 'Error importing employees');
            return ApiResponse.error(res, error.message || 'Error procesando el archivo de empleados', error.statusCode || 500);
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const { employee, includeSensitiveData } = await EmployeeService.getById(user, id);

            if (includeSensitiveData) {
                const userId = (req as AuthenticatedRequest).user?.id;
                await AuditService.log('VIEW_SENSITIVE_DATA', 'EMPLOYEE', id, { info: 'Acceso a ficha detallada' }, userId, id);
            }

            return ApiResponse.success(res, employee);
        } catch (error: any) {
            log.error({ error }, 'Error getting employee by id');
            return ApiResponse.error(res, error.message || 'Error al obtener el empleado', error.statusCode || 500);
        }
    },

    create: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const employee = await EmployeeService.create(user, req.body);
            return ApiResponse.success(res, employee, 'Empleado creado correctamente', 201);
        } catch (error: any) {
            log.error({ error }, 'Error creating employee');
            return ApiResponse.error(res, error.message || 'Error al criar el empleado', error.statusCode || 500);
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const { employee } = await EmployeeService.update(user, id, req.body);
            return ApiResponse.success(res, employee, 'Empleado actualizado correctamente');
        } catch (error: any) {
            log.error({ error }, 'Error updating employee');
            return ApiResponse.error(res, error.message || 'Error al actualizar el empleado', error.statusCode || 500);
        }
    },

    bulkUpdate: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { employeeIds, action, data } = req.body;
            const count = await EmployeeService.bulkUpdate(user, employeeIds, action, data);
            return ApiResponse.success(res, { count }, `${count} empleados actualizados correctamente`);
        } catch (error: any) {
            log.error({ error }, 'Bulk update error');
            return ApiResponse.error(res, error.message || 'Error en la actualización masiva', error.statusCode || 500);
        }
    },

    downloadTemplate: async (req: Request, res: Response) => {
        try {
            const headers = [
                'Nombre', 'Apellido', 'DNI', 'DNI Vencimiento', 'Subcuenta 465',
                'Email', 'Teléfono', 'Dirección', 'Provincia', 'Ciudad', 'Código Postal',
                'Seguridad Social', 'IBAN', 'Fecha Nacimiento', 'Lugar Registro',
                'Empresa (ID)', 'Departamento', 'Categoría', 'Puesto',
                'Tipo Contrato', 'Convenio', 'Fecha Entrada',
                'Llamada Fijo-Disc', 'Interrupción Fijo-Disc', 'Fecha Baja', 'Motivo Baja',
                'Carnet Conducir (SI/NO)', 'Tipo Carnet', 'Vencimiento Carnet',
                'Contacto Emergencia Nombre', 'Contacto Emergencia Teléfono',
                'Género', 'ID Responsable',
                // Vacaciones
                'Vacaciones anuales', 'Vacaciones arrastradas', 'Vacaciones gastadas'
            ];

            const exampleData = [
                {
                    'Nombre': 'EJEMPLO: Juan',
                    'DNI': 'EJEMPLO: 12345678A',
                    'Empresa (ID)': '(Opcional)',
                    'Vacaciones anuales': 30,
                    'Vacaciones arrastradas': 0,
                    'Vacaciones gastadas': 0
                }
            ];

            const instructions = [
                { 'Campo': 'Instrucciones Generales', 'Descripción': 'Sigue estas reglas para una importación correcta.' }
            ];

            const workbook = new ExcelJS.Workbook();

            // Sheet 1: Plantilla Importación
            const sheet = workbook.addWorksheet('Plantilla Importación');
            sheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));

            // Style header row
            sheet.getRow(1).font = { bold: true };

            // Add example data row
            sheet.addRow(exampleData[0]);

            // Sheet 2: INSTRUCCIONES
            const wsIns = workbook.addWorksheet('INSTRUCCIONES');
            wsIns.columns = [
                { header: 'Campo', key: 'Campo', width: 30 },
                { header: 'Descripción', key: 'Descripción', width: 50 }
            ];
            wsIns.getRow(1).font = { bold: true };
            wsIns.addRow(instructions[0]);

            const excelBuffer = await workbook.xlsx.writeBuffer();

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=plantilla_empleados.xlsx');
            return res.send(Buffer.from(excelBuffer));
        } catch (error: any) {
            log.error({ error }, 'Error generating Excel template');
            return ApiResponse.error(res, error.message || 'Error al generar la plantilla', 500);
        }
    },

    getMedicalReviews: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const reviews = await EmployeeMedicalService.getReviews(user, id);
            return ApiResponse.success(res, reviews);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al obtener revisiones médicas', 500);
        }
    },

    createMedicalReview: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const review = await EmployeeMedicalService.createReview(user, id, req.body);
            return ApiResponse.success(res, review, 'Revisión médica creada correctamente', 201);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al crear la revisión médica', 500);
        }
    },

    getTrainings: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const trainings = await EmployeeTrainingService.getTrainings(user, id);
            return ApiResponse.success(res, trainings);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al obtener formaciones', 500);
        }
    },

    createTraining: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const training = await EmployeeTrainingService.createTraining(user, id, req.body);
            return ApiResponse.success(res, training, 'Formación creada correctamente', 201);
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al crear la formación', 500);
        }
    },

    deleteMedicalReview: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { reviewId } = req.params;
            await EmployeeMedicalService.deleteReview(user, reviewId);
            return ApiResponse.success(res, null, 'Revisión eliminada');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al eliminar revisión', error.statusCode || 500);
        }
    },

    deleteTraining: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { trainingId } = req.params;
            await EmployeeTrainingService.deleteTraining(user, trainingId);
            return ApiResponse.success(res, null, 'Formación eliminada');
        } catch (error: any) {
            return ApiResponse.error(res, error.message || 'Error al eliminar formación', error.statusCode || 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            await EmployeeService.delete(user, id);
            return ApiResponse.success(res, null, 'Empleado desactivado correctamente');
        } catch (error: any) {
            log.error({ error }, 'Error deactivating employee');
            return ApiResponse.error(res, error.message || 'Error al dar de baja al empleado', error.statusCode || 500);
        }
    },

    getPortabilityReport: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const reportData = await EmployeeService.getPortabilityReport(user, req.query);
            return res.json(reportData);
        } catch (error: any) {
            log.error({ error }, 'Error generating portability report');
            return ApiResponse.error(res, error.message || 'Error al generar reporte de portabilidad', 500);
        }
    },

    getFieldOptions: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const options = await EmployeeService.getFieldOptions(user);
            return ApiResponse.success(res, options);
        } catch (error: any) {
            log.error({ error }, 'Error fetching field options');
            return ApiResponse.error(res, error.message || 'Error al obtener opciones', 500);
        }
    },

    getVacationBalance: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const year = parseInt(req.query.year as string) || new Date().getFullYear();
            const summary = await EmployeeVacationService.getBalance(user, id, year);

            if (!summary) {
                return ApiResponse.error(res, 'No se pudo calcular el saldo de vacaciones', 404);
            }

            return ApiResponse.success(res, summary);
        } catch (error: any) {
            log.error({ error }, 'Error fetching vacation balance');
            return ApiResponse.error(res, error.message || 'Error al obtener saldo de vacaciones', 500);
        }
    },

    updateVacationBalance: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const summary = await EmployeeVacationService.updateBalance(user, id, req.body);
            return ApiResponse.success(res, summary, 'Saldo de vacaciones actualizado');
        } catch (error: any) {
            log.error({ error }, 'Error updating vacation balance');
            return ApiResponse.error(res, error.message || 'Error al actualizar saldo de vacaciones', 500);
        }
    },

    updatePrivateNotes: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const { note } = req.body;
            const result = await EmployeeNotesService.updatePrivateNotes(user, id, note);
            return ApiResponse.success(res, result, 'Notas privadas actualizadas');
        } catch (error: any) {
            log.error({ error }, 'Error updating private notes');
            return ApiResponse.error(res, error.message || 'Error al actualizar notas privadas', 500);
        }
    },

    getPrivateNotesHistory: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const entries = await EmployeeNotesService.getPrivateNotesHistory(user, id);
            return ApiResponse.success(res, entries);
        } catch (error: any) {
            log.error({ error }, 'Error fetching private notes history');
            return ApiResponse.error(res, error.message || 'Error al obtener historial de notas', 500);
        }
    }
};
