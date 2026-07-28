import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

const EMPLOYEE_TIMELINE_AUDIT_ACTIONS = new Set([
    'CREATE',
    'UPDATE',
    'DELETE',
    'IMPORT',
    'PRIVATE_NOTE_UPDATE',
    'VACATION_BALANCE_UPDATE',
    'OFFBOARD_EMPLOYEE',
    'REACTIVATE_EMPLOYEE',
    'DATA_CREATE',
    'DATA_UPDATE',
    'DATA_DELETE'
]);

const FIELD_LABELS: Record<string, string> = {
    firstName: 'nombre',
    lastName: 'apellidos',
    email: 'correo',
    phone: 'teléfono',
    address: 'dirección',
    city: 'municipio',
    postalCode: 'código postal',
    department: 'departamento',
    category: 'categoría',
    contractType: 'tipo de contrato',
    agreementType: 'convenio',
    jobTitle: 'puesto',
    province: 'provincia',
    registeredIn: 'empadronamiento',
    drivingLicenseType: 'permiso de conducir',
    payrollAgencyEmployeeCode: 'código de gestoría',
    subaccount465: 'subcuenta 465'
};

function humanizeAuditMetadata(meta: Record<string, unknown>): string {
    if (typeof meta.info === 'string' && meta.info.trim()) return meta.info;
    if (typeof meta.message === 'string' && meta.message.trim()) return meta.message;
    const rawFields = Array.isArray(meta.fields)
        ? meta.fields
        : meta.fields && typeof meta.fields === 'object'
            ? Object.keys(meta.fields as Record<string, unknown>)
            : [];
    if (rawFields.length > 0) {
        const labels = rawFields.map((field) => FIELD_LABELS[String(field)] || String(field));
        const visible = labels.slice(0, 6).join(', ');
        const remaining = labels.length - 6;
        return `Campos modificados: ${visible}${remaining > 0 ? ` y ${remaining} más` : ''}.`;
    }
    if (typeof meta.reason === 'string' && meta.reason.trim()) return `Motivo: ${meta.reason}.`;
    return 'Cambio administrativo registrado.';
}

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
                obraExpenses: {
                    include: {
                        obra: { select: { code: true, name: true } }
                    }
                },
                payrollRows: {
                    include: { batch: true }
                },
                employmentPeriods: { orderBy: { startDate: 'asc' } }
            }
        });

        if (!employee) {
            throw new AppError('Empleado no encontrado', 404);
        }

        const directLogs = await prisma.auditLog.findMany({
            where: { entity: 'EMPLOYEE', entityId: employeeId },
            include: { user: true }
        });

        const events: TimelineEvent[] = [];
        const configuredAbsenceTypes = await prisma.absenceTypeConfig.findMany({
            select: { code: true, name: true }
        });
        const absenceLabels = new Map(configuredAbsenceTypes.map((item) => [item.code, item.name]));

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

        uniqueLogs
            .filter(log => EMPLOYEE_TIMELINE_AUDIT_ACTIONS.has(log.action))
            .filter(log => employee.employmentPeriods.length === 0 || !['OFFBOARD_EMPLOYEE', 'REACTIVATE_EMPLOYEE'].includes(log.action))
            .forEach(log => {
                let title = log.action;
                let description: string;
                let lifecycleType: TimelineEvent['type'] = 'INCIDENT';
                let eventDate = log.createdAt;

                try {
                    const meta = log.metadata ? JSON.parse(log.metadata) : {};
                    description = humanizeAuditMetadata(meta);

                    // Humanize titles
                    if (log.action === 'UPDATE' || log.action === 'DATA_UPDATE') title = 'Modificación de ficha';
                    if (log.action === 'CREATE' || log.action === 'DATA_CREATE') title = 'Alta de ficha';
                    if (log.action === 'DELETE' || log.action === 'DATA_DELETE') title = 'Eliminación de ficha';
                    if (log.action === 'IMPORT') title = 'Importación de ficha';
                    if (log.action === 'PRIVATE_NOTE_UPDATE') title = 'Actualización de nota RRHH';
                    if (log.action === 'VACATION_BALANCE_UPDATE') title = 'Ajuste de vacaciones';
                    if (log.action.startsWith('BULK')) title = 'Acción Masiva: ' + log.action.replace('BULK_', '');
                    if (log.action === 'GENERATE_DOCUMENT') title = 'Documento Generado';
                    if (log.action === 'OFFBOARD_EMPLOYEE') {
                        title = 'Baja en la empresa';
                        lifecycleType = 'EXIT';
                        if (meta.exitDate) eventDate = new Date(meta.exitDate);
                        description = `Fin de la relación laboral. Motivo: ${meta.reason || 'No especificado'}`;
                    }
                    if (log.action === 'REACTIVATE_EMPLOYEE') {
                        title = 'Reactivación del empleado';
                        lifecycleType = 'ENTRY';
                        if (meta.reactivationDate) eventDate = new Date(meta.reactivationDate);
                        description = `Empleado reactivado. Motivo: ${meta.reason || 'No especificado'}`;
                    }

                } catch {
                    description = 'Sin detalles';
                }

                events.push({
                    id: log.id,
                    date: eventDate,
                    type: lifecycleType,
                    title,
                    description: `${description} (Por: ${(log as any).user?.email || 'Sistema'})`,
                    category: 'AUDIT'
                });
            });

        // 1. Periodos laborales (fuente histórica; la ficha solo refleja el estado actual)
        employee.employmentPeriods.forEach((period, index) => {
            events.push({
                id: `employment-entry-${period.id}`,
                date: period.startDate,
                type: 'ENTRY',
                title: index === 0 ? 'Alta en la empresa' : 'Reactivación del empleado',
                description: period.startReason || `Inicio de relación laboral como ${employee.jobTitle || 'Empleado'}`
            });
            if (period.endDate) {
                events.push({
                    id: `employment-exit-${period.id}`,
                    date: period.endDate,
                    type: 'EXIT',
                    title: 'Baja en la empresa',
                    description: `Fin de la relación laboral. Motivo: ${period.endReason || 'No especificado'}`
                });
            }
        });

        // Compatibilidad con empleados aún no migrados (por ejemplo, sin empresa).
        if (employee.employmentPeriods.length === 0 && employee.entryDate) {
            events.push({
                id: `entry-${employee.id}`,
                date: employee.entryDate,
                type: 'ENTRY',
                title: 'Alta en la empresa',
                description: `Inicio de contrato como ${employee.jobTitle || 'Empleado'}`
            });
        }
        if (employee.employmentPeriods.length === 0 && employee.exitDate && !uniqueLogs.some((log) => log.action === 'OFFBOARD_EMPLOYEE')) {
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
                fileUrl: null
            });
        });

        // 4. Vacaciones y Ausencias (como periodos)
        employee.vacations.forEach(vac => {
            // Map vacation types to readable titles
            const typeTitles: Record<string, string> = {
                'VACATION': 'Vacaciones',
                'SICK': 'Baja Médica',
                'SICK_LEAVE': 'Baja Médica',
                'BAJA_MEDICA': 'Baja Médica',
                'MATERNITY': 'Maternidad',
                'MATERNIDAD': 'Maternidad',
                'PATERNITY': 'Paternidad',
                'PATERNIDAD': 'Paternidad',
                'BIRTH': 'Nacimiento',
                'MEDICAL_HOURS': 'Horas Médicas',
                'LACTANCIA': 'Lactancia',
                'PERSONAL': 'Personal',
                'PERSONAL_DAY': 'Día Personal',
                'OTHER': 'Otro',
                'OTROS': 'Otro',
                'UNPAID': 'Sin Goce',
                'TELETRABAJO': 'Teletrabajo',
                'PERMISO_SINDICAL': 'Permiso Sindical'
            };
            
            const title = absenceLabels.get(vac.type || 'VACATION') || typeTitles[vac.type || 'VACATION'] || 'Ausencia';
            
            events.push({
                id: vac.id,
                date: vac.startDate,
                endDate: vac.endDate,
                type: 'VACATION',
                title,
                description: `${vac.days} días. ${vac.reason || ''}`,
                status: vac.status,
                category: vac.type
            });
        });

        // 5. Nóminas
        employee.payrollRows.forEach(row => {
            const gross = Number(row.bruto).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            const net = Number(row.neto).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            events.push({
                id: row.id,
                date: new Date(row.batch.year, row.batch.month - 1, 1),
                type: 'PAYROLL',
                title: `Nómina ${row.batch.month}/${row.batch.year}`,
                description: `Bruto: ${gross} · Neto: ${net}`,
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
                fileUrl: null
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
                fileUrl: null
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
                // Prisma returns `Prisma.Decimal` for `Decimal` columns;
                // the public TimelineEvent shape uses JS numbers, so we
                // coerce here. `expense.amount` is non-null in the schema.
                amount: exp.amount ? exp.amount.toNumber() : null,
                status: exp.status,
                fileUrl: exp.receiptUrl ? `/api/expenses/${exp.id}/receipt` : null
            });
        });

        employee.obraExpenses.forEach(expense => {
            const categoryLabels: Record<string, string> = {
                PER_DIEM: 'Dieta',
                LODGING: 'Hospedaje',
                FLIGHT: 'Vuelo',
                TRANSPORT: 'Transporte',
                CAR_RENTAL: 'Alquiler de coche',
                OTHER: 'Otro gasto'
            };
            events.push({
                id: `obra-expense-${expense.id}`,
                date: expense.date,
                endDate: expense.endDate,
                type: 'EXPENSE',
                title: categoryLabels[expense.type] || 'Gasto de obra',
                description: `${expense.obra.code} - ${expense.obra.name}${expense.description ? ` · ${expense.description}` : ''}`,
                amount: Number(expense.amount),
                status: expense.status,
                category: expense.type
            });
        });

        // Ordenar cronológicamente (más reciente primero)
        return events.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
};
