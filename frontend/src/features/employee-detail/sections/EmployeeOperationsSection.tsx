import EmployeeAssets from '../../../components/employee/EmployeeAssets';
import EmployeeChecklist from '../../../components/employee/EmployeeChecklist';
import EmployeeProjects from '../../../components/employee/EmployeeProjects';

export function EmployeeOperationsSection({ activeTab, employeeId }: { activeTab: string; employeeId: string }) {
    if (activeTab === 'obras') {
        return <EmployeeProjects employeeId={employeeId} />;
    }

    if (activeTab === 'activos') {
        return <EmployeeAssets employeeId={employeeId} />;
    }

    if (activeTab === 'checklists') {
        return <EmployeeChecklist employeeId={employeeId} />;
    }

    return null;
}

