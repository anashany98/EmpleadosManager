import { getEmployeeTabLabel } from '../constants';

interface EmployeeDetailTabsProps {
    tabs: string[];
    activeTab: string;
    onChange: (tab: string) => void;
}

export function EmployeeDetailTabs({ tabs, activeTab, onChange }: EmployeeDetailTabsProps) {
  return (
    <div className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
      <div className="flex overflow-x-auto no-scrollbar px-1 sm:px-2 -mb-px">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 touch-active ${activeTab === tab
              ? 'border-brand-500 text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-900/20'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            {getEmployeeTabLabel(tab)}
          </button>
        ))}
      </div>
    </div>
  );
}

