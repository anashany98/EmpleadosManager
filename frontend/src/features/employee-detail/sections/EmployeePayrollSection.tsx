import EmployeePayrollViewer from '../../../components/employee/EmployeePayrollViewer';

export function EmployeePayrollSection({ employeeId }: { employeeId: string }) {
    return <EmployeePayrollViewer employeeId={employeeId} />;
}

