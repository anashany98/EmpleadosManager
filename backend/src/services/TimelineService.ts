import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export interface TimelineEvent {
    id: string;
    date: Date;
    type: 'ENTRY' | 'EXIT' | 'CONTRACT' | 'PAYROLL' | 'MEDICAL' | 'VACATION' | 'TRAINING' | 'EXPENSE' | 'INCIDENT';
    title: string;
    description?: string | null;
    status?: string | null;
    category?: string | null;
    amount?: number | null;
    fileUrl?: string | null;
    endDate?: Date | null; // Para periodos
}

export const TimelineService = {
    /**
     * Obtiene todos los eventos de la vida laboral de un empleado de forma cronológica
     */
    async getEmployeeTimeline(employeeId: string): Promise<TimelineEvent[]> {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: {
                contractExtensions: true,
                vacations: true,
                medicalReviews: true,
                trainings: true,
                expenses: true,
                payrollRows: {
                    include: { batch: true }
                }
            }
        });

        if (!employee) {
            throw new AppError('Empleado no encontrado', 404);
        }

        const events: TimelineEvent[] = [];

        // 1. Alta (Entry Date)
        if (employee.entryDate) {
            events.push({
                id: `entry-${employee.id}`,
                date: employee.entryDate,
                type: 'ENTRY',
                title: 'Alta en la empresa',
                description: `Inicio de contrato como ${employee.jobTitle || 'Empleado'}`
            });
        }

        // 2. Baja (Exit Date)
        if (employee.exitDate) {
            events.push({
                id: `exit-${employee.id}`,
                date: employee.exitDate,
                type: 'EXIT',
                title: 'Baja en la empresa',
                description: `Fin de la relación laboral. Motivo: ${employee.lowReason || 'No especificado'}`
            });
        }

        // 3. Prórrogas de Contratos
        employee.contractExtensions.forEach(ext => {
            events.push({
                id: ext.id,
                date: ext.extensionDate,
                type: 'CONTRACT',
                title: 'Prórroga de Contrato',
                description: `Nueva fecha fin: ${ext.newEndDate.toLocaleDateString()}. ${ext.notes || ''}`,
                fileUrl: ext.fileUrl
            });
        });

        // 4. Vacaciones y Ausencias (como periodos)
        employee.vacations.forEach(vac => {
            events.push({
                id: vac.id,
                date: vac.startDate,
                endDate: vac.endDate,
                type: 'VACATION',
                title: vac.type === 'VACATION' ? 'Vacaciones' : 'Ausencia / Baja Médica',
                description: `${vac.days} días. ${vac.reason || ''}`,
                status: vac.status,
                category: vac.type
            });
        });

        // 5. Nóminas
        employee.payrollRows.forEach(row => {
            events.push({
                id: row.id,
                date: new Date(row.batch.year, row.batch.month - 1, 1),
                type: 'PAYROLL',
                title: `Nómina ${row.batch.month}/${row.batch.year}`,
                description: `Bruto: ${row.bruto}€ | Neto: ${row.neto}€`,
                amount: Number(row.neto)
            });
        });

        // 6. Revisiones Médicas
        employee.medicalReviews.forEach(rev => {
            events.push({
                id: rev.id,
                date: rev.date,
                type: 'MEDICAL',
                title: 'Revisión Médica',
                description: `Resultado: ${rev.result || 'Pendiente'}`,
                fileUrl: rev.fileUrl
            });
        });

        // 7. Formaciones
        employee.trainings.forEach(tr => {
            events.push({
                id: tr.id,
                date: tr.date,
                type: 'TRAINING',
                title: `Formación: ${tr.name}`,
                description: `${tr.type} | ${tr.hours || 0} horas`,
                fileUrl: tr.fileUrl
            });
        });

        // 8. Gastos
        employee.expenses.forEach(exp => {
            events.push({
                id: exp.id,
                date: exp.date,
                type: 'EXPENSE',
                title: `Gasto: ${exp.category}`,
                description: exp.description || '',
                amount: exp.amount,
                status: exp.status,
                fileUrl: exp.receiptUrl
            });
        });

        // Ordenar cronológicamente (más reciente primero)
        return events.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
};
