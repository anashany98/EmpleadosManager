import { useState, useEffect } from 'react';
import { X, Check, FileText, Shirt, ShieldCheck, Smartphone, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

interface OnboardingWizardProps {
    employeeId: string;
    employeeName: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function OnboardingWizard({ employeeId, employeeName, onClose, onSuccess }: OnboardingWizardProps) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [inventory, setInventory] = useState<any[]>([]);

    // Selection State
    const [docs, setDocs] = useState({
        nda: true,
        rgpd: true,
        model145: true
    });

    const [selectedUniforms, setSelectedUniforms] = useState<string[]>([]);
    const [selectedEpis, setSelectedEpis] = useState<string[]>([]);
    const [selectedTech, setSelectedTech] = useState<string>('');

    useEffect(() => {
        loadInventory();
    }, []);

    const loadInventory = async () => {
        try {
            const res = await api.get('/inventory');
            setInventory(res.data || []);
        } catch (err) {
            console.error('Error loading inventory', err);
        }
    };

    const handleStart = async () => {
        setLoading(true);
        try {
            const payload = {
                employeeId,
                options: {
                    documents: docs,
                    inventory: {
                        uniformIds: selectedUniforms,
                        epiIds: selectedEpis,
                        techItemId: selectedTech || undefined
                    }
                }
            };

            const res = await api.post('/onboarding/start', payload);

            // Show summary
            const results = res.data; // { documents: [], errors: [] }

            if (results.errors && results.errors.length > 0) {
                toast.warning(`Onboarding completado con alertas: ${results.errors.join(', ')}`);
            } else {
                toast.success(`Onboarding completado. Se han generado ${results.documents.length} documentos.`);
            }
            onSuccess();
        } catch (err: any) {
            toast.error('Error iniciando onboarding: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Helper to toggle items
    const toggleArrayItem = (id: string, current: string[], setFn: (v: string[]) => void) => {
        if (current.includes(id)) {
            setFn(current.filter(i => i !== id));
        } else {
            setFn([...current, id]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Sparkles className="text-blue-500" />
                            Onboarding Automático
                        </h2>
                        <p className="text-sm text-slate-500">Configura el pack de bienvenida para <span className="font-bold text-slate-800 dark:text-slate-200">{employeeName}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Step 1: Legal Documents */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">1</div>
                            <h3 className="font-bold text-lg">Documentación Legal</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-11">
                            {[
                                { id: 'nda', label: 'NDA (Confidencialidad)', icon: ShieldCheck },
                                { id: 'rgpd', label: 'Protección Datos (RGPD)', icon: Check },
                                { id: 'model145', label: 'Modelo 145 (IRPF)', icon: FileText }
                            ].map(doc => (
                                <label key={doc.id} className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col gap-2 ${docs[doc.id as keyof typeof docs] ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-700 hover:border-slate-200'}`}>
                                    <div className="flex justify-between items-start">
                                        <doc.icon className={docs[doc.id as keyof typeof docs] ? 'text-blue-500' : 'text-slate-400'} size={20} />
                                        <input
                                            type="checkbox"
                                            checked={docs[doc.id as keyof typeof docs]}
                                            onChange={e => setDocs({ ...docs, [doc.id]: e.target.checked })}
                                            className="w-4 h-4 accent-blue-500"
                                        />
                                    </div>
                                    <span className="text-xs font-bold">{doc.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Step 2: Inventory */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">2</div>
                            <h3 className="font-bold text-lg">Entrega de Material</h3>
                        </div>

                        <div className="pl-11 space-y-6">
                            {/* Uniforms */}
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Shirt size={14} /> Uniformes
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {inventory.filter(i => i.category === 'UNIFORM' && i.quantity > 0).map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => toggleArrayItem(item.id, selectedUniforms, setSelectedUniforms)}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${selectedUniforms.includes(item.id)
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                                }`}
                                        >
                                            {item.name} {item.size && `(${item.size})`}
                                        </button>
                                    ))}
                                    {inventory.filter(i => i.category === 'UNIFORM').length === 0 && <span className="text-sm text-slate-400 italic">Sin stock disponible</span>}
                                </div>
                            </div>

                            {/* Tech */}
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Smartphone size={14} /> Tecnología
                                </label>
                                <select
                                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium"
                                    value={selectedTech}
                                    onChange={e => setSelectedTech(e.target.value)}
                                >
                                    <option value="">-- Ninguno --</option>
                                    {inventory.filter(i => i.category !== 'UNIFORM' && i.category !== 'EPI').map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} (Stock: {item.quantity})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleStart}
                        disabled={loading}
                        className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        {loading ? 'Generando...' : 'Generar Pack Bienvenida'}
                    </button>
                </div>

            </div>
        </div>
    );
}
