import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import {
    Calendar, Briefcase, HeartPulse, GraduationCap,
    Receipt, Wallet, History, Star
} from 'lucide-react';

interface TimelineEvent {
    id: string;
    type: string;
    date: string;
    title: string;
    description: string;
    category: string;
    amount?: number;
}

export default function EmployeeTimeline({ employeeId }: { employeeId: string }) {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTimeline = async () => {
            try {
                const resp = await api.get(`/employees/${employeeId}/timeline`);
                setEvents(resp.data);
            } catch (error) {
                console.error('Error fetching timeline', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTimeline();
    }, [employeeId]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'CONTRACT': return <Briefcase className="w-4 h-4" />;
            case 'CONTRACT_EXTENSION': return <Star className="w-4 h-4 text-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]" />;
            case 'VACATION': return <Calendar className="w-4 h-4 text-blue-400" />;
            case 'MEDICAL_REVIEW': return <HeartPulse className="w-4 h-4 text-red-400" />;
            case 'TRAINING': return <GraduationCap className="w-4 h-4 text-green-400" />;
            case 'EXPENSE': return <Receipt className="w-4 h-4 text-purple-400" />;
            case 'PAYROLL': return <Wallet className="w-4 h-4 text-emerald-400" />;
            default: return <History className="w-4 h-4" />;
        }
    };

    const getBgColor = (type: string) => {
        switch (type) {
            case 'CONTRACT': return 'bg-slate-800';
            case 'CONTRACT_EXTENSION': return 'bg-amber-900/20 border-amber-500/30';
            case 'VACATION': return 'bg-blue-900/30 border-blue-500/30';
            case 'MEDICAL_REVIEW': return 'bg-red-900/30 border-red-500/30';
            case 'TRAINING': return 'bg-green-900/30 border-green-500/30';
            case 'EXPENSE': return 'bg-purple-900/30 border-purple-500/30';
            case 'PAYROLL': return 'bg-emerald-900/30 border-emerald-500/30';
            default: return 'bg-slate-800 border-slate-700';
        }
    };

    if (loading) return (
        <div className="animate-pulse space-y-8 py-4">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex gap-4">
                    <div className="w-10 h-10 bg-slate-800 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-800 rounded w-1/4" />
                        <div className="h-12 bg-slate-800 rounded w-full" />
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="relative py-8">
            {/* Central Line */}
            <div className="absolute left-5 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-slate-700 to-transparent -translate-x-1/2" />

            {events.length === 0 ? (
                <div className="text-center py-12 bg-slate-800/20 rounded-3xl border border-dashed border-slate-700">
                    <History className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-30" />
                    <p className="text-slate-500 font-medium">No hay eventos registrados en la línea de tiempo</p>
                </div>
            ) : (
                <div className="space-y-12">
                    {events.map((event, index) => (
                        <div key={`${event.id}-${index}`} className="relative flex items-center group">
                            {/* Event Dot/Icon */}
                            <div className={`absolute left-5 md:left-1/2 -translate-x-1/2 flex items-center justify-center w-10 h-10 rounded-full border-2 ${getBgColor(event.type)} text-slate-200 z-10 transition-all duration-300 group-hover:scale-125 group-hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]`}>
                                {getIcon(event.type)}
                            </div>

                            {/* Card Container */}
                            <div className={`flex flex-col w-full pl-16 md:pl-0 md:w-1/2 ${index % 2 === 0 ? 'md:pr-12 md:text-right md:items-end' : 'md:ml-auto md:pl-12 md:text-left md:items-start'}`}>
                                <div className="bg-slate-900/40 border border-slate-800/50 p-5 rounded-2xl hover:bg-slate-800/60 hover:border-slate-700 transition-all duration-300 shadow-lg group-hover:shadow-black/40 max-w-lg">
                                    <div className={`flex flex-col gap-1 ${index % 2 === 0 ? 'md:items-end' : 'md:items-start'}`}>
                                        <time className="text-[10px] font-black font-mono text-blue-400 tracking-tighter bg-blue-500/10 px-2 py-0.5 rounded-md mb-1 inline-block">
                                            {new Date(event.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                                        </time>
                                        <h4 className="text-base font-bold text-white tracking-tight leading-tight">{event.title}</h4>
                                        <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{event.description}</p>

                                        {event.amount && event.amount > 0 && (
                                            <div className="mt-3 inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
                                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Importe</span>
                                                <span className="text-sm font-black text-emerald-400">
                                                    {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(event.amount)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
