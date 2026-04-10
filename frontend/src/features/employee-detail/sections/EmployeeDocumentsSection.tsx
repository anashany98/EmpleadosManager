import DocumentArchive from '../../../components/DocumentArchive';
import DocumentGenerator from '../../../components/DocumentGenerator';
import PRLArchive from '../../../components/PRLArchive';

interface EmployeeDocumentsSectionProps {
    activeTab: string;
    employeeId: string;
    onDocumentGenerated: () => void;
}

export function EmployeeDocumentsSection({ activeTab, employeeId, onDocumentGenerated }: EmployeeDocumentsSectionProps) {
    if (activeTab === 'generar') {
        return <DocumentGenerator employeeId={employeeId} onDocumentGenerated={onDocumentGenerated} />;
    }

    if (activeTab === 'expediente') {
        return <DocumentArchive employeeId={employeeId} />;
    }

    if (activeTab === 'prl') {
        return <PRLArchive employeeId={employeeId} />;
    }

    return null;
}

