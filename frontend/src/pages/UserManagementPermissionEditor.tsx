import type { PermissionLevel, PermissionMap, PermissionModule } from '@shared/authz';
import { ORDERED_PERMISSION_MODULES, MODULE_LABELS } from './userManagementShared';

interface UserManagementPermissionEditorProps {
    permissions: PermissionMap;
    onChange: (module: PermissionModule, level: PermissionLevel) => void;
}

const LEVEL_OPTIONS: Array<{ value: PermissionLevel; label: string; activeClass: string }> = [
    { value: 'none', label: 'Sin acceso', activeClass: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100' },
    { value: 'read', label: 'Lectura', activeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    { value: 'write', label: 'Escritura', activeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' }
];

export default function UserManagementPermissionEditor({ permissions, onChange }: UserManagementPermissionEditorProps) {
    return (
        <div className="space-y-2 rounded-2xl border border-slate-200 p-2 dark:border-slate-800">
            {ORDERED_PERMISSION_MODULES.map((module) => {
                const currentLevel = permissions[module] || 'none';

                return (
                    <div key={module} className="flex flex-col gap-3 rounded-xl border border-slate-100 px-3 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{MODULE_LABELS[module]}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Define el nivel de acceso para este módulo.</p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 lg:min-w-[280px]">
                            {LEVEL_OPTIONS.map((option) => {
                                const isActive = currentLevel === option.value;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => onChange(module, option.value)}
                                        className={`rounded-xl px-3 py-2 text-xs font-bold transition ${isActive ? option.activeClass : 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
