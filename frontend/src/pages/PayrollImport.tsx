import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileUp, ArrowRight, CheckCircle, RefreshCw, FileText, Table, Save, BookTemplate, Sparkles } from 'lucide-react';
import { api } from '../api/client';

type Step = 'UPLOAD' | 'MAP' | 'REVIEW';

export default function PayrollImport() {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('UPLOAD');
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [batchId, setBatchId] = useState<string | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [serverFilename, setServerFilename] = useState<string>('');

    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [stats, setStats] = useState<any>(null);

    // Automated Generation State
    const [autoYear, setAutoYear] = useState(new Date().getFullYear());
    const [autoMonth, setAutoMonth] = useState(new Date().getMonth()); // Previous month usually

    // Profile Management State
    const [profiles, setProfiles] = useState<any[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState<string>('');
    const [newProfileName, setNewProfileName] = useState<string>('');
    const [showSaveProfile, setShowSaveProfile] = useState(false);

    const requiredFields = [
        { key: 'employeeId', label: 'DNI / ID Empleado' },
        { key: 'employeeName', label: 'Nombre Empleado' },
        { key: 'subaccount465', label: 'Subcuenta (Opcional)' },
    ];

    const moneyFields = [
        { key: 'neto', label: 'Neto a Pagar' },
        { key: 'bruto', label: 'Total Devengado (Bruto)' },
        { key: 'ssEmpresa', label: 'Seg. Social Empresa' },
        { key: 'ssTrabajador', label: 'Seg. Social Trabajador' },
        { key: 'irpf', label: 'IRPF' },
    ];

    // Load profiles on mount
    useEffect(() => {
        loadProfiles();
    }, []);

    const loadProfiles = async () => {
        try {
            const res = await api.get('/mappings');
            setProfiles(res.data || res || []);
        } catch (err) {
            console.error('Error fetching profiles', err);
        }
    };

    const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const profileId = e.target.value;
        setSelectedProfileId(profileId);
        if (profileId) {
            const profile = profiles.find(p => p.id === profileId);
            if (profile && profile.rules) {
                setMapping(profile.rules);
            }
        } else {
            setMapping({});
        }
    };

    const saveProfile = async () => {
        if (!newProfileName) return;
        try {
            await api.post('/mappings', {
                name: newProfileName,
                rules: mapping
            });
            await loadProfiles();
            setNewProfileName('');
            setShowSaveProfile(false);
            alert('Perfil guardado correctamente');
        } catch (err) {
            alert('Error guardando perfil: ' + err);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const uploadFile = async () => {
        if (!file) return;
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/payroll/upload', formData);
            const data = res.data || res;
            setBatchId(data.batchId);
            setHeaders(data.headers);
            setServerFilename(data.filename);
            setStep('MAP');
        } catch (error) {
            alert('Error al subir: ' + error);
        } finally {
            setLoading(false);
        }
    };

    const applyMapping = async () => {
        if (!batchId) return;
        setLoading(true);
        try {
            const res = await api.post(`/payroll/${batchId}/map`, {
                mappingRules: mapping,
                filename: serverFilename
            });
            setStats(res.data || res);
            setStep('REVIEW');
        } catch (error) {
            alert('Error en mapeo: ' + error);
        } finally {
            setLoading(false);
        }
    };

    const generateFromKiosk = async () => {
        setLoading(true);
        try {
            const res = await api.post('/payroll/generate-from-kiosk', {
                year: autoYear,
                month: autoMonth,
                companyId: 'default'
            });
            const data = res.data?.data || res.data;
            setBatchId(data.id);
            setStats({ rowsCreated: 'Calculados' });
            setStep('REVIEW');
        } catch (error) {
            alert('Error al generar nóminas: ' + error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                        Importación de Nóminas
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Sigue los pasos para procesar el Excel mensual</p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${step === 'UPLOAD' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-slate-400'}`}>1. Subir</div>
                    <div className="w-4 h-0.5 bg-slate-200 dark:bg-slate-700"></div>
                    <div className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${step === 'MAP' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-slate-400'}`}>2. Mapear</div>
                    <div className="w-4 h-0.5 bg-slate-200 dark:bg-slate-700"></div>
                    <div className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${step === 'REVIEW' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'text-slate-400'}`}>3. Revisar</div>
                </div>
            </div>

            {step === 'UPLOAD' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 shadow-xl border border-slate-100 dark:border-slate-800 text-center space-y-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>

                        <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <Upload className="text-blue-600 dark:text-blue-400" size={40} />
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Sube tu archivo Excel de nóminas</h2>
                            <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto mt-2">
                                Arrastra tu archivo aquí o haz clic para seleccionar. Soportamos formatos .xlsx y .xls.
                            </p>
                        </div>

                        <div className="max-w-lg mx-auto relative group cursor-pointer">
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className={`
                border-2 border-dashed rounded-2xl p-10 transition-all duration-300
                ${file
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                `}>
                                {file ? (
                                    <div className="flex flex-col items-center gap-3 text-blue-700 dark:text-blue-300 animate-in zoom-in">
                                        <FileUp size={32} />
                                        <span className="font-semibold text-lg">{file.name}</span>
                                        <span className="text-sm opacity-70">{(file.size / 1024).toFixed(0)} KB • Listo para subir</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-blue-500 transition-colors">
                                        <FileText size={32} strokeWidth={1.5} />
                                        <span className="font-medium">Seleccionar archivo...</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={uploadFile}
                            disabled={!file || loading}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-10 py-3.5 rounded-xl font-semibold shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-all active:scale-95"
                        >
                            {loading ? 'Procesando...' : 'Comenzar Importación'}
                        </button>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/20 transition-colors duration-700"></div>

                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="space-y-4 text-center md:text-left">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                                    <Sparkles size={12} /> Nuevo: Generación Mágica
                                </div>
                                <h2 className="text-2xl font-black">¿Usas el Kiosco de Asistencia?</h2>
                                <p className="text-indigo-50/80 text-sm max-w-md">
                                    Genera las nóminas automáticamente basándote en las horas reales fichadas. Sin archivos, sin errores de mapeo.
                                </p>
                            </div>

                            <div className="bg-white/10 backdrop-blur-xl p-6 rounded-[2rem] border border-white/20 flex flex-col gap-4 w-full md:w-auto">
                                <div className="flex gap-2">
                                    <select
                                        className="bg-white/20 border-none rounded-xl text-sm font-bold p-2 text-white placeholder-white/50 focus:ring-2 focus:ring-white/30"
                                        value={autoYear}
                                        onChange={e => setAutoYear(Number(e.target.value))}
                                    >
                                        <option value={2025} className="text-slate-900">2025</option>
                                        <option value={2026} className="text-slate-900">2026</option>
                                    </select>
                                    <select
                                        className="bg-white/20 border-none rounded-xl text-sm font-bold p-2 text-white placeholder-white/50 focus:ring-2 focus:ring-white/30"
                                        value={autoMonth}
                                        onChange={e => setAutoMonth(Number(e.target.value))}
                                    >
                                        {Array.from({ length: 12 }).map((_, i) => (
                                            <option key={i + 1} value={i + 1} className="text-slate-900">
                                                {new Date(0, i).toLocaleString('es', { month: 'long' })}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={generateFromKiosk}
                                    disabled={loading}
                                    className="px-6 py-3 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-50 transition-colors active:scale-95"
                                >
                                    {loading ? 'Calculando...' : 'Generar Nóminas'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: MAP */}
            {step === 'MAP' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 border-b border-slate-100 dark:border-slate-800 pb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Table className="text-blue-500" />
                                Mapeo de Columnas
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Asocia las columnas de tu Excel "{file?.name}" con los campos del sistema.</p>
                        </div>

                        {/* Profile Selector */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                <BookTemplate size={18} />
                                <span className="text-sm font-medium">Cargar Perfil:</span>
                            </div>
                            <select
                                value={selectedProfileId}
                                onChange={handleProfileChange}
                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">-- Personalizado --</option>
                                {profiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-slate-800 dark:text-white font-semibold border-b border-slate-100 dark:border-slate-800 pb-2">
                                <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                                Datos del Empleado
                            </div>

                            {requiredFields.map(field => (
                                <div key={field.key} className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block">{field.label}</label>
                                    <div className="relative">
                                        <select
                                            value={mapping[field.key] || ''}
                                            className="w-full p-3 pl-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-shadow cursor-pointer appearance-none hover:bg-slate-100 dark:hover:bg-slate-700"
                                            onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                                        >
                                            <option value="">-- Ignorar --</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-slate-800 dark:text-white font-semibold border-b border-slate-100 dark:border-slate-800 pb-2">
                                <div className="w-1 h-6 bg-green-500 rounded-full"></div>
                                Importes Económicos
                            </div>

                            {moneyFields.map(field => (
                                <div key={field.key} className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block">{field.label}</label>
                                    <select
                                        value={mapping[field.key] || ''}
                                        className="w-full p-3 pl-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-green-500 text-slate-900 dark:text-white transition-shadow cursor-pointer appearance-none hover:bg-slate-100 dark:hover:bg-slate-700"
                                        onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                                    >
                                        <option value="">-- Ignorar --</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-10 flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-slate-100 dark:border-slate-800 gap-4">

                        {/* Save Profile Section */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            {!showSaveProfile ? (
                                <button
                                    onClick={() => setShowSaveProfile(true)}
                                    className="text-blue-600 dark:text-blue-400 font-medium text-sm flex items-center gap-1 hover:underline"
                                >
                                    <Save size={16} /> Guardar este mapeo como perfil
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 w-full">
                                    <input
                                        type="text"
                                        placeholder="Nombre del perfil (ej: Gestoría X)"
                                        className="flex-1 sm:w-64 p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm"
                                        value={newProfileName}
                                        onChange={(e) => setNewProfileName(e.target.value)}
                                    />
                                    <button
                                        onClick={saveProfile}
                                        disabled={!newProfileName}
                                        className="bg-blue-600 text-white p-2 rounded-lg disabled:opacity-50"
                                    >
                                        <Save size={16} />
                                    </button>
                                    <button
                                        onClick={() => setShowSaveProfile(false)}
                                        className="text-slate-400 hover:text-slate-600"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={applyMapping}
                            disabled={loading}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                        >
                            {loading ? <RefreshCw className="animate-spin" /> : <ArrowRight />}
                            Confirmar y Procesar
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 3: REVIEW */}
            {step === 'REVIEW' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 shadow-xl border border-slate-100 dark:border-slate-800 text-center animate-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <CheckCircle className="text-green-500 dark:text-green-400" size={48} />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-3">¡Importación Exitosa!</h2>
                    <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-md mx-auto text-lg">
                        Hemos procesado correctamente <span className="font-bold text-slate-900 dark:text-white">{stats?.rowsCreated}</span> nóminas del archivo.
                    </p>

                    <div className="flex justify-center gap-4">
                        <button
                            onClick={() => navigate(`/payroll/batch/${batchId}`)}
                            className="px-8 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold transition-colors">
                            Ver Detalle
                        </button>
                        <button
                            onClick={() => { setStep('UPLOAD'); setFile(null); }}
                            className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5"
                        >
                            Importar Otro Lote
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
