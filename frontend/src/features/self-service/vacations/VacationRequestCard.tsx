import { Check, ExternalLink, X } from 'lucide-react';
import { API_URL } from '../../../api/client';
import { ABSENCE_TYPES, CalendarIconSmall, formatVacationRange, type VacationRequest } from './types';

interface VacationRequestCardProps {
    request: VacationRequest;
    canManage: boolean;
    onApprove?: () => void;
    onReject?: () => void;
}

export function VacationRequestCard({
    request,
    canManage,
    onApprove,
    onReject
}: VacationRequestCardProps) {
    const config = ABSENCE_TYPES[request.type] || ABSENCE_TYPES.VACATION;
    const Icon = config.icon;

    return (
        <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 md:items-center">
            <div className={`w-12 h-12 rounded-2xl ${config.bgSoft} ${config.text} flex items-center justify-center shrink-0`}>
                <Icon size={20} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{request.employee?.name || 'Yo'}</h3>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${request.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : request.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {request.status === 'PENDING' ? 'Pendiente' : request.status === 'APPROVED' ? 'Aprobada' : 'Rechazada'}
                    </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                        <CalendarIconSmall size={14} />
                        {formatVacationRange(request.startDate, request.endDate)}
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">({request.days} dias)</span>
                    {request.reason && <span className="italic truncate max-w-[200px]">{request.reason}</span>}
                    {request.fileUrl && (
                        <a
                            href={`${API_URL}/vacations/${request.id}/attachment`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold"
                        >
                            <ExternalLink size={14} />
                            Ver adjunto
                        </a>
                    )}
                </div>
            </div>

            {canManage && request.status === 'PENDING' && (
                <div className="flex items-center gap-2 mt-2 md:mt-0">
                    <button onClick={onReject} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-colors flex items-center gap-2">
                        <X size={16} />
                        Rechazar
                    </button>
                    <button onClick={onApprove} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2">
                        <Check size={16} />
                        Aprobar
                    </button>
                </div>
            )}
        </div>
    );
}
