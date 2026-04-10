import { TimesheetViewer } from '../../../components/TimesheetViewer';
import EmployeeTimeline from '../../../components/employee/EmployeeTimeline';

export function EmployeeAttendanceSection({ activeTab, employeeId }: { activeTab: string; employeeId: string }) {
    if (activeTab === 'cronograma') {
        return <EmployeeTimeline employeeId={employeeId} />;
    }

    if (activeTab === 'fichajes') {
        return <TimesheetViewer employeeId={employeeId} />;
    }

    return null;
}

