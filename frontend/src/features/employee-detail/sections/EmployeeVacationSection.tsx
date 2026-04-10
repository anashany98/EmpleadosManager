import VacationCalendar from '../../../components/VacationCalendar';

export function EmployeeVacationSection({ employeeId }: { employeeId: string }) {
    return <VacationCalendar employeeId={employeeId} />;
}

