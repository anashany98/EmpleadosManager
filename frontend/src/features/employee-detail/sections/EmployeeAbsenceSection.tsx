import { EmployeeVacationWorkspace } from '../../self-service/vacations/EmployeeVacationWorkspace';

interface EmployeeAbsenceSectionProps {
    employeeId: string;
}

/**
 * Sección de "Ausencias" de la ficha de empleado.
 *
 * Reutiliza `EmployeeVacationWorkspace` en modo `absence`: misma UI
 * funcional que la pestaña de Vacaciones, pero filtrada a todo lo que
 * NO sea `VACATION` (bajas, maternidad, paternidad, citas médicas,
 * permisos sin goce, función pública, etc.).
 *
 * No incluye la tarjeta de balance anual porque ese dato es
 * específico de vacaciones y se sigue mostrando en la pestaña
 * "Vacaciones".
 */
export function EmployeeAbsenceSection({ employeeId }: EmployeeAbsenceSectionProps) {
    return <EmployeeVacationWorkspace employeeId={employeeId} mode="absence" />;
}
