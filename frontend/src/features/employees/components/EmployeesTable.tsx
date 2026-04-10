import { Building2, CreditCard, MessageCircle, MoreHorizontal, Plus, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Employee } from '../types';

interface EmployeesTableProps {
    employees: Employee[];
    isLoading: boolean;
    selectedIds: string[];
    totalEmployees: number;
    searchTerm: string;
    activeFilterCount: number;
    onSelectAll: (checked: boolean) => void;
    onSelectOne: (employeeId: string) => void;
}

export function EmployeesTable(props: EmployeesTableProps) {
    return (
        <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm" role="grid">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium">
                    <tr>
                        <th className="px-6 py-4 w-12" scope="col">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                    onChange={(event) => props.onSelectAll(event.target.checked)}
                                    checked={props.employees.length > 0 && props.selectedIds.length === props.employees.length}
                                    aria-label="Seleccionar todos los empleados"
                                />
                            </label>
                        </th>
                        <th className="px-6 py-4 w-16" scope="col"></th>
                        <th className="px-6 py-4" scope="col">Nombre Completo</th>
                        <th className="px-6 py-4" scope="col">DNI / NIE</th>
                        <th className="px-6 py-4" scope="col">Subcuenta 465</th>
                        <th className="px-6 py-4" scope="col">Departamento</th>
                        <th className="px-6 py-4 text-right" scope="col">Estado</th>
                        <th className="px-6 py-4 w-12" scope="col"><span className="sr-only">Acciones</span></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {props.isLoading ? (
                        Array.from({ length: 5 }).map((_, index) => (
                            <tr key={index} className="animate-pulse" aria-hidden="true">
                                <td className="px-6 py-4"><div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700"></div></td>
                                <td className="px-6 py-4"><div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700"></div></td>
                                <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                                <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                                <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                                <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                                <td className="px-6 py-4 text-right"><div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-full inline-block"></div></td>
                                <td className="px-6 py-4"></td>
                            </tr>
                        ))
                    ) : (
                        props.employees.map((employee) => (
                            <tr key={employee.id} className={`group transition-colors ${props.selectedIds.includes(employee.id) ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                <td className="px-6 py-4">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                            checked={props.selectedIds.includes(employee.id)}
                                            onChange={() => props.onSelectOne(employee.id)}
                                            aria-label={`Seleccionar ${employee.name || `${employee.firstName} ${employee.lastName}`}`}
                                        />
                                    </label>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shadow-inner">
                                        {(employee.name || employee.firstName || '?').charAt(0)}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="font-semibold text-slate-900 dark:text-white">
                                            <Link to={`/employees/${employee.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:underline">
                                                {employee.name || `${employee.firstName} ${employee.lastName}`}
                                            </Link>
                                        </div>
                                        {employee.phone && (
                                            <a
                                                href={`https://api.whatsapp.com/send?phone=${employee.phone.replace(/\D/g, '').startsWith('34') ? '' : '34'}${employee.phone.replace(/\D/g, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all hover:scale-110 active:scale-90 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                                                title={`Contactar por WhatsApp a ${employee.phone}`}
                                                onClick={(event) => event.stopPropagation()}
                                                aria-label={`Contactar por WhatsApp a ${employee.name || `${employee.firstName} ${employee.lastName}`}`}
                                            >
                                                <MessageCircle size={12} aria-hidden="true" />
                                            </a>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{employee.dni}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md w-fit font-mono text-xs">
                                        <CreditCard size={12} className="text-slate-400" aria-hidden="true" />
                                        {employee.subaccount465}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <Building2 size={14} className="text-slate-400" aria-hidden="true" />
                                        {employee.department || 'General'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${employee.active ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${employee.active ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true"></span>
                                        {employee.active ? 'Activo' : 'Inactivo'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Link to={`/employees/${employee.id}`} className="inline-block text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={`Ver detalles de ${employee.name || `${employee.firstName} ${employee.lastName}`}`}>
                                        <MoreHorizontal size={20} aria-hidden="true" />
                                    </Link>
                                </td>
                            </tr>
                        ))
                    )}

                    {!props.isLoading && props.employees.length === 0 && (
                        <tr>
                            <td colSpan={8} className="px-6 py-16 text-center">
                                <div className="max-w-sm mx-auto">
                                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <User size={32} className="text-slate-400 dark:text-slate-500" aria-hidden="true" />
                                    </div>
                                    <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">No se encontraron empleados</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                        {props.searchTerm || props.activeFilterCount > 0 ? 'Intenta ajustar los filtros de búsqueda' : 'Agrega un nuevo empleado para comenzar'}
                                    </p>
                                    {!props.searchTerm && props.activeFilterCount === 0 && (
                                        <Link to="/employees/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                                            <Plus size={16} />
                                            Agregar empleado
                                        </Link>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
