import { getEmployeeTabLabel } from '../constants';

interface EmployeeDetailTabsProps {
    tabs: string[];
    activeTab: string;
    onChange: (tab: string) => void;
}

export function EmployeeDetailTabs({ tabs, activeTab, onChange }: EmployeeDetailTabsProps) {
    return (
        <div className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => onChange(tab)}
                        className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        {getEmployeeTabLabel(tab)}
                    </button>
                ))}
            </div>
        </div>
    );
}

