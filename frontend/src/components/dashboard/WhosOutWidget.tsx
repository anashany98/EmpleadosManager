import { User, CalendarOff, PartyPopper, Stethoscope } from 'lucide-react';

interface AbsentEmployee {
    id: string;
    name: string;
    department: string;
    type: string;
    returnDate: string;
}

interface WhosOutWidgetProps {
    data: {
        count: number;
        details: AbsentEmployee[];
    };
}

export function WhosOutWidget({ data }: WhosOutWidgetProps) {
    const getIcon = (type: string) => {
        switch (type) {
            case 'VACATION': return <PartyPopper size={16} className="text-orange-500" />;
            case 'SICK_LEAVE': return <Stethoscope size={16} className="text-red-500" />;
            default: return <CalendarOff size={16} className="text-slate-400" />;
        }
    };

    const getLabel = (type: string) => {
        switch (type) {
            case 'VACATION': return 'Vacaciones';
            case 'SICK_LEAVE': return 'Baja Médica';
            default: return 'Ausente';
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 h-full">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                    <CalendarOff className="text-orange-500" />
                    Quién falta hoy
                </h3>
                <span className="bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-3 py-1 rounded-full text-xs font-bold">
                    {data.count} ausentes
                </span>
            </div>

            <div className="space-y-4">
                {data.details.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <User size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">¡Todos están trabajando hoy!</p>
                    </div>
                ) : (
                    data.details.map((emp) => (
                        <div key={emp.id} className="flex items-center gap-3 group">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-sm">
                                {emp.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{emp.name}</p>
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    {emp.department} •
                                    <span className="text-slate-400">Vuelve: {new Date(emp.returnDate).toLocaleDateString()}</span>
                                </p>
                            </div>
                            <div className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center gap-1" title={getLabel(emp.type)}>
                                {getIcon(emp.type)}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {data.count > 5 && (
                <button className="w-full mt-4 text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 font-medium transition-colors">
                    Ver {data.count - 5} más...
                </button>
            )}
        </div>
    );
}
