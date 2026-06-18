import DocumentArchive from '../../../components/DocumentArchive';
import PRLArchive from '../../../components/PRLArchive';
import { CONVENIOS, PUESTOS, TIPOS_CONTRATO } from '../constants';
import type { CompanyOption, EmployeeFieldOptions, EmployeeFormData, EmployeeOption, EmployeeVacationBalanceSummary, EmployeeViewRecord } from '../types';
import { getEmployeeDisplayName } from '../../../utils/employeeDisplay';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';

interface EmployeeSecondarySectionsProps {
    activeTab: string;
    isNew: boolean;
    employeeId: string;
    formData: EmployeeFormData;
    companies: CompanyOption[];
    allEmployees: EmployeeOption[];
    fieldOptions: EmployeeFieldOptions;
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    employeeView?: EmployeeViewRecord;
}

export function EmployeeSecondarySections({
    activeTab,
    isNew,
    employeeId,
    formData,
    companies,
    allEmployees,
    fieldOptions,
    onChange,
    employeeView
}: EmployeeSecondarySectionsProps) {
    const { data: vacationBalance } = useQuery({
        queryKey: ['employee-vacation-balance', employeeId, new Date().getFullYear()],
        queryFn: () => api.get(`/employees/${employeeId}/vacation-balance`).then(res => res.data),
        enabled: !isNew && activeTab === 'financiero',
        staleTime: 1000 * 60 * 5
    });
    if (activeTab === 'laboral') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Empresa / Centro</label>
                    <select name="companyId" value={formData.companyId} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <option value="">Seleccionar empresa...</option>
                        {companies.map((company) => (
                            <option key={company.id} value={company.id}>{company.name}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Departamento</label>
                    <input list="department-options" name="department" value={formData.department} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="Escribe o elige un departamento" />
                    <datalist id="department-options">
                        {fieldOptions.departments.map((department) => <option key={department} value={department} />)}
                    </datalist>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Puesto (Job Title)</label>
                    <select name="jobTitle" value={formData.jobTitle} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <option value="">Seleccionar...</option>
                        {PUESTOS.map((jobTitle) => <option key={jobTitle} value={jobTitle}>{jobTitle}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Categoría</label>
                    <input list="category-options" name="category" value={formData.category} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="Escribe o elige una categoría" />
                    <datalist id="category-options">
                        {fieldOptions.categories.map((category) => <option key={category} value={category} />)}
                    </datalist>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo Contrato</label>
                    <select name="contractType" value={formData.contractType} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <option value="">Seleccionar...</option>
                        {TIPOS_CONTRATO.map((contractType) => <option key={contractType} value={contractType}>{contractType}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Convenio</label>
                    <select name="agreementType" value={formData.agreementType} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <option value="">Seleccionar...</option>
                        {CONVENIOS.map((agreementType) => <option key={agreementType} value={agreementType}>{agreementType}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 font-bold text-amber-600 dark:text-amber-400">Responsable Directo</label>
                    <select name="managerId" value={formData.managerId} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/20 dark:bg-amber-900/10">
                        <option value="">Sin responsable asignado</option>
                        {allEmployees.map((employee) => (
                            <option key={employee.id} value={employee.id}>{getEmployeeDisplayName(employee)}{employee.jobTitle ? ` (${employee.jobTitle})` : ''}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de Jornada</label>
                    <select name="workingDayType" value={formData.workingDayType} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-blue-600 dark:text-blue-400">
                        <option value="COMPLETE">Jornada Completa</option>
                        <option value="PARTIAL">Jornada Parcial</option>
                    </select>
                </div>
                {formData.workingDayType === 'PARTIAL' && (
                    <div className="space-y-2 animate-in slide-in-from-left duration-300">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Horas Semanales</label>
                        <input type="number" name="weeklyHours" value={formData.weeklyHours} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10 font-bold" placeholder="Ej: 20" />
                    </div>
                )}
                <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        Días Vacaciones Anuales
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">Días naturales</span>
                    </label>
                    <input type="number" step="1" min="0" max="366" name="vacationDaysTotal" value={formData.vacationDaysTotal} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-900/10 font-bold text-amber-700 dark:text-amber-400" placeholder="Ej: 30" />
                </div>
            </div>
        );
    }

    if (activeTab === 'vacaciones' && !isNew) {
        const balance = (formData as any).vacationBalance;
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Año</label>
                    <input type="number" min="2000" max="2100" name="vacationYear" value={formData.vacationYear || new Date().getFullYear()} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cupo Anual (días)</label>
                    <input type="number" step="0.5" min="0" max="366" name="vacationAnnualQuota" value={formData.vacationAnnualQuota || balance?.annualQuotaDays || ''} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10 font-bold text-blue-700 dark:text-blue-400" placeholder="Ej: 30" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Días Arrastrados (año anterior)</label>
                    <input type="number" step="0.5" min="0" name="vacationCarryOver" value={formData.vacationCarryOver || balance?.carriedOverDays || ''} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-900/10 font-bold text-amber-700 dark:text-amber-400" placeholder="Ej: 2.5" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Días ya Gastados (importados)</label>
                    <input type="number" step="0.5" min="0" name="vacationImportedUsed" value={formData.vacationImportedUsed || balance?.importedUsedDays || ''} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-red-200 dark:border-red-700 bg-red-50/30 dark:bg-red-900/10 font-bold text-red-700 dark:text-red-400" placeholder="Ej: 0" />
                </div>
                <div className="md:col-span-2 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Total Derecho</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{balance?.totalEntitledDays ?? 0}</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-center">
                        <p className="text-xs text-blue-700 dark:text-blue-400">Gastados Aprobados</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{balance?.approvedUsedDays ?? 0}</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl text-center">
                        <p className="text-xs text-amber-700 dark:text-amber-400">Pendientes</p>
                        <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{balance?.pendingDays ?? 0}</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl text-center">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">Dispony>Disponibles</p>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{balance?.availableDays ?? 0}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (activeTab === 'financiero') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Subcuenta Contable (465)</label>
                    <input name="subaccount465" value={formData.subaccount465} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                </div>
                <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">IBAN</label>
                    <input name="iban" value={formData.iban} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                </div>
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            Sueldo Bruto Anual
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">€/Año</span>
                        </label>
                        <input type="number" step="0.01" name="annualGrossSalary" value={formData.annualGrossSalary} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50/30 dark:bg-green-900/10 font-bold text-green-700 dark:text-green-400" placeholder="Ej: 24000" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            Sueldo Bruto Mensual
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">€/Mes (12 pagas)</span>
                        </label>
          <input type="number" step="0.01" name="monthlyGrossSalary" value={formData.monthlyGrossSalary} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50/30 dark:bg-green-900/10 font-bold text-green-700 dark:text-green-400" placeholder="Ej: 2000" />
          </div>
        </div>
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              Sueldo Total Anual
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">€/Año</span>
            </label>
            <input type="number" step="0.01" name="annualTotalSalary" value={formData.annualTotalSalary} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/10 font-bold text-emerald-700 dark:text-emerald-400" placeholder="Ej: 30000" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              Sueldo Total Mensual
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">€/Mes (12 pagas)</span>
            </label>
            <input type="number" step="0.01" name="monthlyTotalSalary" value={formData.monthlyTotalSalary} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/10 font-bold text-emerald-700 dark:text-emerald-400" placeholder="Ej: 2500" />
          </div>
                </div>
            </div>
        );
    }

    if (activeTab === 'fechas') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Entrada / Antigüedad</label>
                    <input type="date" name="entryDate" value={formData.entryDate} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                </div>
                {formData.contractType === 'Fijo Discontinuo' && (
                    <>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Llamamiento</label>
                            <input type="date" name="callDate" value={formData.callDate} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Interrupción de Contrato</label>
                            <input type="date" name="contractInterruptionDate" value={formData.contractInterruptionDate} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                        </div>
                    </>
                )}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Baja</label>
                    <input type="date" name="lowDate" value={formData.lowDate} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                </div>
                <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Motivo Baja</label>
                    <input name="lowReason" value={formData.lowReason} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                </div>
            </div>
        );
    }

    if (activeTab === 'expediente' && !isNew) {
        return <DocumentArchive employeeId={employeeId} />;
    }

    if (activeTab === 'prl' && !isNew) {
        return <PRLArchive employeeId={employeeId} />;
    }

    return null;
}
