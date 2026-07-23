import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { AuthenticatedRequest } from '../types/express';
import { ApiResponse } from '../utils/ApiResponse';
import { handleControllerError } from '../utils/controllerError';
import { EmployeeImportService } from '../services/EmployeeImportService';
import { AuditService } from '../services/AuditService';
import { createLogger } from '../services/LoggerService';

const log = createLogger('EmployeeImportController');

function parseMapping(rawMapping: unknown) {
    if (!rawMapping) return undefined;

    if (typeof rawMapping === 'string') {
        try {
            return JSON.parse(rawMapping);
        } catch {
            return undefined;
        }
    }

    if (typeof rawMapping === 'object') {
        return rawMapping;
    }

    return undefined;
}

export const EmployeeImportController = {
    previewImport: async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return ApiResponse.error(res, 'No se ha subido ningun archivo', 400);
            }

            const { user } = req as AuthenticatedRequest;
            const isGlobalAdmin = !user.companyId && user.role === 'admin';

            if (!isGlobalAdmin && !user.companyId) {
                return ApiResponse.error(res, 'No tienes una empresa asignada para importar empleados', 400);
            }

            const importOptions = {
                forceCompanyId: user.companyId || undefined,
                skipCompanyValidation: isGlobalAdmin,
                auditUserId: user.id
            };

            const mapping = parseMapping((req as any).body?.mapping);
            const result = await EmployeeImportService.previewFile(req.file.buffer, importOptions, mapping);
            return ApiResponse.success(res, result, 'Archivo analizado correctamente. Revisa el mapeo antes de importar.');
        } catch (error: any) {
            log.error({
                error: error?.message || String(error),
                stack: error?.stack,
                name: error?.name
            }, 'Error previewing employee import');
            return handleControllerError(res, error, 'Error analizando el archivo de empleados');
        }
    },

    importEmployees: async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return ApiResponse.error(res, 'No se ha subido ningun archivo', 400);
            }

            const { user } = req as AuthenticatedRequest;
            const isGlobalAdmin = !user.companyId && user.role === 'admin';

            if (!isGlobalAdmin && !user.companyId) {
                return ApiResponse.error(res, 'No tienes una empresa asignada para importar empleados', 400);
            }

            const importOptions = {
                forceCompanyId: user.companyId || undefined,
                skipCompanyValidation: isGlobalAdmin,
                auditUserId: user.id
            };

            const mapping = parseMapping((req as any).body?.mapping);
            const result = await EmployeeImportService.processFile(req.file.buffer, importOptions, mapping);

            const userId = user.id;
            await AuditService.log('IMPORT', 'EMPLOYEE', 'MULTIPLE', { count: result.importedCount }, userId);

            return ApiResponse.success(res, result, `Importación completada. ${result.importedCount} empleados procesados.`);
        } catch (error: any) {
            log.error({ 
                error: error?.message || String(error), 
                stack: error?.stack,
                name: error?.name 
            }, 'Error importing employees');
            return handleControllerError(res, error, 'Error procesando el archivo de empleados');
        }
    },

downloadTemplate: async (req: Request, res: Response) => {
        try {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Empleados');

            const headers = [
                'DNI / NIE', 'Nombre completo', 'Nombre', 'Apellidos', 'Email',
                'Teléfono principal', 'Teléfono de empresa', 'Dirección', 'Ciudad',
                'Código postal', 'Provincia', 'País', 'Número Seguridad Social', 'IBAN',
                'Género', 'Subcuenta 465', 'Departamento', 'Categoría', 'Puesto',
                'Tipo de contrato', 'Convenio', 'Empadronado / registrado en',
                'Responsable (ID)', 'Tipo de jornada', 'Horas semanales',
                'Fecha de entrada', 'Fecha de nacimiento', 'Caducidad DNI',
                'Fecha de nombramiento', 'Interrupción contrato', 'Fecha baja', 'Motivo baja',
                'Salario bruto mensual', 'Salario bruto anual',
                'Vacaciones anuales', 'Vacaciones arrastradas', 'Vacaciones gastadas',
                'Tiene carnet de conducir', 'Tipo de carnet', 'Caducidad carnet',
                'Notas privadas', 'Nombre contacto emergencia', 'Teléfono contacto emergencia',
                'Relación contacto emergencia', 'Empresa'
            ];

            sheet.addRow(headers);

            // Sample data row with realistic values
            sheet.addRow([
                '12345678A', 'Juan García López', 'Juan', 'García López',
                'juan.garcia@empresa.com', '+34 612 345 678', '+34 912 345 678',
                'Calle Mayor 123, Bajo', 'Madrid', '28001', 'Madrid', 'España',
                '28/1234567890', 'ES9123456789012345678901', 'Hombre', '',
                'IT', 'Desarrollador Senior', 'Backend Developer',
                'Indefinido', 'Oficinas y Despachos', 'Madrid', '', 'Completa', '40',
                '01/03/2024', '15/06/1990', '15/06/2030', '', '', '', '',
                '3500', '49000', '30', '0', '0', 'Sí', 'B', '15/06/2028',
                'Empleado ejemplo', 'María García', '+34 612 987 654', 'Cónyuge',
                'TechLogistics Solutions'
            ]);

            // Sample data row for female employee
            sheet.addRow([
                '87654321B', 'María Fernández Torres', 'María', 'Fernández Torres',
                'maria.fernandez@empresa.com', '+34 623 456 789', '+34 923 456 789',
                'Avenida Gran Vía 45, 3ºA', 'Barcelona', '08001', 'Barcelona', 'España',
                '28/9876543210', 'ES9876543210987654321098', 'Mujer', '',
                'RRHH', 'Directora de Recursos Humanos', 'HR Director',
                'Indefinido', 'Oficinas y Despachos', 'Barcelona', '', 'Completa', '40',
                '15/06/2023', '22/09/1988', '22/09/2030', '', '', '', '',
                '4200', '58800', '30', '5', '2', 'Sí', 'B', '22/09/2027',
                'Ejemplo de empleada', 'Carlos Fernández', '+34 623 987 654', 'Cónyuge',
                'TechLogistics Solutions'
            ]);

            // Style header row
            sheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '366092' } };
                cell.alignment = { horizontal: 'center' };
            });

            // Set column widths
            sheet.columns.forEach((column) => {
                column.width = 20;
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=Plantilla_Importacion_Empleados.xlsx');

            const buffer = await workbook.xlsx.writeBuffer();
            res.send(Buffer.from(buffer));
        } catch (error) {
            log.error({ error }, 'Error generating template');
            return ApiResponse.error(res, 'Error al generar plantilla');
        }
    }
};
