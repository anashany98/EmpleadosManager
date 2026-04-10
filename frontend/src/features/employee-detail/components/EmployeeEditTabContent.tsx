import { EmployeePersonalSection } from '../forms/EmployeePersonalSection';
import { EmployeeSecondarySections } from '../forms/EmployeeSecondarySections';
import type { CompanyOption, EmployeeFormData, EmployeeOption, NewEmergencyContact } from '../types';

interface EmployeeEditTabContentProps {
    activeTab: string;
    isNew: boolean;
    employeeId: string;
    formData: EmployeeFormData;
    companies: CompanyOption[];
    allEmployees: EmployeeOption[];
    newContact: NewEmergencyContact;
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    setFormData: React.Dispatch<React.SetStateAction<EmployeeFormData>>;
    setNewContact: React.Dispatch<React.SetStateAction<NewEmergencyContact>>;
}

export function EmployeeEditTabContent(props: EmployeeEditTabContentProps) {
    if (props.activeTab === 'personal') {
        return (
            <EmployeePersonalSection
                formData={props.formData}
                newContact={props.newContact}
                onChange={props.onChange}
                setFormData={props.setFormData}
                setNewContact={props.setNewContact}
            />
        );
    }

    return (
        <EmployeeSecondarySections
            activeTab={props.activeTab}
            isNew={props.isNew}
            employeeId={props.employeeId}
            formData={props.formData}
            companies={props.companies}
            allEmployees={props.allEmployees}
            onChange={props.onChange}
        />
    );
}
