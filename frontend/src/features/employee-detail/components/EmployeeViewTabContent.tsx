import { EmployeeAbsenceSection } from '../sections/EmployeeAbsenceSection';
import { EmployeeAdministrationSection } from '../sections/EmployeeAdministrationSection';
import { EmployeeAttendanceSection } from '../sections/EmployeeAttendanceSection';
import { EmployeeDocumentsSection } from '../sections/EmployeeDocumentsSection';
import { EmployeeOperationsSection } from '../sections/EmployeeOperationsSection';
import { EmployeePayrollSection } from '../sections/EmployeePayrollSection';
import { EmployeeSummarySection } from '../sections/EmployeeSummarySection';
import { EmployeeVacationSection } from '../sections/EmployeeVacationSection';
import type { EmployeeVacationBalanceSummary, EmployeeViewRecord } from '../types';

interface EmployeeViewTabContentProps {
    activeTab: string;
    employeeId: string;
    employeeView: EmployeeViewRecord;
    onVacationBalanceChange: (vacationBalance: EmployeeVacationBalanceSummary) => void;
    onNavigateToVacations: () => void;
    privateNotes: string;
    saving: boolean;
    onPrivateNotesChange: (value: string) => void;
    onPrivateNotesSave: () => Promise<void>;
    onDocumentGenerated: () => void;
}

export function EmployeeViewTabContent(props: EmployeeViewTabContentProps) {
    const employeeName = `${props.employeeView.firstName || ''} ${props.employeeView.lastName || ''}`.trim();

    if (props.activeTab === 'resumen') {
        return (
            <EmployeeSummarySection
                employeeId={props.employeeId}
                employeeView={props.employeeView}
                onNavigateToVacations={props.onNavigateToVacations}
            />
        );
    }
    if (['generar', 'expediente', 'prl'].includes(props.activeTab)) {
        return <EmployeeDocumentsSection activeTab={props.activeTab} employeeId={props.employeeId} onDocumentGenerated={props.onDocumentGenerated} />;
    }
    if (['cronograma', 'fichajes'].includes(props.activeTab)) {
        return <EmployeeAttendanceSection activeTab={props.activeTab} employeeId={props.employeeId} />;
    }
    if (['obras', 'activos', 'checklists'].includes(props.activeTab)) {
        return <EmployeeOperationsSection activeTab={props.activeTab} employeeId={props.employeeId} />;
    }
    if (props.activeTab === 'nominas') {
        return <EmployeePayrollSection employeeId={props.employeeId} />;
    }
    if (props.activeTab === 'vacaciones') {
        return <EmployeeVacationSection employeeId={props.employeeId} employeeView={props.employeeView} onVacationBalanceChange={props.onVacationBalanceChange} />;
    }
    if (props.activeTab === 'ausencias') {
        return <EmployeeAbsenceSection employeeId={props.employeeId} />;
    }
    if (['seguridad', 'privacidad', 'notas-rrhh'].includes(props.activeTab)) {
        return (
            <EmployeeAdministrationSection
                activeTab={props.activeTab}
                employeeId={props.employeeId}
                employeeName={employeeName}
                privateNotes={props.privateNotes}
                saving={props.saving}
                onPrivateNotesChange={props.onPrivateNotesChange}
                onPrivateNotesSave={props.onPrivateNotesSave}
            />
        );
    }
    return null;
}
