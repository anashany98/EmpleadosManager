import { FileSpreadsheet, Loader2, Plus, Upload, UserCheck, UserX, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmployeesHeaderProps {
    total: number;
    active: number;
    inactive: number;
    importPending: boolean;
    onDownloadTemplate: () => void;
    onImportFile: (file: File) => void;
}

export function EmployeesHeader({
    total,
    active,
    inactive,
    importPending,
    onDownloadTemplate,
    onImportFile
}: EmployeesHeaderProps) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Empleados</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm md:text-base">
                        Gestiona el maestro de empleados y sus cuentas contables
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button
                        onClick={onDownloadTemplate}
                        className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        aria-label="Descargar plantilla de empleados"
                    >
                        <FileSpreadsheet size={18} className="text-green-600 dark:text-green-400" />
                        <span className="hidden sm:inline">Plantilla</span>
                    </button>

                    <div className="relative">
                        <input
                            type="file"
                            id="import-employees"
                            className="hidden"
                            accept=".xlsx, .xls, .csv"
                            onChange={(event) => {
                                if (event.target.files && event.target.files[0]) {
                                    onImportFile(event.target.files[0]);
                                }
                            }}
                        />
                        <label
                            htmlFor="import-employees"
                            className={`cursor-pointer border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all focus-within:ring-2 focus-within:ring-blue-500 ${importPending ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            {importPending ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} className="text-blue-600 dark:text-blue-400" />}
                            <span>Importar</span>
                        </label>
                    </div>

                    <Link to="/employees/new" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                        <Plus size={18} />
                        <span>Nuevo Empleado</span>
                    </Link>
                </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Users size={16} />
                    <span>{total} total</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <UserCheck size={16} />
                    <span>{active} activos</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                    <UserX size={16} />
                    <span>{inactive} inactivos</span>
                </div>
            </div>
        </div>
    );
}

