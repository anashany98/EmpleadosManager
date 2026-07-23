import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../../api/client';
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

function formDataFromEmployee(data: EmployeeViewRecord): EmployeeFormData {
    return {
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
        entryDate: data.entryDate ? data.entryDate.split('T')[0] : '',
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
        active: data.active ?? true,
        vacationDaysTotal: data.vacationDaysTotal !== undefined && data.vacationDaysTotal !== null ? String(data.vacationDaysTotal) : ''
    };
}

export function useEmployeeDetail({ employeeId, isAdmin, isNew, navigate }: UseEmployeeDetailOptions) {
    const queryClient = useQueryClient();

    // --- UI state (not server-derived) ---
    const [isEditing, setIsEditing] = useState(isNew);
    const [activeTab, setActiveTab] = useState(isNew ? 'personal' : 'resumen');
    const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
    const [showOffboardingWizard, setShowOffboardingWizard] = useState(false);
    const [newContact, setNewContact] = useState<NewEmergencyContact>({ name: '', phone: '', relationship: '' });

    // --- Queries ---

    const employeeQuery = useQuery({
        queryKey: ['employee', employeeId],
        queryFn: async () => {
            const data = extractResponseData<EmployeeViewRecord>(await api.get(`/employees/${employeeId}`));
            if (!data) throw new Error('Empleado no encontrado');
            return data;
        },
        enabled: !isNew && !!employeeId,
        staleTime: 2 * 60 * 1000,
    });

    const companiesQuery = useQuery({
        queryKey: ['companies'],
        queryFn: async () => extractArray<CompanyOption>(await api.get('/companies')),
        enabled: isAdmin,
        staleTime: 5 * 60 * 1000,
    });

    const allEmployeesQuery = useQuery({
        queryKey: ['employees-list-for-manager'],
        queryFn: async () => {
            const all = extractArray<EmployeeOption>(await api.get('/employees'));
            return all.filter(e => e.id !== employeeId);
        },
        enabled: isAdmin,
        staleTime: 2 * 60 * 1000,
    });

    const fieldOptionsQuery = useQuery({
        queryKey: ['employee-field-options'],
        queryFn: async () => {
            const response = await api.get('/employees/options');
            const data = extractResponseData<EmployeeFieldOptions>(response);
            return {
                departments: data?.departments || [],
                categories: data?.categories || [],
                jobTitles: data?.jobTitles || [],
                contractTypes: data?.contractTypes || [],
                agreementTypes: data?.agreementTypes || []
            };
        },
        enabled: isAdmin,
        staleTime: 5 * 60 * 1000,
    });

    const auditLogsQuery = useQuery({
        queryKey: ['audit-logs', 'EMPLOYEE', employeeId],
        queryFn: async () => {
            await api.get(`/audit/EMPLOYEE/${employeeId}`);
        },
        enabled: !!employeeId && isAdmin && !isNew,
        staleTime: 60 * 1000,
    });

    // --- Sync formData from employee query data ---
    const [formData, setFormData] = useState<EmployeeFormData>(createDefaultEmployeeFormData());

    useEffect(() => {
        if (employeeQuery.data) {
            setFormData(formDataFromEmployee(employeeQuery.data));
        }
    }, [employeeQuery.data]);

    // --- Mutations ---

    const updateEmployeeMutation = useMutation({
        mutationFn: async (payload: Record<string, unknown>) => {
            await api.put(`/employees/${employeeId}`, payload);
        },
        onSuccess: () => {
            toast.success('Empleado actualizado correctamente');
            queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
            setIsEditing(false);
            setActiveTab('resumen');
        },
        onError: (error: unknown) => {
            toast.error(`Error al guardar: ${getErrorMessage(error, 'Error desconocido')}`);
        },
    });

    const createEmployeeMutation = useMutation({
        mutationFn: async (payload: Record<string, unknown>) => {
            await api.post('/employees', payload);
        },
        onSuccess: () => {
            toast.success('Empleado creado correctamente');
            navigate('/employees');
        },
        onError: (error: unknown) => {
            toast.error(`Error al guardar: ${getErrorMessage(error, 'Error desconocido')}`);
        },
    });

    const saveNotesMutation = useMutation({
        mutationFn: async (note: string) => {
            const response = await api.put<PrivateNotesSaveResponse>(`/employees/${employeeId}/private-notes`, { note });
            return response;
        },
        onSuccess: (response) => {
            const savedNotes = extractResponseData<{ privateNotes?: string }>(response)?.privateNotes ?? formData.privateNotes;
            setFormData(current => ({ ...current, privateNotes: savedNotes || '' }));
            queryClient.setQueryData<EmployeeViewRecord>(['employee', employeeId], old =>
                old ? { ...old, privateNotes: savedNotes || '' } : old
            );
            toast.success(response.message || 'Notas RRHH guardadas');
        },
        onError: (error: unknown) => {
            toast.error(`Error al guardar las notas RRHH: ${getErrorMessage(error, 'Error desconocido')}`);
        },
    });

    const generateAccessMutation = useMutation({
        mutationFn: async () => {
            return api.post<GenerateAccessResponse>('/auth/generate-access', { employeeId });
        },
        onSuccess: (res) => {
            if (res.data?.hasEmail) {
                toast.success('Disfruta del acceso. Se ha enviado un correo al empleado.');
            } else {
                toast.success(`Clave generada: ${res.data?.password}`, { duration: 10000 });
            }
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, 'Error al generar acceso'));
        },
    });

    // --- UI handlers ---

    const enterEditMode = () => {
        setActiveTab('personal');
        setIsEditing(true);
    };

    const exitEditMode = () => {
        setIsEditing(false);
        setActiveTab('resumen');
    };

    const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = event.target;

        if (type === 'checkbox') {
            const checked = (event.target as HTMLInputElement).checked;
            setFormData(current => ({ ...current, [name]: checked }));
            return;
        }

        setFormData(current => {
            const next = { ...current, [name]: value };
            if (name === 'annualGrossSalary' && value) {
                const annual = parseFloat(value);
                if (!Number.isNaN(annual)) next.monthlyGrossSalary = (annual / 12).toFixed(2);
            } else if (name === 'monthlyGrossSalary' && value) {
                const monthly = parseFloat(value);
                if (!Number.isNaN(monthly)) next.annualGrossSalary = (monthly * 12).toFixed(2);
            }
            return next;
        });
    };

    const handleSubmit = async (event?: FormEvent) => {
        if (event?.preventDefault) event.preventDefault();

        const toNullIfEmpty = (value: unknown) =>
            typeof value === 'string' && value.trim() === '' ? null : value;

        const payload = {
            ...formData,
            dni: formData.dni,
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: toNullIfEmpty(formData.email),
            phone: toNullIfEmpty(formData.phone),
            companyPhone: toNullIfEmpty(formData.companyPhone),
            companyShortPhone: toNullIfEmpty(formData.companyShortPhone),
            address: toNullIfEmpty(formData.address),
            city: toNullIfEmpty(formData.city),
            postalCode: toNullIfEmpty(formData.postalCode),
            socialSecurityNumber: toNullIfEmpty(formData.socialSecurityNumber),
            subaccount465: toNullIfEmpty(formData.subaccount465),
            iban: toNullIfEmpty(formData.iban),
            department: toNullIfEmpty(formData.department),
            category: toNullIfEmpty(formData.category),
            contractType: toNullIfEmpty(formData.contractType),
            agreementType: toNullIfEmpty(formData.agreementType),
            jobTitle: toNullIfEmpty(formData.jobTitle),
            entryDate: toNullIfEmpty(formData.entryDate),
            exitDate: toNullIfEmpty(formData.exitDate),
            callDate: toNullIfEmpty(formData.callDate),
            contractInterruptionDate: toNullIfEmpty(formData.contractInterruptionDate),
            lowDate: toNullIfEmpty(formData.lowDate),
            lowReason: toNullIfEmpty(formData.lowReason),
            dniExpiration: toNullIfEmpty(formData.dniExpiration),
            birthDate: toNullIfEmpty(formData.birthDate),
            province: toNullIfEmpty(formData.province),
            registeredIn: toNullIfEmpty(formData.registeredIn),
            drivingLicenseType: toNullIfEmpty(formData.drivingLicenseType),
            drivingLicenseExpiration: toNullIfEmpty(formData.drivingLicenseExpiration),
            gender: toNullIfEmpty(formData.gender),
            workingDayType: toNullIfEmpty(formData.workingDayType),
            weeklyHours: formData.weeklyHours ? Number(formData.weeklyHours) : null,
            companyId: formData.companyId || null,
            managerId: formData.managerId || null,
            annualGrossSalary: formData.annualGrossSalary ? Number(formData.annualGrossSalary) : 0,
            monthlyGrossSalary: formData.monthlyGrossSalary ? Number(formData.monthlyGrossSalary) : 0,
            annualTotalSalary: formData.annualTotalSalary ? Number(formData.annualTotalSalary) : 0,
            monthlyTotalSalary: formData.monthlyTotalSalary ? Number(formData.monthlyTotalSalary) : 0,
            vacationDaysTotal: formData.vacationDaysTotal ? Number(formData.vacationDaysTotal) : null,
            vacationYear: formData.vacationYear ? Number(formData.vacationYear) : null,
            vacationAnnualQuota: formData.vacationAnnualQuota ? Number(formData.vacationAnnualQuota) : null,
            vacationCarryOver: formData.vacationCarryOver ? Number(formData.vacationCarryOver) : null,
            vacationImportedUsed: formData.vacationImportedUsed ? Number(formData.vacationImportedUsed) : null,
            emergencyContacts: formData.emergencyContacts.map(contact => ({
                name: contact.name,
                phone: toNullIfEmpty(contact.phone),
                relationship: toNullIfEmpty(contact.relationship)
            }))
        };

        if (isNew) {
            createEmployeeMutation.mutate(payload);
        } else {
            updateEmployeeMutation.mutate(payload);
        }
    };

    // --- Loading state ---
    const loading = employeeQuery.isLoading && !isNew;

    return {
        isEditing,
        loading,
        saving: updateEmployeeMutation.isPending || createEmployeeMutation.isPending,
        activeTab,
        generatingAccess: generateAccessMutation.isPending,
        showOnboardingWizard,
        showOffboardingWizard,
        formData,
        newContact,
        employeeView: employeeQuery.data ?? null,
        companies: companiesQuery.data ?? [],
        allEmployees: allEmployeesQuery.data ?? [],
        fieldOptions: fieldOptionsQuery.data ?? {
            departments: [],
            categories: [],
            jobTitles: [],
            contractTypes: [],
            agreementTypes: []
        },
        setActiveTab,
        setShowOnboardingWizard,
        setShowOffboardingWizard,
        setFormData,
        setEmployeeView: (viewOrUpdater: EmployeeViewRecord | null | ((prev: EmployeeViewRecord | null) => EmployeeViewRecord | null)) => {
            if (typeof viewOrUpdater === 'function') {
                const current = queryClient.getQueryData<EmployeeViewRecord>(['employee', employeeId]) ?? null;
                const next = viewOrUpdater(current);
                if (next) queryClient.setQueryData(['employee', employeeId], next);
            } else if (viewOrUpdater) {
                queryClient.setQueryData(['employee', employeeId], viewOrUpdater);
            }
        },
        setNewContact,
        handleChange,
        handleSubmit,
        handlePrivateNotesSave: () => {
            if (employeeId) saveNotesMutation.mutate(formData.privateNotes);
        },
        handleGenerateAccess: () => { generateAccessMutation.mutate(); },
        enterEditMode,
        exitEditMode,
        navigateToVacations: () => setActiveTab('vacaciones')
    };
}
