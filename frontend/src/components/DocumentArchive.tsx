import { useState, useEffect } from 'react';
import { api, API_URL } from '../api/client';
import { toast } from 'sonner';
import { FileText, Upload, Trash2, Download, Filter, Calendar, AlertTriangle, Loader2, Eye } from 'lucide-react';
import DocumentPreview from './DocumentPreview';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const DOC_CATEGORIES = [
    { id: 'ALL', label: 'Todos', color: 'bg-slate-500' },
    { id: 'DNI', label: 'DNI / NIE', color: 'bg-blue-500' },
    { id: 'CONTRACT', label: 'Contratos', color: 'bg-emerald-500' },
    { id: 'PAYROLL', label: 'Nóminas', color: 'bg-amber-500' },
    { id: 'MEDICAL', label: 'Médico / PRL', color: 'bg-rose-500' },
    { id: 'TRAINING', label: 'Formación', color: 'bg-indigo-500' },
    { id: 'OTHER', label: 'Otros', color: 'bg-slate-400' },
];

import { useConfirm } from '../context/ConfirmContext';

export default function DocumentArchive({ employeeId }: { employeeId: string }) {
    const confirmAction = useConfirm();
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [uploading, setUploading] = useState(false);
    const [ocrLoading] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewTitle, setPreviewTitle] = useState('');
    const [previewDocId, setPreviewDocId] = useState<string | null>(null);

    // Form states
    const [newName, setNewName] = useState('');
    const [newCategory, setNewCategory] = useState('OTHER');
    const [newExpiry, setNewExpiry] = useState('');

    useEffect(() => {
        fetchDocuments();
    }, [employeeId]);

    const fetchDocuments = async () => {
        try {
            const response = await api.get(`/documents/employee/${employeeId}`);
            setDocuments(response.data || []);
        } catch (error) {
            toast.error('Error al cargar documentos');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        /* OCR dehabilitado por ahora
        setOcrLoading(true);
        const ocrData = new FormData();
        ocrData.append('file', file);
    
        try {
            const response = await api.post('/documents/ocr', ocrData);
            const data = response.data;
            if (data.suggestedCategory) {
                setNewCategory(data.suggestedCategory);
                toast.info(`Categoría detectada: ${DOC_CATEGORIES.find(c => c.id === data.suggestedCategory)?.label}`);
            }
            if (data.suggestedDate) {
                setNewExpiry(data.suggestedDate);
                toast.info(`Fecha de vencimiento detectada: ${data.suggestedDate}`);
            }
        } catch (error) {
            console.error('OCR Error:', error);
        } finally {
            setOcrLoading(false);
        }
        */

        const proceed = await confirmAction({
            title: 'Subida Manual',
            message: `¿Deseas subir "${file.name}" de forma manual?`,
            confirmText: 'Subir',
            type: 'info'
        });

        if (!proceed) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('employeeId', employeeId);
        formData.append('file', file);
        formData.append('name', newName || file.name);
        formData.append('category', newCategory);
        if (newExpiry) formData.append('expiryDate', newExpiry);

        try {
            await api.post('/documents/upload', formData);
            toast.success('Documento subido correctamente');
            setShowUpload(false);
            setNewName('');
            setNewExpiry('');
            fetchDocuments();
        } catch (error) {
            toast.error('Error al subir el archivo');
        } finally {
            setUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await confirmAction({
            title: 'Eliminar Documento',
            message: '¿Estás seguro de eliminar este documento? Esta acción no se puede deshacer.',
            confirmText: 'Eliminar',
            type: 'danger'
        });

        if (!ok) return;
        try {
            await api.delete(`/documents/${id}`);
            toast.success('Documento eliminado');
            fetchDocuments();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const filteredDocs = filter === 'ALL'
        ? documents
        : documents.filter(d => d.category === filter);

    const handleDownload = async (doc: any) => {
        try {
            // Helper to clean URL, strip double slashes
            const url = `${API_URL.replace(/\/+$/, '')}/documents/${doc.id}/download`;

            // Try to download using fetch to avoid tab opening issues
            const response = await fetch(url, { credentials: 'include' });
            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = doc.name; // Use the document name for the file
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error(error);
            // Fallback to simple link
            const cleanBase = API_URL.replace(/\/+$/, '');
            window.open(`${cleanBase}/documents/${doc.id}/download`, '_blank');
        }
    };

    if (loading) return <div className="p-10 text-center animate-pulse">Cargando expediente...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="text-blue-600" size={24} /> Expediente Digital
                    </h3>
                    <p className="text-sm text-slate-500">Gestión de documentos personales y laborales</p>
                </div>
                <button
                    onClick={() => setShowUpload(!showUpload)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
                >
                    <Upload size={18} />
                    {showUpload ? 'Cancelar Subida' : 'Subir Documento'}
                </button>
            </div>

            {showUpload && (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-900 animate-in zoom-in-95 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nombre (Opcional)</label>
                            <input
                                type="text"
                                placeholder="Ej: Contrato 2024"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Categoría</label>
                            <select
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                            >
                                {DOC_CATEGORIES.filter(c => c.id !== 'ALL').map(c => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Vencimiento (Opcional)</label>
                            <input
                                type="date"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                value={newExpiry}
                                onChange={(e) => setNewExpiry(e.target.value)}
                            />
                        </div>
                    </div>

                    <label className={`
                        flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all
                        ${uploading ? 'opacity-50 cursor-wait' : 'hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'}
                        border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900
                    `}>
                        <div className="flex items-center gap-2 mb-2">
                            {uploading ? (
                                <Upload className="animate-bounce text-blue-500" size={32} />
                            ) : ocrLoading ? (
                                <Loader2 className="animate-spin text-blue-500" size={32} />
                            ) : (
                                <Upload className="text-slate-400" size={32} />
                            )}
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {uploading ? 'Subiendo...' : ocrLoading ? 'Analizando documento...' : 'Selecciona un archivo (PDF, Imagen, Doc...)'}
                        </span>
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading || ocrLoading} />
                    </label>
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {DOC_CATEGORIES.map(c => (
                    <button
                        key={c.id}
                        onClick={() => setFilter(c.id)}
                        className={`
                            px-4 py-1.5 rounded-full text-xs font-bold transition-all border
                            ${filter === c.id
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-800 hover:border-blue-500'}
                        `}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocs.length > 0 ? (
                    filteredDocs.map(doc => {
                        const cat = DOC_CATEGORIES.find(c => c.id === doc.category);
                        const isExpiring = doc.expiryDate && new Date(doc.expiryDate) < new Date();

                        return (
                            <div key={doc.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm group hover:border-blue-500 transition-all flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className={`p-2 rounded-lg ${cat?.color || 'bg-slate-500'} bg-opacity-10 text-opacity-100`}>
                                            <FileText size={20} className={cat?.color.replace('bg-', 'text-')} />
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => {
                                                    // Explicitly construct absolute URL for preview to avoid double /api issues
                                                    // and force inline display
                                                    const baseUrl = API_URL.replace(/\/$/, ''); // Remove trailing slash if any
                                                    const url = `${baseUrl}/documents/${doc.id}/download?inline=true`;

                                                    setPreviewUrl(url);
                                                    setPreviewTitle(doc.name);
                                                    setPreviewDocId(doc.id);
                                                }}
                                                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                                                title="Previsualizar"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDownload(doc)}
                                                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                                                title="Descargar"
                                            >
                                                <Download size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(doc.id)}
                                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white truncate" title={doc.name}>{doc.name}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cat?.color} text-white`}>
                                                {cat?.label}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                                {format(new Date(doc.uploadDate), "dd MMM yyyy", { locale: es })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {doc.expiryDate && (
                                    <div className={`mt-4 p-2 rounded-xl flex items-center gap-2 ${isExpiring ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600' : 'bg-blue-50 dark:bg-blue-900/10 text-blue-600'}`}>
                                        {isExpiring ? <AlertTriangle size={14} /> : <Calendar size={14} />}
                                        <span className="text-[10px] font-bold">
                                            Vence: {format(new Date(doc.expiryDate), "dd/MM/yyyy")}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/20 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                        <Filter className="text-slate-300 mb-2" size={32} />
                        <p className="text-slate-400 text-sm font-medium">No hay documentos en esta categoría</p>
                    </div>
                )}
            </div>

            <DocumentPreview
                isOpen={!!previewUrl}
                fileUrl={previewUrl || ''}
                title={previewTitle}
                documentId={previewDocId || undefined}
                employeeId={employeeId}
                canSign={!!previewTitle && !previewTitle.startsWith('FIRMADO:')}
                onClose={() => {
                    setPreviewUrl(null);
                    setPreviewDocId(null);
                    fetchDocuments(); // Refresh list after potential signing
                }}
            />
        </div>
    );
}
