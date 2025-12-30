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

        // Restore type safety by asserting the result if needed or just handle the property access carefully
        const employeeWithLogs = employee as any;

        const directLogs = await prisma.auditLog.findMany({
            where: { entity: 'EMPLOYEE', entityId: employeeId },
            include: { user: true }
        });

        const events: TimelineEvent[] = [];

        // 0. Audit Logs (Combined)
        // Fetch logs where the employee is the "target" (e.g. they were updated by someone else)
        // We do this separately to avoid issues if the Prisma Client types are out of sync
        const targetLogs = await prisma.auditLog.findMany({
            where: { targetEmployeeId: employeeId } as any,
            include: { user: true }
        });

        const allLogs = [...targetLogs, ...directLogs];
        // Remove duplicates if any (though usually disjoint sets unless self-referencing)
        const uniqueLogs = Array.from(new Map(allLogs.map(item => [item.id, item])).values());

        uniqueLogs.forEach(log => {
            let title = log.action;
            let description = '';

            try {
                const meta = log.metadata ? JSON.parse(log.metadata) : {};
                description = meta.info || meta.message || JSON.stringify(meta);

                // Humanize titles
                if (log.action === 'UPDATE') title = 'Actualización de Perfil';
                if (log.action === 'CREATE') title = 'Creación';
                if (log.action === 'DELETE') title = 'Eliminación';
                if (log.action.startsWith('BULK')) title = 'Acción Masiva: ' + log.action.replace('BULK_', '');
                if (log.action === 'GENERATE_DOCUMENT') title = 'Documento Generado';
                if (log.action === 'VIEW_SENSITIVE_DATA') title = 'Acceso a Datos Sensibles';

            } catch (e) {
                description = 'Sin detalles';
            }

            events.push({
                id: log.id,
                date: log.createdAt,
                type: 'INCIDENT', // Use INCIDENT generic type or map specifically
                title: title,
                description: `${description} (Por: ${(log as any).user?.email || 'Sistema'})`,
                category: 'AUDIT'
            });
        });

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
