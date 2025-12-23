import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, User, Building2, CreditCard, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';

export default function EmployeeList() {
    const [employees, setEmployees] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Mock data for initial visual feedback
        setEmployees([
            { id: '1', name: 'Juan Pérez', dni: '12345678A', subaccount465: '465.1.0001', department: 'Ventas', active: true },
            { id: '2', name: 'María López', dni: '87654321B', subaccount465: '465.1.0002', department: 'IT', active: true },
            { id: '3', name: 'Carlos Ruiz', dni: '11223344C', subaccount465: '465.1.0003', department: 'Marketing', active: false },
        ]);

        api.get('/employees')
            .then(data => { if (data.length > 0) setEmployees(data) })
            .catch(err => console.log('Backend not connected, using mock data ' + err));
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Empleados</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Gestiona el maestro de empleados y sus cuentas contables</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={async () => {
                            try {
                                const response = await api.get('/employees/template', { responseType: 'blob' });
                                const url = window.URL.createObjectURL(new Blob([response]));
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute('download', 'plantilla_empleados.xlsx');
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                            } catch (err) {
                                toast.error('Error al descargar la plantilla');
                            }
                        }}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-3 rounded-xl font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-all"
                    >
                        <FileSpreadsheet size={20} className="text-green-600 dark:text-green-400" />
                        Plantilla
                    </button>

                    <div className="relative">
                        <input
                            type="file"
                            id="import-employees"
                            className="hidden"
                            accept=".xlsx, .xls, .csv"
                            onChange={async (e) => {
                                if (e.target.files && e.target.files[0]) {
                                    const formData = new FormData();
                                    formData.append('file', e.target.files[0]);
                                    const toastId = toast.loading('Importando empleados...');
                                    try {
                                        const res = await api.post('/employees/import', formData);
                                        toast.success(res.message, { id: toastId });
                                        // Recargar datos sin reload completo si es posible, pero por ahora reload() es seguro
                                        setTimeout(() => window.location.reload(), 1500);
                                    } catch (err) {
                                        toast.error('Error en la importación', { id: toastId });
                                    }
                                }
                            }}
                        />
                        <label htmlFor="import-employees" className="cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-3 rounded-xl font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-all">
                            <Upload size={20} className="text-blue-600 dark:text-blue-400" />
                            Importar Excel/CSV
                        </label>
                    </div>

                    <Link to="/employees/new" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 flex items-center gap-2 transition-all hover:scale-105 active:scale-95">
                        <Plus size={20} />
                        Nuevo Empleado
                    </Link>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
                {/* Filters */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o DNI..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow placeholder:text-slate-400"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium">
                            <tr>
                                <th className="px-6 py-4 w-16"></th>
                                <th className="px-6 py-4">Nombre Completo</th>
                                <th className="px-6 py-4">DNI / NIE</th>
                                <th className="px-6 py-4">Subcuenta 465</th>
                                <th className="px-6 py-4">Departamento</th>
                                <th className="px-6 py-4 text-right">Estado</th>
                                <th className="px-6 py-4 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {employees.map((emp) => (
                                <tr key={emp.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shadow-inner">
                                            {emp.name.charAt(0)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-slate-900 dark:text-white">
                                            <Link to={`/employees/${emp.id}`} className="hover:text-blue-600 transition-colors">
                                                {emp.name}
                                            </Link>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{emp.dni}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md w-fit font-mono text-xs">
                                            <CreditCard size={12} className="text-slate-400" />
                                            {emp.subaccount465}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                            <Building2 size={14} className="text-slate-400" />
                                            {emp.department || 'General'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${emp.active
                                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-400'
                                            : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${emp.active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                            {emp.active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                            <MoreHorizontal size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {employees.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400 dark:text-slate-600">
                                        <User size={48} className="mx-auto mb-4 opacity-20" />
                                        <p className="text-lg font-medium text-slate-900 dark:text-white">No se encontraron empleados</p>
                                        <p className="text-sm">Agrega uno nuevo para comenzar</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
