import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Search, Camera, X, UserCheck, LogOut, Loader2 } from 'lucide-react';
import { FaceEnrollModal } from './FaceEnrollModal';
import { toast } from 'sonner';

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    dni: string;
    faceDescriptor?: any;
    department?: string;
    jobTitle?: string;
}

interface KioskAdminPanelProps {
    onClose: () => void;
}

export const KioskAdminPanel: React.FC<KioskAdminPanelProps> = ({ onClose }) => {
    // Auth State
    const [token, setToken] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Dashboard State
    const [search, setSearch] = useState('');
    const [employees, setEmployees] = useState<Employee[]>([]);
    // filteredEmployees is no longer needed since we fetch filtered data directly
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [showEnrollModal, setShowEnrollModal] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/auth/login', { email, password });
            if (res.data.user.role !== 'admin' && res.data.user.role !== 'manager') {
                toast.error('Acceso denegado. Solo administradores.');
                return;
            }
            setToken(res.data.token);
            fetchEmployees(res.data.token);
            toast.success('Sesión de administración iniciada');
        } catch (error) {
            toast.error('Credenciales incorrectas');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async (authToken: string, searchTerm: string = '') => {
        try {
            // Manually passing token as we might be in Kiosk context without global auth context
            const params = searchTerm ? { search: searchTerm } : {};
            const res = await api.get('/employees', {
                headers: { Authorization: `Bearer ${authToken}` },
                params
            });
            // If pagination is used, data might be in res.data.data
            const data = Array.isArray(res.data) ? res.data : res.data.data || [];
            setEmployees(data);
        } catch (error) {
            console.error(error);
            toast.error('Error cargando empleados');
        }
    };

    // Debounce Search
    useEffect(() => {
        if (!token) return;
        const timer = setTimeout(() => {
            fetchEmployees(token, search);
        }, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [search, token]);

    const handleEnrollClick = (employee: Employee) => {
        setSelectedEmployee(employee);
        setShowEnrollModal(true);
    };

    if (!token) {
        return (
            <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-md p-8 rounded-2xl shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Kiosco</h2>
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-slate-300">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full p-3 rounded-xl border dark:bg-slate-700 dark:border-slate-600"
                                placeholder="admin@empresa.com"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-slate-300">Contraseña</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full p-3 rounded-xl border dark:bg-slate-700 dark:border-slate-600"
                                required
                            />
                        </div>
                        <button
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition flex justify-center"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Entrar'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-900 flex flex-col animate-in slide-in-from-bottom">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 p-4 shadow-md flex justify-between items-center z-10">
                <h2 className="text-xl font-bold dark:text-white">Modo Gestión Kiosco</h2>
                <button
                    onClick={onClose}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 transition dark:text-white"
                >
                    <LogOut size={18} /> Salir
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col p-4 max-w-4xl mx-auto w-full">
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-3.5 text-slate-400" size={20} />
                    <input
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 shadow-sm"
                        placeholder="Buscar empleado por nombre o DNI..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pb-20">
                    {employees.map(emp => (
                        <div key={emp.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-lg dark:text-white">{emp.firstName} {emp.lastName}</h3>
                                <div className="text-sm text-slate-500 flex gap-3">
                                    <span>MyDNI: {emp.dni}</span>
                                    <span>{emp.department}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => handleEnrollClick(emp)}
                                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition ${emp.faceDescriptor
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                                    }`}
                            >
                                {emp.faceDescriptor ? <UserCheck size={18} /> : <Camera size={18} />}
                                {emp.faceDescriptor ? 'Actualizar' : 'Registrar'}
                            </button>
                        </div>
                    ))}
                    {employees.length === 0 && (
                        <div className="text-center text-slate-500 mt-10">
                            No se encontraron empleados.
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {selectedEmployee && (
                <FaceEnrollModal
                    isOpen={showEnrollModal}
                    onClose={() => {
                        setShowEnrollModal(false);
                        setSelectedEmployee(null);
                    }}
                    employeeId={selectedEmployee.id}
                    employeeName={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
                    onSuccess={() => {
                        fetchEmployees(token); // Refresh list to show green state
                        toast.success('Biometría guardada');
                    }}
                />
            )}
        </div>
    );
};
