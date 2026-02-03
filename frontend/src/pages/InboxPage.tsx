import { useState, useEffect } from 'react';
import { api, BASE_URL } from '../api/client';
import { toast } from 'sonner';
import { Inbox, FileText, User as UserIcon, Calendar, CheckCircle, Trash2, Tag } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';

interface InboxDocument {
    id: string;
    filename: string;
    originalName: string;
    source: string;
    receivedAt: string;
    fileUrl: string;
}

interface Employee {
    id: string;
    name: string;
    dni: string;
}

export default function InboxPage() {
    const confirmAction = useConfirm();
    const [documents, setDocuments] = useState<InboxDocument[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<InboxDocument | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    // Form state
    const [employeeId, setEmployeeId] = useState('');
    const [category, setCategory] = useState('OTHER');
    const [name, setName] = useState('');
    const [expiryDate, setExpiryDate] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [docsRes, empRes] = await Promise.all([
                api.get('/inbox/pending'),
                api.get('/employees')
            ]);
            setDocuments(docsRes.data || []);
            setEmployees(empRes.data || []);
        } catch (error) {
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectDoc = (doc: InboxDocument) => {
        setSelectedDoc(doc);
        setName(doc.originalName);
        setEmployeeId('');
        setCategory('OTHER');
        setExpiryDate('');
    };

    const handleAssign = async () => {
        if (!selectedDoc || !employeeId) {
            toast.error('Selecciona un empleado para asignar el documento');
            return;
        }

        setProcessing(true);
        try {
            await api.post(`/inbox/${selectedDoc.id}/assign`, {
                employeeId,
                category,
                name: name || selectedDoc.originalName,
                expiryDate: expiryDate || null
            });
            toast.success('Documento asignado correctamente');
            setSelectedDoc(null);
            fetchData();
        } catch (error) {
            toast.error('Error al asignar documento');
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await confirmAction({
            title: 'Descartar Documento',
            message: '¿Estás seguro de que quieres eliminar este documento de la bandeja de entrada? No se guardará en ningún registro.',
            confirmText: 'Descartar',
            type: 'danger'
        });

        if (!ok) return;

        try {
            await api.delete(`/inbox/${id}`);
            toast.success('Documento descartado');
            if (selectedDoc?.id === id) setSelectedDoc(null);
            fetchData();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        const toastId = toast.loading('Subiendo archivo...');
        try {
            await api.post('/inbox/upload', formData);
            toast.success('Archivo subido. Procesando...', { id: toastId });
            // Wait a bit for the watcher to pick it up
            setTimeout(fetchData, 2000);
        } catch (error) {
            toast.error('Error al subir el archivo', { id: toastId });
        }
        e.target.value = ''; // Reset input
    };

    if (loading) return <div className="p-10 text-center animate-pulse text-slate-500">Cargando bandeja de entrada...</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600">
                        <Inbox size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bandeja de Entrada</h1>
                        <p className="text-slate-500 text-sm">Documentos procedentes de escáner, correo electrónico o subida manual</p>
                    </div>
                </div>
                <div>
                    <input
                        type="file"
                        id="manual-upload"
                        className="hidden"
                        onChange={handleUpload}
                        accept=".pdf,.png,.jpg,.jpeg"
                    />
                    <label
                        htmlFor="manual-upload"
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-bold cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors"
                    >
                        <FileText size={18} /> Subir Documento
                    </label>
                </div>
            </div>

            <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
                {/* List of pending documents */}
                <div className="w-1/3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col min-h-0 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                        <h2 className="font-semibold flex items-center gap-2">
                            <FileText size={18} className="text-slate-400" />
                            Pendientes ({documents.length})
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {documents.length === 0 ? (
                            <div className="px-4 py-12 text-center text-slate-500">
                                <CheckCircle size={40} className="mx-auto mb-3 opacity-20" />
                                <p>Bandeja vacía</p>
                            </div>
                        ) : (
                            documents.map(doc => (
                                <button
                                    key={doc.id}
                                    onClick={() => handleSelectDoc(doc)}
                                    className={`w-full text-left p-4 rounded-xl transition-all border ${selectedDoc?.id === doc.id
                                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 shadow-sm'
                                        : 'hover:bg-slate-50 border-transparent dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-medium text-slate-900 dark:text-white truncate pr-2">
                                            {doc.originalName}
                                        </div>
                                        <div className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${doc.source === 'EMAIL' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {doc.source}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Calendar size={12} />
                                        {new Date(doc.receivedAt).toLocaleString()}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Preview and Assignment Form */}
                {selectedDoc ? (
                    <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
                        {/* File Preview */}
                        <div className="flex-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                            <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                                <span className="font-medium truncate text-sm">{selectedDoc.originalName}</span>
                                <button
                                    onClick={() => handleDelete(selectedDoc.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Descartar documento"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            <div className="flex-1 min-h-0 relative">
                                <iframe
                                    src={`${BASE_URL}${selectedDoc.fileUrl}`}
                                    className="w-full h-full border-none"
                                    title="Vista previa del documento"
                                />
                            </div>
                        </div>

                        {/* Assignment Panel */}
                        <div className="w-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col shrink-0 overflow-y-auto shadow-xl">
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                                <Tag size={20} className="text-blue-500" />
                                Clasificar
                            </h3>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2.5 flex items-center gap-2">
                                        <UserIcon size={16} className="text-slate-400" />
                                        Asignar a Trabajador
                                    </label>
                                    <select
                                        value={employeeId}
                                        onChange={(e) => setEmployeeId(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                                    >
                                        <option value="">Selecciona trabajador...</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.name} ({emp.dni})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2.5">Tipo de Documento</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['PAYROLL', 'CONTRACT', 'DNI', 'MEDICAL', 'TRAINING', 'OTHER'].map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setCategory(cat)}
                                                className={`py-2 px-1 text-[11px] font-bold rounded-lg border transition-all ${category === cat
                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300 dark:bg-slate-800 dark:border-slate-700'
                                                    }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2.5">Nombre en el Expediente</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ej: Contrato 2024"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2.5">Vencimiento (opcional)</label>
                                    <input
                                        type="date"
                                        value={expiryDate}
                                        onChange={(e) => setExpiryDate(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                                    />
                                </div>

                                <button
                                    onClick={handleAssign}
                                    disabled={processing || !employeeId}
                                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 mt-4"
                                >
                                    {processing ? 'Procesando...' : (
                                        <>
                                            <CheckCircle size={20} />
                                            Asignar Documento
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800">
                        <Inbox size={64} className="text-slate-200 dark:text-slate-800 mb-4" />
                        <h3 className="text-xl font-bold text-slate-400">Selecciona un documento</h3>
                        <p className="text-slate-400">Elige un archivo de la izquierda para procesarlo</p>
                    </div>
                )}
            </div>
        </div>
    );
}
