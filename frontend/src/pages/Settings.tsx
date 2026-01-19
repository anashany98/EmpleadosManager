import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Settings, DollarSign, Upload, AlertCircle, Folder, Mail, Save, Send } from 'lucide-react';
import ChecklistManager from '../components/onboarding/ChecklistManager';
import BackupManager from '../components/BackupManager';

const CATEGORIAS = ['Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4', 'Grupo 5', 'Grupo 6', 'Grupo 7', 'Oficial de 1ª', 'Oficial de 2ª', 'Oficial de 3ª', 'Peón', 'Otros'];

export default function SettingsPage() {
    const [rates, setRates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [savingInbox, setSavingInbox] = useState(false);
    const [savingSmtp, setSavingSmtp] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);

    // Inbox config state
    const [inboxConfig, setInboxConfig] = useState({
        scannerPath: 'backend/data/inbox',
        emailEnabled: false,
        imap: {
            host: '',
            port: 993,
            user: '',
            password: '',
            tls: true
        }
    });

    // SMTP Config State
    const [smtpConfig, setSmtpConfig] = useState({
        host: '',
        port: 587,
        secure: false, // TLS
        user: '',
        pass: '',
        from: '"NominasApp" <noreply@nominasapp.com>'
    });
    const [testEmail, setTestEmail] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [ratesRes, configRes, smtpRes] = await Promise.all([
                api.get('/overtime/rates'),
                api.get('/config/inbox_settings'),
                api.get('/config/smtp').catch(() => ({ data: {} })) // Handle error if route not ready
            ]);
            setRates(ratesRes.data || ratesRes || []);
            if (configRes.data) {
                setInboxConfig(prev => ({ ...prev, ...configRes.data }));
            }
            if (smtpRes.data && smtpRes.data.success) {
                const s = smtpRes.data.data;
                setSmtpConfig({
                    host: s.SMTP_HOST || '',
                    port: parseInt(s.SMTP_PORT) || 587,
                    secure: s.SMTP_SECURE === 'true',
                    user: s.SMTP_USER || '',
                    pass: s.SMTP_PASS || '',
                    from: s.SMTP_FROM || ''
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveInboxConfig = async () => {
        setSavingInbox(true);
        try {
            await api.post('/config/inbox_settings', inboxConfig);
            toast.success('Configuración de bandeja de entrada guardada');
        } catch (error) {
            toast.error('Error al guardar configuración');
        } finally {
            setSavingInbox(false);
        }
    };

    const handleSaveSmtpConfig = async () => {
        setSavingSmtp(true);
        try {
            await api.post('/config/smtp', smtpConfig);
            toast.success('Configuración SMTP guardada');
        } catch (error) {
            toast.error('Error al guardar SMTP');
        } finally {
            setSavingSmtp(false);
        }
    };

    const handleTestEmail = async () => {
        if (!testEmail) {
            toast.error('Introduce un email para la prueba');
            return;
        }
        setSendingTest(true);
        try {
            const res = await api.post('/config/smtp/test', { to: testEmail });
            if (res.data.data?.previewUrl) {
                toast.success('Correo Fake enviado. Mira la consola para el link (Ethereal)');
                window.open(res.data.data.previewUrl, '_blank');
            } else {
                toast.success('Correo enviado correctamente');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error al enviar prueba');
        } finally {
            setSendingTest(false);
        }
    };

    const handleUpdateRate = async (category: string, normal: number, holiday: number) => {
        try {
            await api.post('/overtime/rates', { category, overtimeRate: normal, holidayOvertimeRate: holiday });
            toast.success(`Tarifas de ${category} actualizadas`);
            fetchData();
        } catch (error) {
            toast.error('Error al actualizar tarifas');
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/overtime/import', formData);
            const result = res.data || res;

            // Mostrar resultado principal
            toast.success(result.message || `${result.imported || 0} registros importados`);

            // Mostrar errores si los hay
            if (result.errors?.length > 0) {
                console.error('❌ Errores de importación:', result.errors);
                toast.error(`${result.errors.length} filas con errores. Revisa la consola para más detalles.`, {
                    duration: 5000
                });
                // Mostrar primeros 3 errores
                result.errors.slice(0, 3).forEach((err: string) => {
                    toast.error(err, { duration: 4000 });
                });
            }

            // Mostrar info de filas saltadas
            if (result.skipped?.length > 0) {
                console.info('ℹ️ Filas saltadas:', result.skipped);
                toast.info(`${result.skipped.length} filas saltadas (sin horas extras o datos vacíos)`, {
                    duration: 3000
                });
            }
        } catch (error: any) {
            console.error('Error en importación:', error);
            toast.error('Error importando el archivo. Revisa la consola para más detalles.');
        } finally {
            setImporting(false);
            if (e.target) e.target.value = '';
        }
    };

    if (loading) return <div className="p-10 text-center animate-pulse">Cargando configuración...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-600 rounded-lg text-white">
                    <Settings size={24} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Configuración del Sistema</h1>
                    <p className="text-slate-500">Gestiona las tarifas y preferencias globales</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-3">
                    <DollarSign className="text-blue-500" size={20} />
                    <h2 className="font-bold text-slate-900 dark:text-white text-lg">Tarifas de Horas Extras por Categoría</h2>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {CATEGORIAS.map(cat => {
                            const rate = rates.find(r => r.category === cat);
                            return (
                                <div key={cat} className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                    <label className="text-sm font-black text-slate-900 dark:text-white border-l-4 border-blue-500 pl-3 block">{cat}</label>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Día Normal</span>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    defaultValue={rate?.overtimeRate || 0}
                                                    onBlur={(e) => handleUpdateRate(cat, parseFloat(e.target.value), rate?.holidayOvertimeRate || 0)}
                                                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 font-bold text-blue-600 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                />
                                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">€</div>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-amber-500 uppercase">Festivo / Finde</span>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    defaultValue={rate?.holidayOvertimeRate || 0}
                                                    onBlur={(e) => handleUpdateRate(cat, rate?.overtimeRate || 0, parseFloat(e.target.value))}
                                                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-amber-50/20 dark:bg-amber-900/10 font-bold text-amber-600 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                                />
                                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-amber-400 text-[10px] font-bold">€</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Importador de Horas Extras */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Upload className="text-indigo-500" size={20} />
                        <h2 className="font-bold text-slate-900 dark:text-white text-lg">Importador de Horas de Fichaje</h2>
                    </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                            Sube el archivo Excel exportado de tu sistema de fichajes. El sistema identificará a los empleados por su <b>DNI</b> y registrará las horas de la columna <b>Extr</b>.
                        </p>
                        <div className="flex gap-4">
                            <label className={`
                                flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all
                                ${importing ? 'opacity-50 cursor-wait' : 'hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800'}
                                border-slate-200 dark:border-slate-700
                            `}>
                                <Upload className={`mb-2 ${importing ? 'animate-bounce text-indigo-500' : 'text-slate-400'}`} size={32} />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {importing ? 'Procesando archivo...' : 'Seleccionar Excel de Fichajes'}
                                </span>
                                <p className="text-xs text-slate-400 mt-1">Formato .xlsx o .xls</p>
                                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImport} disabled={importing} />
                            </label>
                        </div>
                    </div>

                    <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-sm">
                            <AlertCircle size={18} />
                            <span>Requisitos del Excel</span>
                        </div>
                        <ul className="text-sm text-blue-600/80 dark:text-blue-400/70 space-y-2">
                            <li className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-blue-400 rounded-full" />
                                Columna <b>DNI</b> para identificar al empleado
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-blue-400 rounded-full" />
                                Columna <b>Fecha</b> (formato día/mes/año)
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-blue-400 rounded-full" />
                                Columna <b>Extr</b> para las horas extras
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-blue-400 rounded-full" />
                                Máximo 5MB por archivo
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Configuración de Correo (SMTP) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Mail className="text-orange-500" size={20} />
                        <h2 className="font-bold text-slate-900 dark:text-white text-lg">Configuración de Envío de Correos (SMTP)</h2>
                    </div>
                    <button
                        onClick={handleSaveSmtpConfig}
                        disabled={savingSmtp}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                    >
                        <Save size={18} />
                        {savingSmtp ? 'Guardando...' : 'Guardar SMTP'}
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Servidor SMTP</label>
                                <input
                                    type="text"
                                    value={smtpConfig.host}
                                    onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                                    placeholder={!smtpConfig.host ? "Ej: smtp.gmail.com (Vacío = Modo Fake)" : ""}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
                                />
                                <p className="text-[10px] text-slate-400 mt-1 italic">Si dejas esto vacío, el sistema usará una cuenta "Fake" de Ethereal.</p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Puerto</label>
                                <input
                                    type="number"
                                    value={smtpConfig.port}
                                    onChange={(e) => setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Usuario</label>
                                <input
                                    type="text"
                                    value={smtpConfig.user}
                                    onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Contraseña</label>
                                <input
                                    type="password"
                                    value={smtpConfig.pass}
                                    onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Remitente (From)</label>
                                <input
                                    type="text"
                                    value={smtpConfig.from}
                                    onChange={(e) => setSmtpConfig({ ...smtpConfig, from: e.target.value })}
                                    placeholder='"Nombre" <email@dom.com>'
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
                                />
                            </div>
                            <div className="flex items-center pt-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={smtpConfig.secure}
                                        onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Usar SSL/TLS</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                            <Send size={16} />
                            Probar Configuración
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                placeholder="tu-email@ejemplo.com"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
                            />
                            <button
                                onClick={handleTestEmail}
                                disabled={sendingTest}
                                className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                            >
                                {sendingTest ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Send size={16} />
                                )}
                                Enviar
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            Se enviará un correo de prueba al email indicado usando la configuración actual guardada.
                        </p>
                    </div>
                </div>
            </div>

            {/* Configuración de Bandeja de Entrada */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Folder className="text-blue-500" size={20} />
                        <h2 className="font-bold text-slate-900 dark:text-white text-lg">Configuración de Bandeja de Entrada (IMAP)</h2>
                    </div>
                    <button
                        onClick={handleSaveInboxConfig}
                        disabled={savingInbox}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                    >
                        <Save size={18} />
                        {savingInbox ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Scanner Config */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Folder size={18} className="text-slate-400" />
                                Escáner y Servidor
                            </h3>
                            <div className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Ruta de Monitorización</label>
                                    <input
                                        type="text"
                                        value={inboxConfig.scannerPath}
                                        onChange={(e) => setInboxConfig({ ...inboxConfig, scannerPath: e.target.value })}
                                        placeholder="Ej: backend/data/inbox"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-2 italic">Ruta relativa a la raíz del backend donde el escáner deposita los PDF.</p>
                                </div>
                            </div>
                        </div>

                        {/* Email Config (IMAP) */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Mail size={18} className="text-slate-400" />
                                Recepción por Email (IMAP)
                            </h3>
                            <div className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={inboxConfig.emailEnabled}
                                        onChange={(e) => setInboxConfig({ ...inboxConfig, emailEnabled: e.target.checked })}
                                        className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 text-sm">Habilitar recepción por correo</span>
                                </label>

                                {inboxConfig.emailEnabled && (
                                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Servidor IMAP</label>
                                                <input
                                                    type="text"
                                                    value={inboxConfig.imap.host}
                                                    onChange={(e) => setInboxConfig({ ...inboxConfig, imap: { ...inboxConfig.imap, host: e.target.value } })}
                                                    placeholder="imap.gmail.com"
                                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Puerto</label>
                                                <input
                                                    type="number"
                                                    value={inboxConfig.imap.port}
                                                    onChange={(e) => setInboxConfig({ ...inboxConfig, imap: { ...inboxConfig.imap, port: parseInt(e.target.value) } })}
                                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Usuario / Email</label>
                                                <input
                                                    type="text"
                                                    value={inboxConfig.imap.user}
                                                    onChange={(e) => setInboxConfig({ ...inboxConfig, imap: { ...inboxConfig.imap, user: e.target.value } })}
                                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Contraseña</label>
                                                <input
                                                    type="password"
                                                    value={inboxConfig.imap.password}
                                                    onChange={(e) => setInboxConfig({ ...inboxConfig, imap: { ...inboxConfig.imap, password: e.target.value } })}
                                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Onboarding Templates */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-6">
                <ChecklistManager />
            </div>

            {/* Backups */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <BackupManager />
            </div>

        </div>
    );
}
