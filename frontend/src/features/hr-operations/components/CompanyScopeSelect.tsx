import { Building2 } from 'lucide-react';
import type { CompanyScope } from '../types';

export function CompanyScopeSelect({
    companies,
    value,
    onChange,
    hidden
}: {
    companies: CompanyScope[];
    value?: string;
    onChange: (value: string) => void;
    hidden?: boolean;
}) {
    if (hidden) return null;
    return (
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <Building2 size={16} className="text-slate-400" aria-hidden="true" />
            <span className="sr-only">Empresa</span>
            <select
                value={value || ''}
                onChange={(event) => onChange(event.target.value)}
                className="min-w-40 bg-transparent py-2 outline-none"
                aria-label="Seleccionar empresa"
            >
                <option value="">Selecciona empresa</option>
                {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                ))}
            </select>
        </label>
    );
}
