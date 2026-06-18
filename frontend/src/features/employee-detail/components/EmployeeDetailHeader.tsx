import { Building, CreditCard, Loader2, MessageCircle, Phone, Sparkles, Trash2 } from 'lucide-react';
import type { EmployeeViewRecord } from '../types';

interface EmployeeDetailHeaderProps {
    employee: EmployeeViewRecord;
    canEdit: boolean;
    canManageLifecycle: boolean;
    generatingAccess: boolean;
    onGenerateAccess: () => void;
    onOpenOnboarding: () => void;
    onOpenOffboarding: () => void;
    onEdit: () => void;
}

export function EmployeeDetailHeader({
    employee,
    canEdit,
    canManageLifecycle,
    generatingAccess,
    onGenerateAccess,
    onOpenOnboarding,
    onOpenOffboarding,
    onEdit
}: EmployeeDetailHeaderProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
      <div className="flex items-center gap-3 sm:gap-6">
        <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg sm:text-2xl font-bold shadow-lg shrink-0">
          {employee.firstName?.charAt(0) || employee.name?.charAt(0)}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate">
            {employee.firstName || employee.lastName
              ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
              : employee.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 sm:mt-2 text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
            <span className="flex items-center gap-1"><CreditCard size={14} /> {employee.dni}</span>
            <span className="flex items-center gap-1"><Building size={14} /> {employee.department}</span>
      {employee.phone && (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1"><Phone size={14} /> {employee.phone}</span>
          <a
            href={`https://api.whatsapp.com/send?phone=${employee.phone.replace(/\D/g, '').startsWith('34') ? '' : '34'}${employee.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 px-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center gap-1 text-[10px] font-bold"
            title="Abrir WhatsApp"
          >
            <MessageCircle size={10} /> WhatsApp
          </a>
        </div>
      )}
      {employee.companyShortPhone && (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1"><Phone size={14} /> Ext. {employee.companyShortPhone}</span>
          <a
            href={`https://api.whatsapp.com/send?phone=${employee.companyShortPhone.replace(/\D/g, '').startsWith('34') ? '' : '34'}${employee.companyShortPhone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 px-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center gap-1 text-[10px] font-bold"
            title="Abrir WhatsApp"
          >
            <MessageCircle size={10} /> WhatsApp
          </a>
        </div>
      )}
                        {employee.gender && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${employee.gender === 'MALE'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : employee.gender === 'FEMALE'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                {employee.gender === 'MALE' ? 'Hombre' : employee.gender === 'FEMALE' ? 'Mujer' : 'Otro'}
                            </span>
                        )}
                    </div>
                </div>
            </div>

      {canEdit && (
      <div className="flex gap-2 sm:gap-3 flex-wrap w-full md:w-auto">
        {canManageLifecycle && (
          <button
            onClick={onOpenOnboarding}
            className="flex-1 md:flex-none px-3 sm:px-4 py-2.5 sm:py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-semibold rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center justify-center gap-2 border border-emerald-100 dark:border-emerald-900/30 text-xs sm:text-sm touch-active"
          >
            <Sparkles size={16} />
            Onboarding
          </button>
        )}
        {canManageLifecycle && (
          <button
            onClick={onOpenOffboarding}
            className="flex-1 md:flex-none px-3 sm:px-4 py-2.5 sm:py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 font-semibold rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors flex items-center justify-center gap-2 border border-rose-100 dark:border-rose-900/30 text-xs sm:text-sm touch-active"
          >
            <Trash2 size={16} />
            <span className="sm:inline">Tramitar Baja</span>
          </button>
        )}
        <button onClick={onEdit} className="w-full md:w-auto px-4 py-2.5 sm:py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 text-sm touch-active">
          Editar Perfil
        </button>
      </div>
      )}
        </div>
    );
}
