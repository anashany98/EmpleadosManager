import { Building2, MessageCircle, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Employee } from '../types';
import { getEmployeeDisplayName, getEmployeeInitials } from '../../../utils/employeeDisplay';

interface EmployeesMobileListProps {
    employees: Employee[];
    isLoading: boolean;
    searchTerm: string;
    activeFilterCount: number;
}

export function EmployeesMobileList({ employees, isLoading, searchTerm, activeFilterCount }: EmployeesMobileListProps) {
    const navigate = useNavigate();

    return (
        <div className="md:hidden p-4 space-y-3" role="list" aria-label="Lista de empleados">
            {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 animate-pulse h-32" aria-hidden="true"></div>
                ))
            ) : employees.length === 0 ? (
                <div className="text-center py-10">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <User size={24} className="text-slate-400" aria-hidden="true" />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 font-medium">No se encontraron empleados</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        {searchTerm || activeFilterCount > 0 ? 'Ajusta los filtros para ver más resultados' : 'Toca el botón + para agregar uno nuevo'}
                    </p>
                </div>
            ) : (
                employees.map((employee) => {
                    const displayName = getEmployeeDisplayName(employee, 'Sin nombre');

                    return (
                    <article
                        key={employee.id}
                        className="block bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        role="listitem"
                        tabIndex={0}
                        onClick={() => navigate(`/employees/${employee.id}`)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                navigate(`/employees/${employee.id}`);
                            }
                        }}
                        aria-label={`${displayName}, ${employee.department || 'General'}, ${employee.active ? 'Activo' : 'Inactivo'}`}
                    >
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg shadow-inner shrink-0">
                                {getEmployeeInitials(employee, '?')}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-slate-900 dark:text-white truncate">
                                    {displayName}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">{employee.dni}</p>
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                                {employee.phone && (
                                    <a
                                        href={`https://api.whatsapp.com/send?phone=${employee.phone.replace(/\D/g, '').startsWith('34') ? '' : '34'}${employee.phone.replace(/\D/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                                        onClick={(event) => event.stopPropagation()}
                                        aria-label="Contactar por WhatsApp"
                                    >
                                        <MessageCircle size={14} aria-hidden="true" />
                                    </a>
                                )}
                                <span className={`w-2.5 h-2.5 rounded-full block ${employee.active ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true"></span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-50 dark:border-slate-800">
                            <div className="flex items-center gap-1.5">
                                <Building2 size={12} aria-hidden="true" />
                                {employee.department || 'General'}
                            </div>
                            <div className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{employee.subaccount465}</div>
                        </div>
                    </article>
                )})
            )}
        </div>
    );
}
