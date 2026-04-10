import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Mail, Phone, Save, Shield, User } from 'lucide-react';

interface EmergencyContact {
    name: string;
    phone: string;
    relationship?: string;
}

interface SelfProfile {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    dni?: string;
    department?: string;
    jobTitle?: string;
    entryDate?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    province?: string;
    country?: string;
    emergencyContacts?: EmergencyContact[];
}

interface EditableProfileForm {
    phone: string;
    address: string;
    city: string;
    postalCode: string;
    province: string;
    country: string;
    emergencyContacts: EmergencyContact[];
}

const EMPTY_CONTACT: EmergencyContact = {
    name: '',
    phone: '',
    relationship: ''
};

function toEditableForm(profile: SelfProfile): EditableProfileForm {
    return {
        phone: profile.phone || '',
        address: profile.address || '',
        city: profile.city || '',
        postalCode: profile.postalCode || '',
        province: profile.province || '',
        country: profile.country || 'España',
        emergencyContacts: profile.emergencyContacts?.length ? profile.emergencyContacts : [EMPTY_CONTACT]
    };
}

export default function MyProfilePage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<SelfProfile | null>(null);
    const [form, setForm] = useState<EditableProfileForm | null>(null);

    useEffect(() => {
        const loadProfile = async () => {
            if (!user?.employeeId) {
                setLoading(false);
                return;
            }

            try {
                const response = await api.get(`/employees/${user.employeeId}`);
                const data = response.data || response;
                setProfile(data);
                setForm(toEditableForm(data));
            } catch (error) {
                console.error(error);
                toast.error('No se pudo cargar tu perfil');
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [user?.employeeId]);

    const updateField = (field: keyof EditableProfileForm, value: string) => {
        setForm((current) => current ? { ...current, [field]: value } : current);
    };

    const updateContact = (index: number, field: keyof EmergencyContact, value: string) => {
        setForm((current) => {
            if (!current) {
                return current;
            }

            const nextContacts = current.emergencyContacts.map((contact, contactIndex) =>
                contactIndex === index ? { ...contact, [field]: value } : contact
            );

            return {
                ...current,
                emergencyContacts: nextContacts
            };
        });
    };

    const addContact = () => {
        setForm((current) => {
            if (!current || current.emergencyContacts.length >= 5) {
                return current;
            }

            return {
                ...current,
                emergencyContacts: [...current.emergencyContacts, { ...EMPTY_CONTACT }]
            };
        });
    };

    const removeContact = (index: number) => {
        setForm((current) => {
            if (!current) {
                return current;
            }

            const nextContacts = current.emergencyContacts.filter((_, contactIndex) => contactIndex !== index);

            return {
                ...current,
                emergencyContacts: nextContacts.length ? nextContacts : [{ ...EMPTY_CONTACT }]
            };
        });
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user?.employeeId || !form) {
            return;
        }

        setSaving(true);
        try {
            const payload = {
                phone: form.phone,
                address: form.address,
                city: form.city,
                postalCode: form.postalCode,
                province: form.province,
                country: form.country,
                emergencyContacts: form.emergencyContacts.filter((contact) => contact.name.trim() || contact.phone.trim())
            };

            const response = await api.put(`/employees/${user.employeeId}`, payload);
            const updatedProfile = response.data || response;
            setProfile(updatedProfile);
            setForm(toEditableForm(updatedProfile));
            toast.success('Perfil actualizado');
        } catch (error) {
            console.error(error);
            toast.error('No se pudo guardar tu perfil');
        } finally {
            setSaving(false);
        }
    };

    if (!user?.employeeId) {
        return <div className="p-8 text-center text-slate-500">No tienes un perfil de empleado asociado.</div>;
    }

    if (loading || !form || !profile) {
        return (
            <div className="flex min-h-[320px] items-center justify-center">
                <div className="flex items-center gap-3 text-slate-500">
                    <Loader2 className="animate-spin text-blue-600" size={22} />
                    Cargando perfil...
                </div>
            </div>
        );
    }

    const fullName = profile.name || `${profile.firstName || ''} ${profile.lastName || ''}`.trim();

    return (
        <div className="mx-auto max-w-5xl space-y-6 p-6">
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-8 py-8 text-white">
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white">
                                <User size={28} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight">{fullName || 'Mi perfil'}</h1>
                                <div className="mt-2 flex flex-wrap gap-3 text-sm text-blue-100">
                                    {profile.jobTitle && <span>{profile.jobTitle}</span>}
                                    {profile.department && <span>{profile.department}</span>}
                                    {profile.dni && <span>DNI {profile.dni}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-blue-50">
                            <div className="font-semibold">Alcance de autoservicio</div>
                            <div className="mt-1 text-blue-100">Solo puedes editar contacto y emergencias.</div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 px-8 py-6 md:grid-cols-3">
                    <InfoTile icon={<Mail size={16} />} label="Email" value={profile.email || 'No disponible'} />
                    <InfoTile icon={<Phone size={16} />} label="Telefono" value={profile.phone || 'Sin registrar'} />
                    <InfoTile icon={<Shield size={16} />} label="Alta" value={profile.entryDate ? new Date(profile.entryDate).toLocaleDateString() : 'No disponible'} />
                </div>
            </section>

            <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-slate-900">Contacto</h2>
                        <p className="text-sm text-slate-500">Mantén actualizados tus datos de contacto personales.</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Telefono">
                            <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} className={inputClassName} />
                        </Field>
                        <Field label="Pais">
                            <input value={form.country} onChange={(event) => updateField('country', event.target.value)} className={inputClassName} />
                        </Field>
                        <Field label="Direccion" fullWidth>
                            <input value={form.address} onChange={(event) => updateField('address', event.target.value)} className={inputClassName} />
                        </Field>
                        <Field label="Ciudad">
                            <input value={form.city} onChange={(event) => updateField('city', event.target.value)} className={inputClassName} />
                        </Field>
                        <Field label="Provincia">
                            <input value={form.province} onChange={(event) => updateField('province', event.target.value)} className={inputClassName} />
                        </Field>
                        <Field label="Codigo postal">
                            <input value={form.postalCode} onChange={(event) => updateField('postalCode', event.target.value)} className={inputClassName} />
                        </Field>
                    </div>
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-6 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Emergencias</h2>
                            <p className="text-sm text-slate-500">Hasta 5 contactos para incidencias o PRL.</p>
                        </div>
                        <button
                            type="button"
                            onClick={addContact}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Añadir
                        </button>
                    </div>

                    <div className="space-y-4">
                        {form.emergencyContacts.map((contact, index) => (
                            <div key={`${index}-${contact.name}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="text-sm font-semibold text-slate-700">Contacto {index + 1}</span>
                                    {form.emergencyContacts.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeContact(index)}
                                            className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                        >
                                            Eliminar
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <input
                                        value={contact.name}
                                        onChange={(event) => updateContact(index, 'name', event.target.value)}
                                        placeholder="Nombre"
                                        className={inputClassName}
                                    />
                                    <input
                                        value={contact.phone}
                                        onChange={(event) => updateContact(index, 'phone', event.target.value)}
                                        placeholder="Telefono"
                                        className={inputClassName}
                                    />
                                    <input
                                        value={contact.relationship || ''}
                                        onChange={(event) => updateContact(index, 'relationship', event.target.value)}
                                        placeholder="Relacion"
                                        className={inputClassName}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="lg:col-span-2 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Guardar cambios
                    </button>
                </div>
            </form>
        </div>
    );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {icon}
                {label}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-800">{value}</div>
        </div>
    );
}

function Field({
    children,
    label,
    fullWidth
}: {
    children: React.ReactNode;
    label: string;
    fullWidth?: boolean;
}) {
    return (
        <label className={`space-y-1 ${fullWidth ? 'md:col-span-2' : ''}`}>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
            {children}
        </label>
    );
}

const inputClassName =
    'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20';
