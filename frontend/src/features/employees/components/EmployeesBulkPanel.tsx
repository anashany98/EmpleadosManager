import BulkActionToolbar, { EMPLOYEE_BULK_ACTIONS } from '../../../components/BulkActionToolbar';

interface EmployeesBulkPanelProps {
    selectedCount: number;
    totalCount: number;
    onClearSelection: () => void;
    onAction: (actionId: string) => void;
}

export function EmployeesBulkPanel(props: EmployeesBulkPanelProps) {
    return (
        <BulkActionToolbar
            selectedCount={props.selectedCount}
            totalCount={props.totalCount}
            onClearSelection={props.onClearSelection}
            onAction={props.onAction}
            actions={EMPLOYEE_BULK_ACTIONS}
            entityName="empleados"
        />
    );
}
