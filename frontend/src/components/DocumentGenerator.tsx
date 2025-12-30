import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { FileText, Loader2, Printer } from 'lucide-react';
import DocumentPreview from './DocumentPreview';

interface Template {
    id: string;
    name: string;
    category: string;
}

interface DocumentGeneratorProps {
    employeeId: string;
    onDocumentGenerated?: () => void;
}

export default function DocumentGenerator({ employeeId, onDocumentGenerated }: DocumentGeneratorProps) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<string | null>(null);
    const [showDialog, setShowDialog] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewTitle, setPreviewTitle] = useState('');
    const [formData, setFormData] = useState<any>({});
    const [inventory, setInventory] = useState<any[]>([]);

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                // api.get returns the json body directly
                const response = await api.get('/document-templates/list');
                setTemplates(response.data || []);
            } catch (error) {
                console.error('Error fetching templates:', error);
            } finally {
                setLoading(false);
            }
        };

        const fetchInventory = async () => {
            try {
                const response = await api.get('/inventory');
                const data = response.data?.data || response.data || [];
                // Include all categories that are relevant for item-based generations
                setInventory(data.filter((item: any) =>
                    ['EPI', 'UNIFORM', 'UNIFORME', 'CLOTHING'].includes(item.category)
                ));
            } catch (error) {
                console.error('Error fetching inventory:', error);
            }
        };

        fetchTemplates();
        fetchInventory();
    }, []);

    const handleGenerateClick = (templateId: string) => {
        if (templateId === '145') {
            generateDocument(templateId);
        } else {
            setFormData({}); // Reset form
            setShowDialog(templateId);
        }
    };

    const generateDocument = async (templateId: string, data?: any) => {
        setGenerating(templateId);
        try {
            const res = await api.post('/document-templates/generate', {
                employeeId,
                templateId,
                data
            });

            const url = res.fileUrl || res.data?.fileUrl || res.data?.data?.fileUrl;

            if (url) {
                setPreviewUrl(url);
                const template = templates.find(t => t.id === templateId);
                setPreviewTitle(template?.name || 'Documento Generado');
                toast.success(res.message || 'Documento generado correctamente');
            } else {
                toast.success(res.message || 'Documento generado correctamente');
            }

            setShowDialog(null);

            if (onDocumentGenerated) {
                onDocumentGenerated();
            }
        } catch (error: any) {
            toast.error(error.message || 'Error al generar el documento');
        } finally {
            setGenerating(null);
        }
    };

    const handleItemSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const typePrefix = showDialog === 'epi' ? 'epi_' : 'uniform_';
        const sizePrefix = showDialog === 'epi' ? 'size_' : 'size_u_';

        const selectedItems = inventory
            .filter(item => {
                const isCorrectCategory = showDialog === 'epi' ? item.category === 'EPI' : ['UNIFORM', 'UNIFORME', 'CLOTHING'].includes(item.category);
                return isCorrectCategory && formData[`${typePrefix}${item.id}`] === true;
            })
            .map(item => ({
                name: item.name,
                size: formData[`${sizePrefix}${item.id}`] || ''
            }));

        if (formData.customItem) {
            selectedItems.push({ name: formData.customItem, size: formData.customSize || '' });
        }

        if (selectedItems.length === 0) {
            return toast.error('Selecciona al menos un material');
        }

        generateDocument(showDialog as string, { items: selectedItems });
    };

    const handleTechSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        generateDocument('tech_device', formData);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 relative">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Generar Documentos</h2>
                    <p className="text-sm text-slate-500">Genera PDFs personalizados listos para imprimir y firmar</p>
                </div>
            </div>

            {templates.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-slate-500 italic">No hay plantillas de documentos disponibles en este momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className="group p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:shadow-md transition-all flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 dark:text-white">{template.name}</h4>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                        {template.category}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => handleGenerateClick(template.id)}
                                disabled={generating !== null}
                                className={`p-2 rounded-lg transition-colors ${generating === template.id
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                                    }`}
                            >
                                {generating === template.id ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <Printer size={18} />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Dialog */}
            {showDialog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl w-full max-w-3xl h-[75vh] border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                        <div className="mb-6">
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                {showDialog === 'epi' ? 'Asignación de EPIs' : (showDialog === 'uniform' ? 'Asignación de Uniforme' : 'Datos del Dispositivo')}
                            </h3>
                            <p className="text-slate-500 text-xs mt-1">Selecciona los materiales y especifica las tallas para el acta de entrega.</p>
                        </div>

                        {showDialog === 'epi' || showDialog === 'uniform' ? (
                            <form onSubmit={handleItemSubmit} className="space-y-4 overflow-y-auto pr-2">
                                <div className="space-y-3">
                                    {inventory
                                        .filter(item => showDialog === 'epi' ? item.category === 'EPI' : ['UNIFORM', 'UNIFORME', 'CLOTHING'].includes(item.category))
                                        .map(item => {
                                            const typePrefix = showDialog === 'epi' ? 'epi_' : 'uniform_';
                                            const sizePrefix = showDialog === 'epi' ? 'size_' : 'size_u_';
                                            return (
                                                <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl group hover:bg-white dark:hover:bg-slate-750 transition-all border border-transparent hover:border-blue-100 dark:hover:border-blue-900/30">
                                                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                                                        <input
                                                            type="checkbox"
                                                            onChange={(e) => setFormData({ ...formData, [`${typePrefix}${item.id}`]: e.target.checked })}
                                                            className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</span>
                                                            <span className="text-[10px] text-slate-500 font-medium">Disp: {item.quantity}</span>
                                                        </div>
                                                    </label>
                                                    {formData[`${typePrefix}${item.id}`] && (
                                                        <input
                                                            type="text"
                                                            placeholder="Talla"
                                                            className="w-20 px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 animate-in zoom-in-95 duration-200"
                                                            onChange={(e) => setFormData({ ...formData, [`${sizePrefix}${item.id}`]: e.target.value })}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    {inventory.filter(item => showDialog === 'epi' ? item.category === 'EPI' : ['UNIFORM', 'UNIFORME', 'CLOTHING'].includes(item.category)).length === 0 && (
                                        <div className="p-10 text-center opacity-50 italic text-sm">No hay materiales de este tipo registrados en el inventario</div>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Otro (Opcional)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Nombre del material..."
                                            className="flex-[2] p-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800"
                                            onChange={(e) => setFormData({ ...formData, customItem: e.target.value })}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Talla"
                                            className="flex-1 p-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800"
                                            onChange={(e) => setFormData({ ...formData, customSize: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-white dark:bg-slate-900">
                                    <button
                                        type="button"
                                        onClick={() => setShowDialog(null)}
                                        className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2 text-sm bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95"
                                    >
                                        Generar Documento
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleTechSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Nombre del Dispositivo</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: iPhone 13 Pro"
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                                        onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Número de Serie / IMEI</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: SN123456789"
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                                        onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                                    />
                                </div>
                                <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded border border-amber-100">
                                    Se incluirá automáticamente la cláusula de responsabilidad por pérdida, rotura o robo.
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowDialog(null)}
                                        className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        Generar
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl">
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    <strong>Nota:</strong> Los documentos generados se guardarán automáticamente en el <strong>Expediente Digital</strong> del empleado como documentos oficiales.
                </p>
            </div>

            <DocumentPreview
                isOpen={!!previewUrl}
                fileUrl={previewUrl || ''}
                title={previewTitle}
                onClose={() => setPreviewUrl(null)}
            />
        </div>
    );
}
