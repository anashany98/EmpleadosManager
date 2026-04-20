import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/express';
import { ApiResponse } from '../utils/ApiResponse';
import { EmployeeImportService } from '../services/EmployeeImportService';
import { AuditService } from '../services/AuditService';
import { createLogger } from '../services/LoggerService';

const log = createLogger('EmployeeImportController');

export const EmployeeImportController = {
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

            const result = await EmployeeImportService.processFile(req.file.buffer, importOptions);

            const userId = user.id;
            await AuditService.log('IMPORT', 'EMPLOYEE', 'MULTIPLE', { count: result.importedCount }, userId);

            return ApiResponse.success(res, result, `Importación completada. ${result.importedCount} empleados procesados.`);
        } catch (error: any) {
            log.error({ error }, 'Error importing employees');
            return ApiResponse.error(res, error.message || 'Error procesando el archivo de empleados', error.statusCode || 500);
        }
    },

    downloadTemplate: async (req: Request, res: Response) => {
        try {
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Empleados');

            const headers = [
                'Nombre', 'Apellido', 'DNI', 'Email', 'Teléfono',
                'Departamento', 'Puesto', 'Categoría', 'Empresa (ID)'
            ];
            sheet.addRow(headers);

            sheet.addRow(['Juan', 'García', '12345678A', 'juan@empresa.com', '612345678', 'IT', 'Desarrollador', 'Senior', '']);
            sheet.addRow(['María', 'López', '87654321B', 'maria@empresa.com', '698765432', 'RRHH', 'Técnica', 'Junior', '']);

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=plantilla_empleados.xlsx');

            const buffer = await workbook.xlsx.writeBuffer();
            res.send(Buffer.from(buffer));
        } catch (error) {
            log.error({ error }, 'Error generating template');
            return ApiResponse.error(res, 'Error al generar plantilla');
        }
    }
};