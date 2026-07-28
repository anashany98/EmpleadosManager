import { CompanyDocumentTemplateService } from './DocumentTemplateService';

interface VacationDocumentData {
    employeeId: string;
    vacationId: string;
    startDate: Date;
    endDate: Date;
    days: number;
    type: string;
    reason?: string;
}

const formatDate = (value: Date) => new Date(value).toLocaleDateString('es-ES');

/**
 * Vacation documents use the same editable template catalog as the rest of the
 * application. The vacation id is retained in the render context for future
 * verification layouts and integrations.
 */
export const generateVacationDocument = async (data: VacationDocumentData): Promise<any> =>
    CompanyDocumentTemplateService.generateDocumentFromTemplate({
        employeeId: data.employeeId,
        type: 'VACATION_REQUEST',
        extraContext: {
            vacacion: {
                id: data.vacationId,
                fechaInicio: formatDate(data.startDate),
                fechaFin: formatDate(data.endDate),
                dias: data.days,
                tipo: data.type === 'VACATION' ? 'Vacaciones' : data.type,
                motivo: data.reason || ''
            }
        }
    });
