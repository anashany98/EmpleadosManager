// ... imports
import { useState, useEffect } from 'react';
import { FileText, ShieldCheck, Shirt, Smartphone, Loader2, Search, Check, AlertCircle, Sparkles, MapPin, Lock, Scale } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

interface DocumentGeneratorProps {
    employeeId: string;
    onDocumentGenerated?: () => void;
}

type DocType = 'UNIFORM' | 'EPI' | 'TECH_DEVICE' | 'MODEL_145' | 'NDA' | 'RGPD';

export default function DocumentGenerator({ employeeId, onDocumentGenerated }: DocumentGeneratorProps) {
    const [loading, setLoading] = useState(false);
    const [docType, setDocType] = useState<DocType>('UNIFORM');
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [authorName, setAuthorName] = useState('');

    // Tech Device State
    const [selectedTechItem, setSelectedTechItem] = useState<any>(null);
    const [deviceName, setDeviceName] = useState('');
    const [serialNumber, setSerialNumber] = useState('');

    const [itemSearch, setItemSearch] = useState('');

    useEffect(() => {
        loadInventory();
        loadDefaultSettings();
    }, [employeeId]);

    const loadInventory = async () => {
        try {
            const res = await api.get('/inventory');
            setInventoryItems(res.data || []);
        } catch (err) {
            console.error('Error loading inventory', err);
        }
    };

    const loadDefaultSettings = async () => {
        try {
            const res = await api.get(`/employees/${employeeId}`);
            const emp = res.data || res;
            if (emp.company?.legalRep) setAuthorName(emp.company.legalRep);
        } catch (err) {
            console.error('Error loading employee info', err);
        }
    };

    const handleGenerate = async () => {
        setLoading(true);
        try {
            let endpoint = '';
            let payload: any = { employeeId, authorName };

            switch (docType) {
                case 'UNIFORM':
                    endpoint = '/documents/generate-uniform';
                    // Pass ID for accurate stock deduction
                    payload.items = selectedItems.map(i => ({ id: i.id, name: i.name, size: i.size || '' }));
                    break;
                case 'EPI':
                    endpoint = '/documents/generate-epi';
                    payload.items = selectedItems.map(i => ({ id: i.id, name: i.name, size: i.size || '' }));
                    break;
                case 'TECH_DEVICE':
                    endpoint = '/documents/generate-tech';
                    payload.deviceName = deviceName;
                    payload.serialNumber = serialNumber;
                    if (selectedTechItem) {
                        payload.itemId = selectedTechItem.id; // Link to stock
                    }
                    break;
                case 'MODEL_145':
                    endpoint = '/documents/generate-145';
                    break;
                case 'NDA':
                    endpoint = '/documents/generate-nda';
                    break;
                case 'RGPD':
                    endpoint = '/documents/generate-rgpd';
                    break;
            }

            await api.post(endpoint, payload);
            toast.success('Documento generado correctamente');
            if (onDocumentGenerated) onDocumentGenerated();
        } catch (err: any) {
            toast.error('Error generating document: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleItem = (item: any) => {
        if (selectedItems.find(i => i.id === item.id)) {
            setSelectedItems(selectedItems.filter(i => i.id !== item.id));
        } else {
            setSelectedItems([...selectedItems, { ...item, size: '' }]);
        }
    };

    const updateItemSize = (id: string, size: string) => {
        setSelectedItems(selectedItems.map(i => i.id === id ? { ...i, size } : i));
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header / Type Selector */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { id: 'UNIFORM', icon: Shirt, label: 'Uniforme', color: 'blue' },
                    { id: 'EPI', icon: ShieldCheck, label: 'EPIS', color: 'orange' },
                    { id: 'TECH_DEVICE', icon: Smartphone, label: 'Tecnología', color: 'purple' },
                    { id: 'MODEL_145', icon: FileText, label: 'Modelo 145', color: 'emerald' },
                    { id: 'NDA', icon: Lock, label: 'Confidencialidad', color: 'red' },
                    { id: 'RGPD', icon: Scale, label: 'Datos (RGPD)', color: 'indigo' }
                ].map((type) => (
                    <button
                        key={type.id}
                        onClick={() => setDocType(type.id as DocType)}
                        className={`p-4 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-2 text-center group ${docType === type.id
                            ? `bg-${type.color}-50 dark:bg-${type.color}-950/20 border-${type.color}-500 text-${type.color}-600 dark:text-${type.color}-400 shadow-xl shadow-${type.color}-500/10`
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 hover:border-slate-200 dark:hover:border-slate-700'
                            }`}
                    >
                        <div className={`p-2.5 rounded-2xl transition-all ${docType === type.id ? `bg-${type.color}-500 text-white` : 'bg-slate-50 dark:bg-slate-800'}`}>
                            {/* @ts-ignore */}
                            <type.icon size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">{type.label}</span>
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-xl border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

                <div className="relative z-10 space-y-8">
                    {/* Common Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Autoriza el documento</label>
                            <input
                                value={authorName}
                                onChange={e => setAuthorName(e.target.value)}
                                className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                placeholder="Nombre del Responsable"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ubicación de firma</label>
                            <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 text-slate-500">
                                <MapPin size={16} />
                                <span className="text-sm font-bold">Auto-detectado por Empresa</span>
                            </div>
                        </div>
                    </div>

                    {/* Specific Doc Type Fields */}
                    {(docType === 'UNIFORM' || docType === 'EPI') && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seleccionar Material a Entregar</label>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Buscar en inventario..."
                                        className="w-full pl-12 pr-5 py-4 rounded-3xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                        value={itemSearch}
                                        onChange={e => setItemSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1 accent-blue-600">
                                {inventoryItems
                                    .filter(i => (docType === 'UNIFORM' ? i.category === 'UNIFORM' : i.category === 'EPI'))
                                    .filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()))
                                    .map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => toggleItem(item)}
                                            className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between group ${selectedItems.find(si => si.id === item.id)
                                                ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500'
                                                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
                                                }`}
                                        >
                                            <div>
                                                <p className={`font-bold text-sm ${selectedItems.find(si => si.id === item.id) ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>{item.name}</p>
                                                <p className="text-[10px] text-slate-400">Stock: {item.quantity} {item.unit}</p>
                                            </div>
                                            {selectedItems.find(si => si.id === item.id) && <Check size={16} className="text-blue-500" />}
                                        </button>
                                    ))}
                            </div>

                            {selectedItems.length > 0 && (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Configurar Tallas / Notas</label>
                                    {selectedItems.map(item => (
                                        <div key={item.id} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                            <span className="flex-1 font-bold text-sm">{item.name}</span>
                                            <input
                                                placeholder="Talla (opcional)"
                                                className="w-32 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border-none text-xs font-bold"
                                                value={item.size || ''}
                                                onChange={e => updateItemSize(item.id, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {docType === 'TECH_DEVICE' && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">

                            {/* Inventory Selection for Tech */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vincular con Inventario (Opcional)</label>
                                <select
                                    className="w-full px-5 py-4 rounded-3xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-purple-500 text-sm font-bold"
                                    onChange={(e) => {
                                        const item = inventoryItems.find(i => i.id === e.target.value);
                                        setSelectedTechItem(item || null);
                                        if (item) {
                                            setDeviceName(item.name);
                                            // You might auto-fill serial number if inventory tracked it, but inventory usually doesn't track SN per SKU unless serialized assets
                                        }
                                    }}
                                >
                                    <option value="">-- Seleccionar del stock --</option>
                                    {inventoryItems
                                        .filter(i => i.category === 'TECH' || i.category === 'OTHER')
                                        .map(i => (
                                            <option key={i.id} value={i.id}>{i.name} (Stock: {i.quantity})</option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dispositivo</label>
                                    <input
                                        value={deviceName}
                                        onChange={e => setDeviceName(e.target.value)}
                                        className="w-full px-5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 text-sm font-bold"
                                        placeholder="Ej: Laptop HP, iPhone 13..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">S/N o IMEI</label>
                                    <input
                                        value={serialNumber}
                                        onChange={e => setSerialNumber(e.target.value)}
                                        className="w-full px-5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 text-sm font-bold"
                                        placeholder="Número de serie"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* NDA / RGPD / Model 145 Infos */}
                    {['MODEL_145', 'NDA', 'RGPD'].includes(docType) && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-300">
                            <div className={`p-3 rounded-2xl text-white ${docType === 'NDA' ? 'bg-red-500' :
                                    docType === 'RGPD' ? 'bg-indigo-500' : 'bg-emerald-500'
                                }`}>
                                {docType === 'NDA' ? <Lock size={24} /> :
                                    docType === 'RGPD' ? <Scale size={24} /> : <AlertCircle size={24} />}
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white text-sm">
                                    {docType === 'NDA' ? 'Acuerdo de Confidencialidad' :
                                        docType === 'RGPD' ? 'Protección de Datos (RGPD)' : 'Modelo 145 (IRPF)'}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {docType === 'NDA' ? 'Genera un contrato de confidencialidad estándar listo para firmar.' :
                                        docType === 'RGPD' ? 'Cláusula informativa sobre el tratamiento de datos personales.' : 'Autocompletado con los datos fiscales actuales.'}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                        <button
                            onClick={handleGenerate}
                            disabled={loading || (docType === 'TECH_DEVICE' && !deviceName)}
                            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-3 disabled:opacity-50 group active:scale-95"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Sparkles className="group-hover:animate-pulse" />}
                            {loading ? 'Generando...' : 'Generar Documento'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
