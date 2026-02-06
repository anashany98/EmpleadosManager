import { useState, useEffect } from 'react';
import { api, BASE_URL } from '../../api/client';
import {
    Circle, FileText,
    Calendar, GraduationCap, Receipt, HeartPulse,
    UserPlus, UserMinus, ShieldAlert, History
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TimelineEvent {
    id: string;
    date: string;
    type: 'ENTRY' | 'EXIT' | 'CONTRACT' | 'PAYROLL' | 'MEDICAL' | 'VACATION' | 'TRAINING' | 'EXPENSE' | 'INCIDENT' | 'AUDIT';
    title: string;
    description?: string;
    amount?: number;
    fileUrl?: string;
    category?: string;
}

interface EmployeeTimelineProps {
    employeeId: string;
}

export default function EmployeeTimeline({ employeeId }: EmployeeTimelineProps) {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTimeline = async () => {
            try {
                const res = await api.get(`/employees/${employeeId}/timeline`);
                setEvents(res.data?.data || res.data || []);
            } catch (error) {
                console.error("Error fetching timeline", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTimeline();
    }, [employeeId]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'ENTRY': return <UserPlus size={18} className="text-emerald-500" />;
            case 'EXIT': return <UserMinus size={18} className="text-red-500" />;
            case 'CONTRACT': return <FileText size={18} className="text-blue-500" />;
            case 'PAYROLL': return <Receipt size={18} className="text-indigo-500" />;
            case 'MEDICAL': return <HeartPulse size={18} className="text-rose-500" />;
            case 'VACATION': return <Calendar size={18} className="text-orange-500" />;
            case 'TRAINING': return <GraduationCap size={18} className="text-purple-500" />;
            case 'EXPENSE': return <CreditCardIcon size={18} className="text-amber-500" />;
            case 'INCIDENT': case 'AUDIT': return <ShieldAlert size={18} className="text-slate-500" />;
            default: return <Circle size={18} className="text-slate-400" />;
        }
    };

    const getBgColor = (type: string) => {
        switch (type) {
            case 'ENTRY': return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30';
            case 'EXIT': return 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30';
            case 'CONTRACT': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30';
            case 'PAYROLL': return 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30';
            case 'MEDICAL': return 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/30';
            case 'AUDIT': case 'INCIDENT': return 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700';
            default: return 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700';
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 p-8 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-4">
                        <div className="w-12 flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 mb-2"></div>
                            <div className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700"></div>
                        </div>
                        <div className="flex-1 h-24 bg-slate-50 dark:bg-slate-800 rounded-xl"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <History size={48} className="mb-4 opacity-20" />
                <p>No hay historial disponible</p>
            </div>
        );
    }

    return (
        <div className="relative pl-4 space-y-6 max-w-3xl mx-auto py-8">
            {/* Vertical Line */}
            <div className="absolute top-0 bottom-0 left-[27px] w-0.5 bg-slate-200 dark:bg-slate-800" />

            {events.map((event, index) => (
                <div key={`${event.id}-${index}`} className="relative flex gap-6 group">
                    {/* Icon */}
                    <div className="relative z-10 flex flex-col items-center">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 border-4 border-slate-50 dark:border-slate-800 shadow-sm group-hover:scale-110 transition-transform`}>
                            {getIcon(event.type)}
                        </div>
                    </div>

                    {/* Content Card */}
                    <div className={`flex-1 rounded-2xl p-5 border shadow-sm transition-all hover:shadow-md ${getBgColor(event.type)}`}>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-slate-900 dark:text-white text-lg">{event.title}</h3>
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-black/20 px-2 py-1 rounded-md">
                                {format(new Date(event.date), 'dd MMM yyyy, HH:mm', { locale: es })}
                            </span>
                        </div>

                        {event.description && (
                            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                                {event.description}
                            </p>
                        )}

                        {event.amount && (
                            <div className="mt-3 inline-block font-mono font-bold text-emerald-600 bg-emerald-100/50 dark:bg-emerald-900/30 px-3 py-1 rounded-lg">
                                {event.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                            </div>
                        )}

                        {event.fileUrl && (
                            <a
                                href={event.fileUrl.startsWith('http')
                                    ? event.fileUrl
                                    : `${BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '')}${event.fileUrl.startsWith('/') ? '' : '/'}${event.fileUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                                <FileText size={14} />
                                Ver Documento
                            </a>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

// Icon helper
const CreditCardIcon = ({ size, className }: { size: number, className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
);
