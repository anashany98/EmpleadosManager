import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { toast } from 'sonner';
import { api } from '../../../api/client';
import { createDefaultEmployeeFormData } from '../types';
import type {
    CompanyOption,
    EmployeeFieldOptions,
    EmployeeFormData,
    EmployeeOption,
    EmployeeViewRecord,
    NewEmergencyContact
} from '../types';

interface UseEmployeeDetailOptions {
    employeeId?: string;
    isAdmin: boolean;
    isNew: boolean;
    navigate: (path: string) => void;
}

type GenerateAccessResponse = {
    data?: {
        hasEmail?: boolean;
        password?: string;
    };
};

type PrivateNotesSaveResponse = {
    message?: string;
    data?: {
        privateNotes?: string;
    };
};

type ApiErrorLike = Error & {
    response?: {
        data?: {
            error?: string;
            details?: unknown;
        };
    };
};

function extractResponseData<T>(response: T | { data?: T }): T | undefined {
    if (response && typeof response === 'object' && 'data' in response) {
        return (response as { data?: T }).data;
    }

    return response;
}

function extractArray<T>(response: unknown): T[] {
    const data = extractResponseData<T[]>(response as T[] | { data?: T[] });
    return Array.isArray(data) ? data : [];
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export function useEmployeeDetail({ employeeId, isAdmin, isNew, navigate }: UseEmployeeDetailOptions) {
    const [isEditing, setIsEditing] = useState(isNew);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState(isNew ? 'personal' : 'resumen');
    const [generatingAccess, setGeneratingAccess] = useState(false);
    const [showFaceEnroll, setShowFaceEnroll] = useState(false);
    const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
    const [showOffboardingWizard, setShowOffboardingWizard] = useState(false);
    const [formData, setFormData] = useState<EmployeeFormData>(createDefaultEmployeeFormData());
    const [newContact, setNewContact] = useState<NewEmergencyContact>({ name: '', phone: '', relationship: '' });
    const [employeeView, setEmployeeView] = useState<EmployeeViewRecord | null>(null);
    const [companies, setCompanies] = useState<CompanyOption[]>([]);
    const [allEmployees, setAllEmployees] = useState<EmployeeOption[]>([]);
    const [fieldOptions, setFieldOptions] = useState<EmployeeFieldOptions>({
        departments: [],
        categories: [],
        jobTitles: [],
        contractTypes: [],
        agreementTypes: []
    });

    const enterEditMode = () => {
        setActiveTab('personal');
        setIsEditing(true);
    };

    const exitEditMode = () => {
        setIsEditing(false);
        setActiveTab('resumen');
    };

    const handleGenerateAccess = useCallback(async () => {
        setGeneratingAccess(true);
        try {
            const res = await api.post<GenerateAccessResponse>('/auth/generate-access', { employeeId });
            if (res.data?.hasEmail) {
                toast.success('Disfruta del acceso. Se ha enviado un correo al empleado.');
            } else {
                toast.success(`Clave generada: ${res.data?.password}`, { duration: 10000 });
            }
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Error al generar acceso'));
        } finally {
            setGeneratingAccess(false);
        }
    }, [employeeId]);

    const handlePrivateNotesSave = useCallback(async () => {
        if (!employeeId) {
            return;
        }

        setSaving(true);
        try {
            const response = await api.put<PrivateNotesSaveResponse>(`/employees/${employeeId}/private-notes`, {
                note: formData.privateNotes
            });
            const savedNotes = extractResponseData<{ privateNotes?: string }>(response)?.privateNotes ?? formData.privateNotes;

            setFormData((current) => ({
                ...current,
                privateNotes: savedNotes || ''
            }));
            setEmployeeView((current) => current ? {
                ...current,
                privateNotes: savedNotes || ''
            } : current);

            toast.success(response.message || 'Notas RRHH guardadas');
        } catch (error: unknown) {
            const apiError = error as ApiErrorLike;
            toast.error(`Error al guardar las notas RRHH: ${apiError.response?.data?.error || getErrorMessage(error, 'Error desconocido')}`);
            throw error;
        } finally {
            setSaving(false);
        }
    }, [employeeId, formData.privateNotes]);

    const fetchAllEmployees = useCallback(async () => {
        if (!isAdmin) return;
        try {
            const employees = extractArray<EmployeeOption>(await api.get('/employees'));
            setAllEmployees(employees.filter((employee) => employee.id !== employeeId));
        } catch (error) {
            console.error(error);
        }
    }, [employeeId, isAdmin]);

    const fetchAuditLogs = useCallback(async () => {
        if (isNew || !isAdmin || !employeeId) return;
        try {
            await api.get(`/audit/EMPLOYEE/${employeeId}`);
        } catch (error) {
            console.error(error);
        }
    }, [employeeId, isAdmin, isNew]);

    const fetchCompanies = useCallback(async () => {
        if (!isAdmin) return;
        try {
            setCompanies(extractArray<CompanyOption>(await api.get('/companies')));
        } catch (error) {
            console.error(error);
        }
    }, [isAdmin]);

    const fetchFieldOptions = useCallback(async () => {
        if (!isAdmin) return;
        try {
            const response = await api.get('/employees/options');
            const data = extractResponseData<EmployeeFieldOptions>(response);
            if (data) {
                setFieldOptions({
                    departments: data.departments || [],
                    categories: data.categories || [],
                    jobTitles: data.jobTitles || [],
                    contractTypes: data.contractTypes || [],
                    agreementTypes: data.agreementTypes || []
                });
            }
        } catch (error) {
            console.error(error);
        }
    }, [isAdmin]);

    const fetchEmployee = useCallback(async () => {
        try {
            const data = extractResponseData<EmployeeViewRecord>(await api.get(`/employees/${employeeId}`));
            if (!data) {
                throw new Error('Empleado no encontrado');
            }
            setEmployeeView(data);
            setFormData({
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                dni: data.dni || '',
                email: data.email || '',
                phone: data.phone || '',
                companyPhone: data.companyPhone || '',
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
                country: data.country || 'España',
                province: data.province || '',
                registeredIn: data.registeredIn || '',
                drivingLicense: data.drivingLicense || false,
                drivingLicenseType: data.drivingLicenseType || '',
                drivingLicenseExpiration: data.drivingLicenseExpiration ? data.drivingLicenseExpiration.split('T')[0] : '',
                emergencyContacts: data.emergencyContacts || [],
                workingDayType: data.workingDayType || 'COMPLETE',
                weeklyHours: data.weeklyHours !== undefined && data.weeklyHours !== null ? String(data.weeklyHours) : '',
                gender: data.gender || '',
                annualGrossSalary: data.annualGrossSalary !== undefined && data.annualGrossSalary !== null ? String(data.annualGrossSalary) : '',
                monthlyGrossSalary: data.monthlyGrossSalary !== undefined && data.monthlyGrossSalary !== null ? String(data.monthlyGrossSalary) : '',
                managerId: data.managerId || '',
                privateNotes: data.privateNotes || '',
                active: data.active ?? true
            });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    useEffect(() => {
        if (isAdmin) {
            void fetchCompanies();
            void fetchAllEmployees();
            void fetchFieldOptions();
        }

        if (!isNew && employeeId) {
            void fetchEmployee();
            if (isAdmin) {
                void fetchAuditLogs();
            }
        } else {
            setLoading(false);
        }
    }, [employeeId, fetchAllEmployees, fetchAuditLogs, fetchCompanies, fetchEmployee, fetchFieldOptions, isAdmin, isNew]);

    const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = event.target;

        if (type === 'checkbox') {
            const checked = (event.target as HTMLInputElement).checked;
            setFormData((current) => ({ ...current, [name]: checked }));
            return;
        }

        setFormData((current) => {
            const next = { ...current, [name]: value };

            if (name === 'annualGrossSalary' && value) {
                const annual = parseFloat(value);
                if (!Number.isNaN(annual)) {
                    next.monthlyGrossSalary = (annual / 12).toFixed(2);
                }
            } else if (name === 'monthlyGrossSalary' && value) {
                const monthly = parseFloat(value);
                if (!Number.isNaN(monthly)) {
                    next.annualGrossSalary = (monthly * 12).toFixed(2);
                }
            }

            return next;
        });
    };

    const handleSubmit = async (event?: FormEvent) => {
        if (event && event.preventDefault) {
            event.preventDefault();
        }

        setSaving(true);
        try {
            const payload = {
                ...formData,
                email: formData.email || null,
                weeklyHours: formData.weeklyHours ? Number(formData.weeklyHours) : null,
                companyId: formData.companyId || null,
                managerId: formData.managerId || null,
                annualGrossSalary: formData.annualGrossSalary ? Number(formData.annualGrossSalary) : 0,
                monthlyGrossSalary: formData.monthlyGrossSalary ? Number(formData.monthlyGrossSalary) : 0
            };

            if (isNew) {
                await api.post('/employees', payload);
                toast.success('Empleado creado correctamente');
                navigate('/employees');
                return;
            }

            await api.put(`/employees/${employeeId}`, payload);
            toast.success('Empleado actualizado correctamente');
            exitEditMode();
            void fetchEmployee();
        } catch (error: unknown) {
            const apiError = error as ApiErrorLike;
            toast.error(`Error al guardar: ${apiError.response?.data?.error || getErrorMessage(error, 'Error desconocido')}`);
            if (apiError.response?.data?.details) {
                console.error('Validation Details:', apiError.response.data.details);
            }
        } finally {
            setSaving(false);
        }
    };

    return {
        isEditing,
        loading,
        saving,
        activeTab,
        generatingAccess,
        showFaceEnroll,
        showOnboardingWizard,
        showOffboardingWizard,
        formData,
        newContact,
        employeeView,
        companies,
        allEmployees,
        fieldOptions,
        setActiveTab,
        setShowFaceEnroll,
        setShowOnboardingWizard,
        setShowOffboardingWizard,
        setFormData,
        setEmployeeView,
        setNewContact,
        handleChange,
        handleSubmit,
        handlePrivateNotesSave,
        handleGenerateAccess,
        enterEditMode,
        exitEditMode
    };
}
