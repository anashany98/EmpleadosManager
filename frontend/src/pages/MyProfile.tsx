import { useAuth } from '../contexts/AuthContext';
import EmployeeDetail from './EmployeeDetail';
import { Navigate } from 'react-router-dom';

export default function MyProfile() {
    const { user } = useAuth();

    if (!user || !user.employeeId) {
        return <div className="p-8 text-center text-slate-500">No tienes un perfil de empleado asociado.</div>;
    }

    // Reuse EmployeeDetail passing the ID explicitly
    return <EmployeeDetail employeeId={user.employeeId} />;
}
