import { Check, ExternalLink, FileText, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, API_URL } from '../../../api/client';
import { ABSENCE_TYPES, CalendarIconSmall, formatVacationRange, type AbsenceTypeConfig, type VacationRequest } from './types';

interface VacationRequestCardProps {
    request: VacationRequest;
    canManage: boolean;
    onApprove?: (comment?: string) => void;
    onReject?: (comment?: string) => void;
    onDelete?: () => void;
    onEdit?: () => void;
    absenceTypes?: Record<string, AbsenceTypeConfig>;
    onDocumentGenerated?: (docUrl: string) => void;
}

export function VacationRequestCard({
    request,
    canManage,
    onApprove,
    onReject,
    onDelete,
    onEdit,
    absenceTypes = ABSENCE_TYPES,
    onDocumentGenerated
}: VacationRequestCardProps) {
    const [comment, setComment] = useState('');
    const [generatingDoc, setGeneratingDoc] = useState(false);
    const config = absenceTypes[request.type] || ABSENCE_TYPES[request.type] || ABSENCE_TYPES.OTHER;
    const Icon = config.icon;

    const handleApprove = () => {
        if (onApprove) {
            toast.success('Solicitud aprobada');
            onApprove(comment);
        }
    };

    const handleReject = () => {
        if (onReject) {
            toast.success('Solicitud rechazada');
            onReject(comment);
        }
    };

    const handleGenerateDocument = async () => {
        setGeneratingDoc(true);
        try {
            const response = await api.post(`/vacations/${request.id}/generate-document`);
            if (response.data?.fileUrl) {
                toast.success('Documento generado correctamente');
                if (onDocumentGenerated) {
                    onDocumentGenerated(response.data.fileUrl);
                }
                // Use an <a download> click instead of window.open so the
                // browser honors the suggested filename (response.data.fileName
                // includes the .pdf extension) and downloads the file rather
                // than opening a viewer tab. window.open had no way to pass
                // a filename hint.
                const link = document.createElement('a');
                link.href = `${API_URL}${response.data.fileUrl}`;
                link.download = response.data.fileName || 'documento.pdf';
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error: any) {
            toast.error(error.message || 'Error al generar documento');
        } finally {
            setGeneratingDoc(false);
        }
    };

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
                    {request.fileUrl && (
                        <a
                            href={`${API_URL}${request.fileUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold"
                        >
                            <ExternalLink size={14} />
                            Ver adjunto
                        </a>
                    )}
                    {request.status === 'REJECTED' && request.rejectionReason && (
                        <span className="text-rose-600 text-sm italic mt-1">Motivo: {request.rejectionReason}</span>
                    )}
                    {request.status === 'APPROVED' && request.managerComment && (
                        <span className="text-emerald-600 text-sm italic mt-1">Comentario: {request.managerComment}</span>
                    )}
                    {request.approvedAt && (
                        <span className="text-xs text-slate-400 mt-1">
                            {request.status === 'APPROVED' ? 'Aprobado' : 'Procesado'}: {new Date(request.approvedAt).toLocaleDateString()}
                        </span>
                    )}
                </div>

                {request.reason && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                        {request.reason}
                    </p>
                )}

                {canManage && request.status === 'PENDING' && (
                    <div className="mt-3">
                        <input
                            type="text"
                            placeholder="Comentario (opcional)"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                )}
            </div>

            {(onDelete || onEdit || (canManage && request.status === 'PENDING')) && (
                <div className="flex items-center gap-2 mt-2 md:mt-0">
                    {onEdit && (
                        <button onClick={onEdit} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-colors flex items-center gap-2 dark:bg-indigo-950/30 dark:text-indigo-300">
                            <Pencil size={16} />
                            Modificar
                        </button>
                    )}
                    {onDelete && (
                        <button onClick={onDelete} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center gap-2 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                            <Trash2 size={16} />
                            Eliminar
                        </button>
                    )}
                    {canManage && request.status === 'PENDING' && (
                        <>
                            <button onClick={handleReject} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-colors flex items-center gap-2">
                                <X size={16} />
                                Rechazar
                            </button>
                            <button onClick={handleApprove} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2">
                                <Check size={16} />
                                Aprobar
                            </button>
                        </>
                    )}
                </div>
            )}
            {request.status === 'APPROVED' && (
                <div className="flex items-center gap-2 mt-2 md:mt-0">
                    <button
                        onClick={handleGenerateDocument}
                        disabled={generatingDoc}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <FileText size={16} />
                        {generatingDoc ? 'Generando...' : 'Generar Documento'}
                    </button>
                </div>
            )}
        </div>
    );
}
