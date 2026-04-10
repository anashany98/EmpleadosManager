import { MessageCircle, Plus, Trash2 } from 'lucide-react';
import { MUNICIPIOS_MALLORCA, PAISES, PROVINCIAS } from '../constants';
import type { EmployeeFormData } from '../types';

interface EmployeePersonalSectionProps {
    formData: EmployeeFormData;
    newContact: { name: string; phone: string; relationship: string };
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    setFormData: React.Dispatch<React.SetStateAction<EmployeeFormData>>;
    setNewContact: React.Dispatch<React.SetStateAction<{ name: string; phone: string; relationship: string }>>;
}

export function EmployeePersonalSection({
    formData,
    newContact,
    onChange,
    setFormData,
    setNewContact
}: EmployeePersonalSectionProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre <span className="text-red-500">*</span></label>
                <input name="firstName" value={formData.firstName} onChange={onChange} required className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="Ej: Juan" />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Apellidos <span className="text-red-500">*</span></label>
                <input name="lastName" value={formData.lastName} onChange={onChange} required className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="Ej: Pérez García" />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">DNI / NIE <span className="text-red-500">*</span></label>
                <input name="dni" value={formData.dni} onChange={onChange} required className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="12345678A" />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Caducidad DNI</label>
                <input type="date" name="dniExpiration" value={formData.dniExpiration} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Nacimiento</label>
                <input type="date" name="birthDate" value={formData.birthDate} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">País</label>
                    <select name="country" value={formData.country} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        {PAISES.map((country) => <option key={country} value={country}>{country}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Provincia</label>
                    {formData.country === 'España' ? (
                        <select name="province" value={formData.province} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                            <option value="">Seleccionar...</option>
                            {PROVINCIAS.map((province) => <option key={province} value={province}>{province}</option>)}
                        </select>
                    ) : (
                        <input name="province" value={formData.province} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="Provincia / Estado" />
                    )}
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Empadronado en</label>
                <input list="municipios-list" name="registeredIn" value={formData.registeredIn} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                <datalist id="municipios-list">
                    {MUNICIPIOS_MALLORCA.map((municipio) => <option key={municipio} value={municipio} />)}
                </datalist>
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                <input name="email" value={formData.email} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Teléfono</label>
                    {formData.phone && (
                        <a href={`https://api.whatsapp.com/send?phone=${formData.phone.replace(/\D/g, '').startsWith('34') ? '' : '34'}${formData.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-green-600 font-bold hover:underline flex items-center gap-1">
                            <MessageCircle size={10} /> WhatsApp
                        </a>
                    )}
                </div>
                <input name="phone" value={formData.phone} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Teléfono de Empresa</label>
                    {formData.companyPhone && (
                        <a href={`https://api.whatsapp.com/send?phone=${formData.companyPhone.replace(/\D/g, '').startsWith('34') ? '' : '34'}${formData.companyPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-green-600 font-bold hover:underline flex items-center gap-1">
                            <MessageCircle size={10} /> WhatsApp
                        </a>
                    )}
                </div>
                <input name="companyPhone" value={formData.companyPhone} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="Ej: 600..." />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Género</label>
                <select name="gender" value={formData.gender} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <option value="">No especificado</option>
                    <option value="MALE">Masculino</option>
                    <option value="FEMALE">Femenino</option>
                    <option value="OTHER">Otro</option>
                </select>
            </div>
            <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Dirección</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Calle / Número</label>
                        <input name="address" value={formData.address} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Ciudad</label>
                        <input name="city" value={formData.city} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Código Postal</label>
                        <input name="postalCode" value={formData.postalCode} onChange={onChange} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                    </div>
                </div>
            </div>
            <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-blue-600 dark:text-blue-400">Carnet de Conducir</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" name="drivingLicense" checked={formData.drivingLicense} onChange={onChange} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">¿Tiene carnet?</label>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de Carnet</label>
                        <input name="drivingLicenseType" value={formData.drivingLicenseType} onChange={onChange} disabled={!formData.drivingLicense} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-50" placeholder="Ej: B, C1..." />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Caducidad Carnet</label>
                        <input type="date" name="drivingLicenseExpiration" value={formData.drivingLicenseExpiration} onChange={onChange} disabled={!formData.drivingLicense} className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-50" />
                    </div>
                </div>
            </div>
            <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-red-600 dark:text-red-400">Contactos de Emergencia (Máx 5)</h4>
                    <span className="text-xs text-slate-500">{formData.emergencyContacts.length}/5</span>
                </div>
                <div className="space-y-3">
                    {formData.emergencyContacts.map((contact, index) => (
                        <div key={`${contact.name}-${contact.phone}-${index}`} className="flex gap-4 items-end bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex-1 space-y-1">
                                <label className="text-xs text-slate-500">Nombre</label>
                                <div className="font-medium text-slate-900 dark:text-slate-200">{contact.name}</div>
                            </div>
                            <div className="flex-1 space-y-1">
                                <label className="text-xs text-slate-500">Teléfono</label>
                                <div className="font-medium text-slate-900 dark:text-slate-200">{contact.phone}</div>
                            </div>
                            <div className="flex-1 space-y-1">
                                <label className="text-xs text-slate-500">Relación</label>
                                <div className="font-medium text-slate-900 dark:text-slate-200">{contact.relationship || '-'}</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const nextContacts = [...formData.emergencyContacts];
                                    nextContacts.splice(index, 1);
                                    setFormData((current) => ({ ...current, emergencyContacts: nextContacts }));
                                }}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>
                {formData.emergencyContacts.length < 5 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800 border-dashed">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Nombre</label>
                            <input value={newContact.name} onChange={(event) => setNewContact((current) => ({ ...current, name: event.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" placeholder="Nombre completo" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Teléfono</label>
                            <input value={newContact.phone} onChange={(event) => setNewContact((current) => ({ ...current, phone: event.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" placeholder="600..." />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Relación</label>
                            <input value={newContact.relationship} onChange={(event) => setNewContact((current) => ({ ...current, relationship: event.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" placeholder="Ej: Padre" />
                        </div>
                        <button
                            type="button"
                            disabled={!newContact.name || !newContact.phone}
                            onClick={() => {
                                setFormData((current) => ({
                                    ...current,
                                    emergencyContacts: [...current.emergencyContacts, newContact]
                                }));
                                setNewContact({ name: '', phone: '', relationship: '' });
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2 h-[38px]"
                        >
                            <Plus size={16} /> Añadir
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
