import { useAuth } from '../contexts/AuthContext';
import DocumentArchive from '../components/DocumentArchive';
import { FileText } from 'lucide-react';

export default function MyDocumentsPage() {
    const { user } = useAuth();

    if (!user || !user.employeeId) {
        return (
            <div className="p-8 text-center text-slate-500">
                No tienes un perfil de empleado asociado. Contacta con RRHH.
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <FileText className="text-blue-600" size={32} />
                    Mis Documentos
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Gestiona tu expediente, sube justificantes y consulta tus nóminas.
                </p>
            </div>

            <div className="bg-white dark:bg-slate-950 rounded-[32px] border border-slate-100 dark:border-slate-900 shadow-xl p-6">
                <DocumentArchive employeeId={user.employeeId} />
            </div>
        </div>
    );
}
