import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    ArrowLeft, Save, Loader2, Calculator, Info, Euro, CreditCard, Building,
    Clock, Plus, Trash2
} from 'lucide-react';

const PROVINCIAS = [
    'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Baleares', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Gerona', 'Granada', 'Guadalajara', 'Guipúzcoa', 'Huelva', 'Huesca', 'Jaén', 'La Coruña', 'La Rioja', 'Las Palmas', 'León', 'Lérida', 'Lugo', 'Madrid', 'Málaga', 'Murcia', 'Navarra', 'Orense', 'Palencia', 'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Vizcaya', 'Zamora', 'Zaragoza', 'Ceuta', 'Melilla'
];

const DEPARTAMENTOS = ['Ventas', 'Administración', 'Producción', 'Logística', 'IT', 'Recursos Humanos', 'Mantenimiento', 'Otros'];
const PUESTOS = ['Gerente', 'Director', 'Responsable', 'Técnico', 'Operario', 'Auxiliar', 'Administrativo', 'Vendedor', 'Otros'];
const CATEGORIAS = ['Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4', 'Grupo 5', 'Grupo 6', 'Grupo 7', 'Oficial de 1ª', 'Oficial de 2ª', 'Oficial de 3ª', 'Peón', 'Otros'];
const TIPOS_CONTRATO = ['Indefinido', 'Temporal', 'Fijo Discontinuo', 'Prácticas', 'Aprendizaje', 'Otros'];
const CONVENIOS = ['Comercio', 'Hostelería', 'Metal', 'Construcción', 'Oficinas y Despachos', 'Propio de Empresa', 'Otros'];
import VacationCalendar from '../components/VacationCalendar';
import { TimesheetViewer } from '../components/TimesheetViewer';
import DocumentArchive from '../components/DocumentArchive';
import PRLArchive from '../components/PRLArchive';
import ExpenseManager from '../components/ExpenseManager';

export default function EmployeeDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isNew = id === 'new';

    const [isEditing, setIsEditing] = useState(isNew);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('personal');
    const [companies, setCompanies] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        firstName: '', lastName: '', dni: '', email: '', phone: '', address: '', city: '', postalCode: '',
        subaccount465: '', socialSecurityNumber: '', iban: '',
        companyId: '', department: '', category: '', contractType: '', agreementType: '', jobTitle: '',
        entryDate: '', exitDate: '', callDate: '', contractInterruptionDate: '', lowDate: '', lowReason: '',
        dniExpiration: '', birthDate: '', province: '', registeredIn: '',
        drivingLicense: false, drivingLicenseType: '', drivingLicenseExpiration: '',
        emergencyContactName: '', emergencyContactPhone: '',
        workingDayType: 'COMPLETE',
        weeklyHours: '',
        active: true
    });

    // Mock data for aggregation/view mode
    const [employeeView, setEmployeeView] = useState<any>(null);

    useEffect(() => {
        fetchCompanies();
        if (!isNew && id) {
            fetchEmployee();
            fetchAuditLogs();
        }
    }, [id]);

    const fetchAuditLogs = async () => {
        if (isNew) return;
        try {
            await api.get(`/audit/EMPLOYEE/${id}`);
            // Logs are currently not displayed in UI, but endpoint is kept for reference
        } catch (err) { console.error(err); }
    };

    const fetchCompanies = async () => {
        try {
            const data = await api.get('/companies');
            setCompanies(data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchEmployee = async () => {
        try {
            const data = await api.get(`/employees/${id}`);
            setEmployeeView(data);
            // Pre-fill form data for editing
            setFormData({
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                dni: data.dni || '',
                email: data.email || '',
                phone: data.phone || '',
                address: data.address || '',
                city: data.city || '',
                postalCode: data.postalCode || '',
                subaccount465: data.subaccount465 || '',
                socialSecurityNumber: data.socialSecurityNumber || '',
                iban: data.iban || '',
                companyId: data.companyId || '',
                department: data.department || '',
                category: data.category || '',
                contractType: data.contractType || '',
                agreementType: data.agreementType || '',
                jobTitle: data.jobTitle || '',
                entryDate: data.entryDate ? data.entryDate.split('T')[0] : (data.seniorityDate ? data.seniorityDate.split('T')[0] : ''),
                exitDate: data.exitDate ? data.exitDate.split('T')[0] : '',
                callDate: data.callDate ? data.callDate.split('T')[0] : '',
                contractInterruptionDate: data.contractInterruptionDate ? data.contractInterruptionDate.split('T')[0] : '',
                lowDate: data.lowDate ? data.lowDate.split('T')[0] : '',
                lowReason: data.lowReason || '',
                dniExpiration: data.dniExpiration ? data.dniExpiration.split('T')[0] : '',
                birthDate: data.birthDate ? data.birthDate.split('T')[0] : '',
                province: data.province || '',
                registeredIn: data.registeredIn || '',
                drivingLicense: data.drivingLicense || false,
                drivingLicenseType: data.drivingLicenseType || '',
                drivingLicenseExpiration: data.drivingLicenseExpiration ? data.drivingLicenseExpiration.split('T')[0] : '',
                emergencyContactName: data.emergencyContactName || '',
                emergencyContactPhone: data.emergencyContactPhone || '',
                workingDayType: data.workingDayType || 'COMPLETE',
                weeklyHours: data.weeklyHours || '',
                active: data.active
            });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (isNew) {
                await api.post('/employees', formData);
                toast.success('Empleado creado correctamente');
                navigate('/employees');
            } else {
                await api.put(`/employees/${id}`, formData);
                toast.success('Empleado actualizado correctamente');
                setIsEditing(false);
                fetchEmployee();
            }
        } catch (error: any) {
            toast.error('Error al guardar: ' + (error.response?.data?.error || error.message));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 text-center animate-pulse text-slate-500">Cargando perfil...</div>;

    // --- VIEW MODE ---
    if (!isEditing && employeeView) {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <Link to="/employees" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-500 transition-colors">
                    <ArrowLeft size={16} /> Volver a Empleados
                </Link>

                {/* Header Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                            {employeeView.firstName?.charAt(0) || employeeView.name?.charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                                {employeeView.firstName || employeeView.lastName
                                    ? `${employeeView.firstName || ''} ${employeeView.lastName || ''}`.trim()
                                    : employeeView.name}
                            </h1>
                            <div className="flex items-center gap-4 mt-2 text-slate-500 dark:text-slate-400 text-sm">
                                <span className="flex items-center gap-1"><CreditCard size={14} /> {employeeView.dni}</span>
                                <span className="flex items-center gap-1"><Building size={14} /> {employeeView.department}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30">
                            Editar Perfil
                        </button>
                    </div>
                </div>

                {/* Tabs for View Mode */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="border-b border-slate-100 dark:border-slate-800">
                        <div className="flex overflow-x-auto">
                            {['resumen', 'expediente', 'prl', 'fichajes', 'gastos', 'vacaciones'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'personal' && tab === 'resumen' || activeTab === tab
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                >
                                    {tab === 'prl' ? 'PRL / Formación' : (tab.charAt(0).toUpperCase() + tab.slice(1))}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-8">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                {(activeTab === 'resumen' || activeTab === 'personal') && (
                                    <div className="space-y-8">
                                        {/* Stats Cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                                                <p className="text-slate-500 text-sm font-medium mb-1">Subcuenta Contable</p>
                                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{employeeView.subaccount465}</h3>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                                                <p className="text-slate-500 text-sm font-medium mb-1">Cupo Vacaciones</p>
                                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{employeeView.vacationDaysTotal || 30} días</h3>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                                                <p className="text-slate-500 text-sm font-medium mb-1">Antigüedad</p>
                                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                                    {employeeView.entryDate ? new Date(employeeView.entryDate).toLocaleDateString() : (employeeView.seniorityDate ? new Date(employeeView.seniorityDate).toLocaleDateString() : '--')}
                                                </h3>
                                            </div>
                                        </div>

                                        <SalaryCalculator />
                                        <OvertimeTracker employeeId={id || ''} category={employeeView.category} />
                                    </div>
                                )}

                                {activeTab === 'expediente' && <DocumentArchive employeeId={id || ''} />}
                                {activeTab === 'prl' && <PRLArchive employeeId={id || ''} />}
                                {activeTab === 'fichajes' && <TimesheetViewer employeeId={id || ''} />}
                                {activeTab === 'gastos' && <ExpenseManager employeeId={id || ''} isAdmin={true} />}
                                {activeTab === 'vacaciones' && <VacationCalendar employeeId={id || ''} />}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        );
    }

    // --- EDIT / CREATE MODE ---
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <Link to="/employees" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-500 transition-colors">
                    <ArrowLeft size={16} /> Cancelar y Volver
                </Link>
                <div className="flex gap-3">
                    <button type="button" onClick={() => isNew ? navigate('/employees') : setIsEditing(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        Cancelar
                    </button>
                    <button disabled={saving} onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex items-center gap-2 disabled:opacity-50">
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {isNew ? 'Crear Empleado' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="border-b border-slate-100 dark:border-slate-800">
                    <div className="flex overflow-x-auto">
                        {['personal', 'laboral', 'financiero', 'fechas', 'expediente', 'prl'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >

                                {tab === 'prl' ? 'PRL / Formación' : (tab.charAt(0).toUpperCase() + tab.slice(1))}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-8 min-h-[400px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <form className="max-w-4xl mx-auto space-y-8">
                                {/* PERSONAL TAB */}
                                {activeTab === 'personal' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
                                            <input name="firstName" value={formData.firstName} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="Ej: Juan" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Apellidos</label>
                                            <input name="lastName" value={formData.lastName} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="Ej: Pérez García" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">DNI / NIE</label>
                                            <input name="dni" value={formData.dni} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="12345678A" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Caducidad DNI</label>
                                            <input type="date" name="dniExpiration" value={formData.dniExpiration} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Nacimiento</label>
                                            <input type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Provincia</label>
                                            <select name="province" value={formData.province} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                <option value="">Seleccionar...</option>
                                                {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Empadronado en</label>
                                            <input name="registeredIn" value={formData.registeredIn} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                                            <input name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Teléfono</label>
                                            <input name="phone" value={formData.phone} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                        </div>

                                        <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Dirección</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="md:col-span-1 space-y-2">
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Calle / Número</label>
                                                    <input name="address" value={formData.address} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Ciudad</label>
                                                    <input name="city" value={formData.city} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Código Postal</label>
                                                    <input name="postalCode" value={formData.postalCode} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-blue-600 dark:text-blue-400">Carnet de Conducir</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="flex items-center gap-2">
                                                    <input type="checkbox" name="drivingLicense" checked={formData.drivingLicense} onChange={handleChange} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">¿Tiene carnet?</label>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de Carnet</label>
                                                    <input name="drivingLicenseType" value={formData.drivingLicenseType} onChange={handleChange} disabled={!formData.drivingLicense} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-50" placeholder="Ej: B, C1..." />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Caducidad Carnet</label>
                                                    <input type="date" name="drivingLicenseExpiration" value={formData.drivingLicenseExpiration} onChange={handleChange} disabled={!formData.drivingLicense} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-50" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-red-600 dark:text-red-400">Contacto de Emergencia</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre de Contacto</label>
                                                    <input name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Teléfono Emergencia</label>
                                                    <input name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* LABORAL TAB */}
                                {activeTab === 'laboral' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Empresa / Centro</label>
                                            <select
                                                name="companyId"
                                                value={formData.companyId}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                            >
                                                <option value="">Seleccionar empresa...</option>
                                                {companies.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Departamento</label>
                                            <select name="department" value={formData.department} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                <option value="">Seleccionar...</option>
                                                {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Puesto (Job Title)</label>
                                            <select name="jobTitle" value={formData.jobTitle} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                <option value="">Seleccionar...</option>
                                                {PUESTOS.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Categoría</label>
                                            <select name="category" value={formData.category} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                <option value="">Seleccionar...</option>
                                                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo Contrato</label>
                                            <select name="contractType" value={formData.contractType} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                <option value="">Seleccionar...</option>
                                                {TIPOS_CONTRATO.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Convenio</label>
                                            <select name="agreementType" value={formData.agreementType} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                <option value="">Seleccionar...</option>
                                                {CONVENIOS.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* FINANCIERO TAB */}
                                {activeTab === 'financiero' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Subcuenta Contable (465)</label>
                                            <input name="subaccount465" value={formData.subaccount465} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">IBAN</label>
                                            <input name="iban" value={formData.iban} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                        </div>
                                    </div>
                                )}

                                {/* FECHAS TAB */}
                                {activeTab === 'fechas' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Entrada / Antigüedad</label>
                                            <input type="date" name="entryDate" value={formData.entryDate} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                        </div>
                                        {formData.contractType === 'Fijo Discontinuo' && (
                                            <>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Llamamiento</label>
                                                    <input type="date" name="callDate" value={formData.callDate} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Interrupción de Contrato</label>
                                                    <input type="date" name="contractInterruptionDate" value={formData.contractInterruptionDate} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                                </div>
                                            </>
                                        )}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Baja</label>
                                            <input type="date" name="lowDate" value={formData.lowDate} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Motivo Baja</label>
                                            <input name="lowReason" value={formData.lowReason} onChange={handleChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                                        </div>
                                    </div>
                                )}

                                {/* OTHER TABS (Read-only components) */}
                                {activeTab === 'expediente' && !isNew && (
                                    <div className="animate-in fade-in duration-300">
                                        <DocumentArchive employeeId={id || ''} />
                                    </div>
                                )}

                                {activeTab === 'prl' && !isNew && (
                                    <div className="animate-in fade-in duration-300">
                                        <PRLArchive employeeId={id || ''} />
                                    </div>
                                )}
                            </form>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                    {/* Footer actions duplicated for convenience */}
                </div>
            </div>
        </div>
    );
}

function OvertimeTracker({ employeeId, category }: { employeeId: string, category: string }) {
    const [hours, setHours] = useState<number>(0);
    const [rate, setRate] = useState<number>(0);
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRateAndEntries();
    }, [employeeId, category]);

    const fetchRateAndEntries = async () => {
        setLoading(true);
        try {
            // Get category rates
            const rates = await api.get('/overtime/rates');
            const catRate = rates.find((r: any) => r.category === category);
            setRate(catRate?.overtimeRate || 0);

            // Get entries
            const data = await api.get(`/overtime/employee/${employeeId}`);
            setEntries(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (hours <= 0) return;
        try {
            await api.post('/overtime', { employeeId, hours, rate });
            toast.success('Horas extras registradas');
            setHours(0);
            fetchRateAndEntries();
        } catch (error) {
            toast.error('Error al registrar horas');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/overtime/${id}`);
            toast.success('Registro eliminado');
            fetchRateAndEntries();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500 rounded-lg text-white">
                        <Clock size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registro de Horas Extras</h2>
                        <p className="text-slate-500 text-sm">Categoría: <span className="font-semibold text-amber-600">{category || 'Sin categoría'}</span> · Tarifa: <span className="font-semibold">{formatCurrency(rate)}/h</span></p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Añadir Horas</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={hours || ''}
                                onChange={(e) => setHours(parseFloat(e.target.value))}
                                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="Horas..."
                            />
                            <button
                                onClick={handleAdd}
                                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2"
                            >
                                <Plus size={18} /> Añadir
                            </button>
                        </div>
                        {hours > 0 && (
                            <p className="mt-2 text-xs text-slate-500 italic">
                                Total a pagar: {formatCurrency(hours * rate)}
                            </p>
                        )}
                    </div>

                    <div className="p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-900/10">
                        <h4 className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1">Nota importante</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                            Las tarifas se configuran en el apartado de Ajustes del sistema según el convenio vigente.
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800 relative min-h-[200px]">
                        {loading && (
                            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-10">
                                <Loader2 className="animate-spin text-amber-500" size={32} />
                            </div>
                        )}
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3 text-center">Horas</th>
                                    <th className="px-4 py-3 text-center">Precio/h</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {!loading && entries.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No hay horas extras registradas</td>
                                    </tr>
                                ) : (
                                    entries.map(entry => (
                                        <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                {new Date(entry.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">
                                                {entry.hours}h
                                            </td>
                                            <td className="px-4 py-3 text-center text-slate-500">
                                                {formatCurrency(entry.rate)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-600">
                                                {formatCurrency(entry.total)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => handleDelete(entry.id)} className="text-slate-300 hover:text-red-500 p-1">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SalaryCalculator() {
    const [monthlyGross, setMonthlyGross] = useState<number>(0);
    const [payments, setPayments] = useState<number>(12);

    const annual = monthlyGross * payments;
    const weekly = annual / 52.14;
    const daily = weekly / 5; // labor days
    const hourly = weekly / 40;
    const minute = hourly / 60;

    const format = (val: number) =>
        new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(val);

    return (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900/20 rounded-2xl p-8 border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-600 rounded-lg text-white">
                    <Calculator size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Calculadora de Coste Salarial (Bruto)</h2>
                    <p className="text-slate-500 text-sm">Desglose rápido para simulación de costes</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Mensual Bruto (€)</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={monthlyGross || ''}
                                onChange={(e) => setMonthlyGross(Number(e.target.value))}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-lg font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="0.00"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <Euro size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Pagas:</span>
                        <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-lg">
                            {[12, 14].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPayments(p)}
                                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${payments === p
                                        ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                        <div className="group relative">
                            <Info size={14} className="text-slate-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-xs rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                Incluye pagas extra prorrateadas en el cálculo anual.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-blue-50 dark:border-blue-900/20">
                        <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Anual</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{format(annual)}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-blue-50 dark:border-blue-900/20">
                        <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Semanal</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{format(weekly)}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-blue-50 dark:border-blue-900/20">
                        <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Diario</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{format(daily)}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-blue-50 dark:border-blue-900/20 text-blue-600">
                        <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Hora</p>
                        <p className="text-xl font-bold">{format(hourly)}</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-600/5 dark:bg-blue-400/5 rounded-xl border border-blue-100 dark:border-blue-900/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                        min
                    </div>
                    <div>
                        <p className="text-slate-500 text-xs font-medium">Coste por Minuto</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{format(minute)}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-slate-400 text-[10px] italic">Basado en jornada estándar (40h/sem)</p>
                </div>
            </div>
        </div>
    );
}
