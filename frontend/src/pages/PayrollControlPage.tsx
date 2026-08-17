import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import {
    Search, Filter, Lock, Unlock, Download,
    CheckCircle2, Loader2, FileSpreadsheet, ShieldAlert, RotateCcw, AlertCircle,
    Table2, Landmark, RefreshCw, Building2, History, Rows3, Maximize2, X, CalendarDays
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface MonthlyHistoryItem {
    id: string;
    year: number;
    month: number;
    status: string;
    employeeCount: number;
    completedEmployeeCount?: number;
    totalOvertimeAmount: string | number;
    totalDiets: string | number;
    totalGross: string | number;
    exportCount: number;
    updatedAt?: string;
}

interface PayrollExportHistoryItem {
    id: string;
    filename: string;
    templateHash: string;
    outputHash: string;
    createdAt: string;
    createdBy: { id: string; email: string };
}

const PERIOD_STATUS_LABELS: Record<string, string> = {
    DRAFT: 'Borrador',
    IN_REVIEW: 'En revisión',
    CLOSED: 'Cerrado',
    EXPORTED: 'Exportado',
    SENT_TO_AGENCY: 'Enviado',
    REOPENED: 'Reabierto'
};

export default function PayrollControlPage() {
    const { user } = useAuth();
    const isGlobalAdmin = user?.role?.toLowerCase() === 'admin' && !user?.companyId;
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
    const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => (
        user?.companyId || window.localStorage.getItem('payroll-control-company-id') || ''
    ));
    const [loadingCompanies, setLoadingCompanies] = useState<boolean>(false);
    const [history, setHistory] = useState<MonthlyHistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
    const [exportHistory, setExportHistory] = useState<PayrollExportHistoryItem[]>([]);
    const [loadingExports, setLoadingExports] = useState<boolean>(false);
    const [creatingPeriod, setCreatingPeriod] = useState<boolean>(false);
    const [tableDensity, setTableDensity] = useState<'COMFORTABLE' | 'COMPACT'>(() => (
        window.localStorage.getItem('payroll-control-density') === 'COMPACT' ? 'COMPACT' : 'COMFORTABLE'
    ));
    const [columnPreset, setColumnPreset] = useState<'ESSENTIAL' | 'ALL'>(() => (
        window.localStorage.getItem('payroll-control-columns') === 'ALL' ? 'ALL' : 'ESSENTIAL'
    ));
    const [gestoriaStatusFilter, setGestoriaStatusFilter] = useState<'ALL' | 'ERROR' | 'READY' | 'WITH_VALUES'>('ALL');
    const [loading, setLoading] = useState<boolean>(true);
    const [savingState, setSavingState] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'ERROR'>('IDLE');
    const [lastSavedRecordId, setLastSavedRecordId] = useState<string | null>(null);
    const [period, setPeriod] = useState<any>(null);
    const [records, setRecords] = useState<any[]>([]);
    const [filterText, setFilterText] = useState<string>('');
    const [selectedDept, setSelectedDept] = useState<string>('ALL');
    const [groupBy, setGroupBy] = useState<'DEPARTMENT' | 'CATEGORY'>('DEPARTMENT');
    const [activeView, setActiveView] = useState<'CONTROL' | 'GESTORIA'>('GESTORIA');
    const [controlModalOpen, setControlModalOpen] = useState<boolean>(false);
    const [gestoriaPreview, setGestoriaPreview] = useState<any>(null);
    const [previewing, setPreviewing] = useState<boolean>(false);

    const [reopenModalOpen, setReopenModalOpen] = useState<boolean>(false);
    const [reopenReason, setReopenReason] = useState<string>('');
    const [exporting, setExporting] = useState<boolean>(false);

    useEffect(() => {
        if (!controlModalOpen) return;

        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setControlModalOpen(false);
                setActiveView('GESTORIA');
            }
        };
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [controlModalOpen]);

    useEffect(() => {
        if (!isGlobalAdmin) {
            setSelectedCompanyId(user?.companyId || '');
            return;
        }

        let cancelled = false;
        const loadCompanies = async () => {
            setLoadingCompanies(true);
            try {
                const response = await api.get('/companies');
                const availableCompanies = ((response as { data?: Array<{ id: string; name: string }> }).data || response || []) as Array<{ id: string; name: string }>;
                if (cancelled) return;

                setCompanies(availableCompanies);
                setSelectedCompanyId((current) => {
                    const nextCompanyId = availableCompanies.some((company) => company.id === current)
                        ? current
                        : availableCompanies[0]?.id || '';
                    if (nextCompanyId) {
                        window.localStorage.setItem('payroll-control-company-id', nextCompanyId);
                    }
                    return nextCompanyId;
                });
            } catch (error) {
                if (!cancelled) {
                    console.error('Error loading companies for payroll control', error);
                    toast.error('No se pudieron cargar las empresas disponibles');
                }
            } finally {
                if (!cancelled) setLoadingCompanies(false);
            }
        };

        void loadCompanies();
        return () => {
            cancelled = true;
        };
    }, [isGlobalAdmin, user?.companyId]);

    const loadHistory = useCallback(async () => {
        if (isGlobalAdmin && !selectedCompanyId) {
            setHistory([]);
            return;
        }

        setLoadingHistory(true);
        try {
            const response = await api.get('/payroll/control/periods', {
                params: {
                    limit: 24,
                    ...(isGlobalAdmin ? { companyId: selectedCompanyId } : {})
                }
            });
            setHistory(((response as { data?: MonthlyHistoryItem[] }).data || response || []) as MonthlyHistoryItem[]);
        } catch (error) {
            console.error('Error loading payroll control history', error);
            toast.error('No se pudo cargar el historial mensual');
        } finally {
            setLoadingHistory(false);
        }
    }, [isGlobalAdmin, selectedCompanyId]);

    const loadPeriod = useCallback(async () => {
        if (isGlobalAdmin && !selectedCompanyId) {
            setPeriod(null);
            setRecords([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const res = await api.get('/payroll/control', {
                params: {
                    year,
                    month,
                    ...(isGlobalAdmin ? { companyId: selectedCompanyId } : {})
                }
            });
            const data = (res as { data?: any }).data || res;
            setPeriod(data);
            setRecords(data.records || []);
            void loadHistory();
        } catch (err: any) {
            console.error('Error loading payroll control', err);
            setPeriod(null);
            setRecords([]);
            setGestoriaPreview(null);
            if (err?.status !== 404) {
                toast.error(err?.message || 'Error al cargar la hoja de control general de RRHH');
            }
        } finally {
            setLoading(false);
        }
    }, [isGlobalAdmin, loadHistory, selectedCompanyId, year, month]);

    useEffect(() => {
        loadPeriod();
    }, [loadPeriod]);

    useEffect(() => {
        const refreshFromEmployeeProfile = (event: Event) => {
            const detail = (event as CustomEvent<{ year?: number; month?: number }>).detail;
            if (detail?.year === year && detail?.month === month) {
                void loadPeriod();
                toast.success('Control general actualizado con los cambios del empleado');
            }
        };
        window.addEventListener('payroll-control-updated', refreshFromEmployeeProfile);
        return () => window.removeEventListener('payroll-control-updated', refreshFromEmployeeProfile);
    }, [loadPeriod, month, year]);

    const loadExportHistory = useCallback(async () => {
        if (!period?.id) {
            setExportHistory([]);
            return;
        }
        setLoadingExports(true);
        try {
            const response = await api.get(`/payroll/control/periods/${period.id}/exports`);
            setExportHistory(((response as { data?: PayrollExportHistoryItem[] }).data || response || []) as PayrollExportHistoryItem[]);
        } catch (error) {
            console.error('Error loading payroll export history', error);
            setExportHistory([]);
        } finally {
            setLoadingExports(false);
        }
    }, [period?.id]);

    useEffect(() => {
        void loadExportHistory();
    }, [loadExportHistory]);

    const handleCreatePeriod = async () => {
        if (creatingPeriod || (isGlobalAdmin && !selectedCompanyId)) return;
        setCreatingPeriod(true);
        try {
            await api.post('/payroll/control/periods', {
                year,
                month,
                ...(isGlobalAdmin ? { companyId: selectedCompanyId } : {})
            });
            toast.success(`Período de ${MONTHS[month - 1]} ${year} creado con los empleados activos.`);
            await loadPeriod();
        } catch (error: any) {
            toast.error(error?.message || 'No se pudo crear el período mensual');
        } finally {
            setCreatingPeriod(false);
        }
    };

    const handleCompanyChange = (companyId: string) => {
        setSelectedCompanyId(companyId);
        setPeriod(null);
        setRecords([]);
        setGestoriaPreview(null);
        setSelectedDept('ALL');
        window.localStorage.setItem('payroll-control-company-id', companyId);
    };

    const handleDensityChange = (density: 'COMFORTABLE' | 'COMPACT') => {
        setTableDensity(density);
        window.localStorage.setItem('payroll-control-density', density);
    };

    const handleColumnPresetChange = (preset: 'ESSENTIAL' | 'ALL') => {
        setColumnPreset(preset);
        window.localStorage.setItem('payroll-control-columns', preset);
    };

    const handleControlGridKeyDown = (event: React.KeyboardEvent<HTMLTableElement>) => {
        if (event.key !== 'Enter') return;
        const target = event.target as HTMLInputElement;
        if (!(target instanceof HTMLInputElement) || target.disabled) return;
        const editable = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('tbody input:not(:disabled)'));
        const index = editable.indexOf(target);
        if (index < 0) return;
        event.preventDefault();
        const next = editable[index + (event.shiftKey ? -1 : 1)];
        next?.focus();
        next?.select();
    };

    const openHistoryPeriod = (historyPeriod: MonthlyHistoryItem) => {
        setYear(historyPeriod.year);
        setMonth(historyPeriod.month);
        setGestoriaPreview(null);
        window.requestAnimationFrame(() => {
            const tableAnchor = document.getElementById('payroll-control-table');
            if (typeof tableAnchor?.scrollIntoView === 'function') {
                tableAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    };

    const closeControlModal = () => {
        setControlModalOpen(false);
        setActiveView('GESTORIA');
    };

    const openControlModal = () => {
        setActiveView('CONTROL');
        setControlModalOpen(true);
    };

    const isLocked = !['DRAFT', 'IN_REVIEW', 'REOPENED'].includes(period?.status || '');
    const isClosed = isLocked;

    const handleCellBlur = async (recordId: string, field: string, value: any) => {
        if (isLocked) return;
        const record = records.find((item) => item.id === recordId);
        if (!record) return;
        setSavingState('SAVING');
        try {
            const res = await api.put(`/payroll/control/records/${recordId}`, {
                expectedVersion: record.version,
                [field]: value
            });
            const updatedRecord = (res as { data?: any }).data || res;
            setRecords(prev => prev.map(r => r.id === recordId ? updatedRecord : r));
            setGestoriaPreview(null);
            setSavingState('SAVED');
            setLastSavedRecordId(recordId);
            setTimeout(() => {
                setSavingState('IDLE');
                setLastSavedRecordId((current) => current === recordId ? null : current);
            }, 2500);
        } catch (err: any) {
            setSavingState('ERROR');
            toast.error(err?.response?.data?.message || 'Error al guardar la celda');
        }
    };

    const handleRestoreField = async (recordId: string, fieldName: string) => {
        if (isLocked) return;
        const record = records.find((item) => item.id === recordId);
        if (!record) return;
        setSavingState('SAVING');
        try {
            const res = await api.post(`/payroll/control/records/${recordId}/restore`, { fieldName, expectedVersion: record.version });
            const updatedRecord = (res as { data?: any }).data || res;
            setRecords(prev => prev.map(r => r.id === recordId ? updatedRecord : r));
            setSavingState('SAVED');
            toast.success(`Cálculo automático restaurado`);
            setTimeout(() => setSavingState('IDLE'), 2000);
        } catch (err: any) {
            setSavingState('ERROR');
            toast.error('Error al restaurar el cálculo');
        }
    };

    const handleConceptBlur = async (record: any, conceptConfigId: string, value: number) => {
        if (isLocked) return;
        setSavingState('SAVING');
        try {
            const res = await api.put(`/payroll/control/records/${record.id}/concepts`, {
                expectedVersion: record.version,
                conceptConfigId,
                value
            });
            const updated = (res as { data?: any }).data || res;
            setRecords(prev => prev.map(item => item.id === record.id ? updated : item));
            setGestoriaPreview(null);
            setSavingState('SAVED');
            setTimeout(() => setSavingState('IDLE'), 2000);
        } catch (err: any) {
            setSavingState('ERROR');
            toast.error(err?.response?.data?.message || 'Error al guardar el concepto');
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (newStatus === 'REOPENED') {
            setReopenModalOpen(true);
            return;
        }

        try {
            const res = await api.post('/payroll/control/period/status', {
                periodId: period.id,
                status: newStatus
            });
            setPeriod((res as { data?: any }).data || res);
            toast.success(`Estado del período actualizado a ${newStatus}`);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Error al cambiar estado');
        }
    };

    const submitReopen = async () => {
        if (!reopenReason || reopenReason.trim().length < 5) {
            toast.error('Debe indicar un motivo explicativo (mínimo 5 caracteres)');
            return;
        }

        try {
            const res = await api.post('/payroll/control/period/status', {
                periodId: period.id,
                status: 'REOPENED',
                reopenReason
            });
            setPeriod((res as { data?: any }).data || res);
            setReopenModalOpen(false);
            setReopenReason('');
            toast.success('Período reabierto correctamente');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Error al reabrir el período');
        }
    };

    const handlePreviewGestoria = async () => {
        if (!period) return;
        setPreviewing(true);
        try {
            const response = await api.post('/payroll/control/export/gestoria/preview', { periodId: period.id });
            const previewData = (response as { data?: any }).data || response;
            setGestoriaPreview(previewData);
            if (previewData.errors?.length) {
                toast.error(`Hay ${previewData.errors.length} incidencia${previewData.errors.length === 1 ? '' : 's'} antes de exportar.`);
            } else {
                toast.success('Todos los empleados están correctamente vinculados con la plantilla.');
            }
        } catch (err: any) {
            toast.error(err?.message || 'No se pudo validar la plantilla de gestoría');
        } finally {
            setPreviewing(false);
        }
    };

    const handleExportGestoria = async () => {
        if (!period) return;
        setExporting(true);
        try {
            const preview = await api.post('/payroll/control/export/gestoria/preview', { periodId: period.id });
            const previewData = (preview as { data?: any }).data || preview;
            setGestoriaPreview(previewData);
            if (previewData.errors?.length) {
                toast.error(`Exportación bloqueada: ${previewData.errors[0]}`);
                return;
            }
            const response = await api.post<Blob>('/payroll/control/export/gestoria', {
                periodId: period.id
            }, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(response);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `gestoria_${period.year}_${String(period.month).padStart(2, '0')}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Archivo gestoria.xlsx generado y descargado');
            await loadPeriod();
            await loadExportHistory();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Error al exportar el archivo para gestoría'));
        } finally {
            setExporting(false);
        }
    };

    const handleDownloadExport = async (item: PayrollExportHistoryItem) => {
        try {
            const blob = await api.get<Blob>(`/payroll/control/export/gestoria/${item.id}/download`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = item.filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            toast.error(error?.message || 'No se pudo descargar la exportación histórica');
        }
    };

    const statusAction = period?.status === 'DRAFT' || period?.status === 'REOPENED'
        ? { status: 'IN_REVIEW', label: 'Enviar a revisión', icon: <CheckCircle2 size={16} /> }
        : period?.status === 'IN_REVIEW'
            ? { status: 'CLOSED', label: 'Cerrar período', icon: <Lock size={16} /> }
            : null;

    // Filtrar registros
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const nameMatch = `${r.employee?.firstName || ''} ${r.employee?.lastName || ''} ${r.employee?.name || ''}`
                .toLowerCase().includes(filterText.toLowerCase());
            const deptMatch = selectedDept === 'ALL' || r.department === selectedDept;
            return nameMatch && deptMatch;
        });
    }, [records, filterText, selectedDept]);

    // Agrupar sin duplicar registros: solo cambia la presentación de la misma fuente mensual.
    const groupedRecords = useMemo(() => {
        const groups: Record<string, any[]> = {};
        for (const rec of filteredRecords) {
            const group = groupBy === 'CATEGORY'
                ? (rec.category || 'Sin categoría')
                : (rec.department || 'Otros');
            if (!groups[group]) groups[group] = [];
            groups[group].push(rec);
        }
        return groups;
    }, [filteredRecords, groupBy]);

    // Lista de Departamentos
    const departments = useMemo(() => {
        const set = new Set(records.map(r => r.department || 'Otros'));
        return Array.from(set);
    }, [records]);

    const configurableConcepts = useMemo(() => {
        const byId = new Map<string, any>();
        for (const record of records) {
            for (const concept of record.conceptValues || []) {
                if (!['434', '604'].includes(concept.gestoriaCode || '')) byId.set(concept.conceptConfigId, concept);
            }
        }
        return [...byId.values()].sort((a, b) => String(a.label).localeCompare(String(b.label)));
    }, [records]);
    const gestoriaColumns = useMemo(() => {
        const columns: Array<{ code: string; label: string; kind: 'CONCEPT' | 'RECORD'; conceptConfigId: string }> = configurableConcepts.map((concept) => ({
            code: concept.gestoriaCode || '---',
            label: concept.label,
            kind: 'CONCEPT',
            conceptConfigId: concept.conceptConfigId
        }));
        columns.push(
            { code: '434', label: 'H.EXT. 1', kind: 'RECORD', conceptConfigId: 'totalOvertimeAmount' },
            { code: '604', label: 'DIETAS', kind: 'RECORD', conceptConfigId: 'diets' }
        );
        return columns.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    }, [configurableConcepts]);
    const gestoriaPreviewRows = useMemo(() => new Map(
        (gestoriaPreview?.rows || []).map((row: any) => [row.employeeId, row])
    ), [gestoriaPreview]);
    const gestoriaStatus = useCallback((record: any) => {
        const code = record.gestoriaCode || record.employee?.payrollAgencyEmployeeCode || '';
        const previewRow = gestoriaPreviewRows.get(record.employeeId) as any;
        const missingTemplateRow = Boolean(gestoriaPreview) && !previewRow?.row;
        const hasValue = gestoriaColumns.some((column) => {
            if (column.conceptConfigId === 'totalOvertimeAmount') return Number(record.totalOvertimeAmount || 0) !== 0;
            if (column.conceptConfigId === 'diets') return Number(record.diets || 0) !== 0;
            return Number((record.conceptValues || []).find((item: any) => item.conceptConfigId === column.conceptConfigId)?.value || 0) !== 0;
        });
        return { invalid: !code || missingTemplateRow, hasValue };
    }, [gestoriaColumns, gestoriaPreview, gestoriaPreviewRows]);
    const visibleGestoriaRecords = useMemo(() => filteredRecords.filter((record) => {
        const status = gestoriaStatus(record);
        if (gestoriaStatusFilter === 'ERROR') return status.invalid;
        if (gestoriaStatusFilter === 'READY') return Boolean(gestoriaPreview) && !status.invalid;
        if (gestoriaStatusFilter === 'WITH_VALUES') return status.hasValue;
        return true;
    }), [filteredRecords, gestoriaPreview, gestoriaStatus, gestoriaStatusFilter]);
    const reviewSummary = useMemo(() => ({
        missingCodes: records.filter((record) => !(record.gestoriaCode || record.employee?.payrollAgencyEmployeeCode)).length,
        missingRates: records.filter((record) => (
            (Number(record.overtimeHours || 0) > 0 && Number(record.overtimeRate || 0) === 0) ||
            (Number(record.holidayOvertimeHours || 0) > 0 && Number(record.holidayOvertimeRate || 0) === 0)
        )).length,
        manualOverrides: records.filter((record) => [
            record.isTotalOvertimeAmountManual,
            record.isAvailablePercentageManual,
            record.isGrossManual,
            record.isProductivityManual,
            record.isHoursAmountManual,
            record.isDifferenceManual
        ].some(Boolean)).length,
        withValues: records.filter((record) => gestoriaStatus(record).hasValue).length
    }), [gestoriaStatus, records]);
    const gestoriaTotals = useMemo(() => Object.fromEntries(gestoriaColumns.map((column) => {
        const total = visibleGestoriaRecords.reduce((sum, record) => {
            if (column.conceptConfigId === 'totalOvertimeAmount') return sum + Number(record.totalOvertimeAmount || 0);
            if (column.conceptConfigId === 'diets') return sum + Number(record.diets || 0);
            const concept = (record.conceptValues || []).find((item: any) => item.conceptConfigId === column.conceptConfigId);
            return sum + Number(concept?.value || 0);
        }, 0);
        return [column.code, total];
    })), [gestoriaColumns, visibleGestoriaRecords]);
    const columnCount = 17 + configurableConcepts.length;

    // Totales Generales
    const grandTotals = useMemo(() => {
        return filteredRecords.reduce((acc, r) => ({
            overtimeAmount: acc.overtimeAmount + Number(r.totalOvertimeAmount || 0),
            positiveVar: acc.positiveVar + Number(r.positiveVariable || 0),
            negativeVar: acc.negativeVar + Number(r.negativeVariable || 0),
            diets: acc.diets + Number(r.diets || 0),
            gross: acc.gross + Number(r.gross || 0),
            productivity: acc.productivity + Number(r.productivity || 0),
            hoursAmount: acc.hoursAmount + Number(r.hoursAmount || 0),
            difference: acc.difference + Number(r.difference || 0)
        }), {
            overtimeAmount: 0, positiveVar: 0, negativeVar: 0, diets: 0,
            gross: 0, productivity: 0, hoursAmount: 0, difference: 0
        });
    }, [filteredRecords]);

    return (
        <div className="space-y-6">
            {/* Header Principal */}
            <div className="sticky top-0 z-40 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 lg:flex-row lg:items-center">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                            <FileSpreadsheet size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Control General de RRHH</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Hoja de liquidación mensual y preparación para gestoría (según 2026 CONTROL).
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {isGlobalAdmin && (
                        <label className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800">
                            <Building2 size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">Empresa</span>
                            <select
                                aria-label="Empresa"
                                value={selectedCompanyId}
                                onChange={(event) => handleCompanyChange(event.target.value)}
                                disabled={loadingCompanies || companies.length === 0}
                                className="min-w-44 bg-transparent text-sm font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {companies.length === 0 && (
                                    <option value="">{loadingCompanies ? 'Cargando empresas…' : 'Sin empresas disponibles'}</option>
                                )}
                                {companies.map((company) => (
                                    <option key={company.id} value={company.id}>{company.name}</option>
                                ))}
                            </select>
                        </label>
                    )}

                    {/* Indicador de Estado de Guardado */}
                    <div className="text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {savingState === 'SAVING' && (
                            <>
                                <Loader2 size={14} className="animate-spin text-blue-500" />
                                <span>Guardando...</span>
                            </>
                        )}
                        {savingState === 'SAVED' && (
                            <>
                                <CheckCircle2 size={14} className="text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">Guardado</span>
                            </>
                        )}
                        {savingState === 'ERROR' && (
                            <>
                                <AlertCircle size={14} className="text-rose-500" />
                                <span className="text-rose-600 dark:text-rose-400">Error al guardar</span>
                            </>
                        )}
                        {savingState === 'IDLE' && (
                            <span>Autoguardado activo</span>
                        )}
                    </div>

                    {/* Selector Año / Mes */}
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                        <select
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            className="bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                            {MONTHS.map((m, idx) => (
                                <option key={idx + 1} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer border-l border-slate-200 dark:border-slate-700 pl-2"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Botón Estado Período */}
                    {isClosed ? (
                        <button
                            type="button"
                            onClick={() => handleStatusChange('REOPENED')}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm rounded-xl transition-colors cursor-pointer"
                        >
                            <Unlock size={16} />
                            <span>Reabrir Período</span>
                        </button>
                    ) : statusAction ? (
                        <button
                            type="button"
                            onClick={() => handleStatusChange(statusAction.status)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-xl transition-colors cursor-pointer"
                        >
                            {statusAction.icon}
                            <span>{statusAction.label}</span>
                        </button>
                    ) : null}

                    {/* Exportación Gestoría */}
                    <button
                        type="button"
                        onClick={handleExportGestoria}
                        disabled={exporting || period?.status !== 'CLOSED'}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                        {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        <span>Exportar a Gestoría</span>
                    </button>
                </div>
            </div>

            {/* Banner de Estado del Período */}
            {isClosed && (
                <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 rounded-2xl text-sm font-medium">
                    <ShieldAlert size={20} className="shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="flex-1">
                        <span className="font-bold">Período CERRADO</span> — La edición de datos está bloqueada en esta pantalla y en la pestaña de perfil del empleado.
                    </div>
                </div>
            )}

            {period && (
                <section className="grid overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm sm:grid-cols-2 xl:grid-cols-5 dark:border-slate-700" aria-label="Resumen de preparación del mes">
                    {[
                        ['Empleados asignados', records.length, 'text-white'],
                        ['Con datos mensuales', reviewSummary.withValues, 'text-blue-300'],
                        ['Sin código gestoría', reviewSummary.missingCodes, reviewSummary.missingCodes ? 'text-rose-300' : 'text-emerald-300'],
                        ['Con sobrescrituras', reviewSummary.manualOverrides, reviewSummary.manualOverrides ? 'text-amber-300' : 'text-emerald-300'],
                        ['Bruto efectivo', `${grandTotals.gross.toFixed(2)} €`, 'text-emerald-300']
                    ].map(([label, value, tone]) => (
                        <div key={String(label)} className="border-b border-r border-slate-800 px-4 py-3 last:border-r-0 sm:border-b-0">
                            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</span>
                            <strong className={`mt-1 block font-mono text-lg ${tone}`}>{value}</strong>
                        </div>
                    ))}
                </section>
            )}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-labelledby="monthly-history-title">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-slate-900 p-2 text-white dark:bg-slate-100 dark:text-slate-900">
                            <History size={18} />
                        </div>
                        <div>
                            <h2 id="monthly-history-title" className="font-bold text-slate-900 dark:text-white">Historial mensual</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Abre cualquier cierre anterior en esta misma hoja.</p>
                        </div>
                    </div>
                    {loadingHistory && <Loader2 size={18} className="animate-spin text-blue-600" aria-label="Cargando historial" />}
                </div>

                <div className="overflow-x-auto">
                    {!loadingHistory && history.length === 0 && (
                        <div className="m-4 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700">
                            Los periodos aparecerán aquí cuando abras o prepares un mes.
                        </div>
                    )}
                    {history.length > 0 && (
                        <table className="w-full min-w-[780px] text-sm">
                            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800/70">
                                <tr>
                                    <th className="px-5 py-2.5">Periodo</th>
                                    <th className="px-3 py-2.5">Estado</th>
                                    <th className="px-3 py-2.5 text-right">Empleados</th>
                                    <th className="px-3 py-2.5 text-right">Horas extra</th>
                                    <th className="px-3 py-2.5 text-right">Dietas</th>
                                    <th className="px-3 py-2.5 text-right">Bruto</th>
                                    <th className="px-3 py-2.5 text-right">Exportaciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {history.map((historyPeriod) => {
                                    const selected = historyPeriod.year === year && historyPeriod.month === month;
                                    const completed = historyPeriod.completedEmployeeCount ?? historyPeriod.employeeCount;
                                    return (
                                        <tr
                                            key={historyPeriod.id}
                                            role="button"
                                            aria-label={`Abrir ${MONTHS[historyPeriod.month - 1]} ${historyPeriod.year}`}
                                            onClick={() => openHistoryPeriod(historyPeriod)}
                                            tabIndex={0}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') openHistoryPeriod(historyPeriod);
                                            }}
                                            className={`cursor-pointer outline-none transition hover:bg-blue-50 focus:bg-blue-50 dark:hover:bg-blue-950/20 ${selected ? 'bg-blue-50/80 dark:bg-blue-950/30' : ''}`}
                                            aria-current={selected ? 'true' : undefined}
                                        >
                                            <td className="px-5 py-3 font-bold capitalize text-slate-950 dark:text-white">{MONTHS[historyPeriod.month - 1]} {historyPeriod.year}</td>
                                            <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-700 dark:bg-slate-700 dark:text-slate-200">{PERIOD_STATUS_LABELS[historyPeriod.status] || historyPeriod.status}</span></td>
                                            <td className="px-3 py-3 text-right font-mono">
                                                {completed}/{historyPeriod.employeeCount}
                                                <span className="sr-only">{historyPeriod.employeeCount} empleados</span>
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono">{Number(historyPeriod.totalOvertimeAmount || 0).toFixed(2)} €</td>
                                            <td className="px-3 py-3 text-right font-mono">{Number(historyPeriod.totalDiets || 0).toFixed(2)} €</td>
                                            <td className="px-3 py-3 text-right font-mono font-bold">{Number(historyPeriod.totalGross || 0).toFixed(2)} €</td>
                                            <td className="px-3 py-3 text-right font-mono">{historyPeriod.exportCount}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>

            {period ? (
            <>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-labelledby="export-history-title">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
                    <div>
                        <h2 id="export-history-title" className="font-bold text-slate-900 dark:text-white">Historial de gestoría</h2>
                        <p className="text-xs text-slate-500">Cada archivo generado queda guardado como una versión inmutable y descargable.</p>
                    </div>
                    {loadingExports && <Loader2 size={16} className="animate-spin text-emerald-600" />}
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {!loadingExports && exportHistory.length === 0 && (
                        <p className="px-5 py-4 text-sm text-slate-500">Este período todavía no tiene exportaciones.</p>
                    )}
                    {exportHistory.map((item, index) => (
                        <div key={item.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                    Versión {exportHistory.length - index} · {item.filename}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {new Date(item.createdAt).toLocaleString('es-ES')} · {item.createdBy.email}
                                </p>
                                <p className="mt-1 truncate font-mono text-[10px] text-slate-400" title={item.outputHash}>
                                    SHA-256 salida: {item.outputHash}
                                </p>
                            </div>
                            <button type="button" onClick={() => handleDownloadExport(item)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30">
                                <Download size={14} />
                                Descargar versión
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex w-fit rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                    <button
                        type="button"
                        onClick={openControlModal}
                        aria-label="Abrir control mensual a pantalla completa"
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${controlModalOpen ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300' : 'text-slate-600 hover:bg-white hover:text-blue-700 hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-700'}`}
                    >
                        <Maximize2 size={16} />
                        Control mensual
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveView('GESTORIA')}
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${activeView === 'GESTORIA' ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        <Landmark size={16} />
                        Vista gestoría
                    </button>
                </div>
                {activeView === 'GESTORIA' && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">
                            Una fila por empleado · solo conceptos incluidos en la exportación
                        </span>
                        <button
                            type="button"
                            onClick={handlePreviewGestoria}
                            disabled={previewing}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                        >
                            {previewing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            Validar contra plantilla
                        </button>
                    </div>
                )}
            </div>

            {activeView === 'GESTORIA' && gestoriaPreview?.errors?.length > 0 && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
                    <div className="mb-2 flex items-center gap-2 font-bold">
                        <AlertCircle size={17} />
                        {gestoriaPreview.errors.length} incidencias impiden exportar
                    </div>
                    <ul className="max-h-28 list-disc space-y-1 overflow-auto pl-5 text-xs">
                        {gestoriaPreview.errors.map((error: string, index: number) => <li key={`${error}-${index}`}>{error}</li>)}
                    </ul>
                </div>
            )}

            {(activeView === 'GESTORIA' || controlModalOpen) && (
            <div
                role={controlModalOpen ? 'dialog' : undefined}
                aria-modal={controlModalOpen ? true : undefined}
                aria-labelledby={controlModalOpen ? 'monthly-review-title' : undefined}
                className={controlModalOpen
                    ? 'fixed inset-0 z-[100] flex min-h-0 flex-col bg-slate-100 dark:bg-slate-950'
                    : 'contents'}
            >
                {controlModalOpen && (
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-700 bg-slate-950 px-4 py-3 text-white shadow-lg sm:px-6">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="rounded-xl bg-blue-600 p-2.5 text-white">
                                <Table2 size={21} />
                            </div>
                            <div className="min-w-0">
                                <h2 id="monthly-review-title" className="truncate text-base font-extrabold sm:text-lg">
                                    Revisión mensual · {MONTHS[month - 1]} {year}
                                </h2>
                                <p className="truncate text-xs text-slate-400">
                                    {companies.find((company) => company.id === selectedCompanyId)?.name || 'Empresa asignada'}
                                    {' · '}
                                    {records.length} empleados
                                    {' · '}
                                    {PERIOD_STATUS_LABELS[period?.status] || period?.status || 'Cargando'}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <div className="hidden rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 sm:block">
                                {savingState === 'SAVING' ? 'Guardando…' : savingState === 'ERROR' ? 'Error al guardar' : savingState === 'SAVED' ? 'Guardado' : 'Autoguardado activo'}
                            </div>
                            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1" aria-label="Densidad de la tabla">
                                <button
                                    type="button"
                                    onClick={() => handleDensityChange('COMFORTABLE')}
                                    aria-pressed={tableDensity === 'COMFORTABLE'}
                                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${tableDensity === 'COMFORTABLE' ? 'bg-white text-blue-700' : 'text-slate-300 hover:text-white'}`}
                                >
                                    Cómoda
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDensityChange('COMPACT')}
                                    aria-pressed={tableDensity === 'COMPACT'}
                                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${tableDensity === 'COMPACT' ? 'bg-white text-blue-700' : 'text-slate-300 hover:text-white'}`}
                                >
                                    <Rows3 size={13} />
                                    Compacta
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={closeControlModal}
                                aria-label="Cerrar revisión mensual"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                )}

                <div className={controlModalOpen ? 'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-3 sm:p-4' : 'contents'}>
            {/* Barra de Búsqueda y Filtros */}
            <div id="payroll-control-table" className={`flex scroll-mt-4 flex-col sm:flex-row items-center justify-between gap-4 ${controlModalOpen ? 'shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900' : ''}`}>
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        placeholder="Buscar por empleado..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <Filter size={16} className="text-slate-400" />
                    <select
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="ALL">Todos los grupos ({records.length})</option>
                        {departments.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                    {activeView === 'CONTROL' && (
                        <>
                            <select value={groupBy} onChange={(event) => setGroupBy(event.target.value as typeof groupBy)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-800 dark:bg-slate-900" aria-label="Agrupar empleados">
                                <option value="DEPARTMENT">Agrupar por departamento</option>
                                <option value="CATEGORY">Agrupar por categoría</option>
                            </select>
                            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" aria-label="Columnas visibles">
                                <button type="button" onClick={() => handleColumnPresetChange('ESSENTIAL')} aria-pressed={columnPreset === 'ESSENTIAL'} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${columnPreset === 'ESSENTIAL' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'text-slate-500'}`}>Esenciales</button>
                                <button type="button" onClick={() => handleColumnPresetChange('ALL')} aria-pressed={columnPreset === 'ALL'} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${columnPreset === 'ALL' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'text-slate-500'}`}>Todas</button>
                            </div>
                        </>
                    )}
                    {activeView === 'GESTORIA' && (
                        <select value={gestoriaStatusFilter} onChange={(event) => setGestoriaStatusFilter(event.target.value as typeof gestoriaStatusFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-800 dark:bg-slate-900">
                            <option value="ALL">Todos los estados</option>
                            <option value="ERROR">Solo incidencias</option>
                            <option value="READY">Preparados</option>
                            <option value="WITH_VALUES">Con importes</option>
                        </select>
                    )}
                </div>
            </div>

            {/* Tabla Principal Estilo Excel */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
                    <Loader2 className="animate-spin" size={24} />
                    <span>Cargando tabla de control general...</span>
                </div>
            ) : activeView === 'GESTORIA' ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-emerald-50/60 px-4 py-3 text-xs dark:border-slate-700 dark:bg-emerald-950/10">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white px-3 py-1.5 font-bold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">{records.length} empleados</span>
                            <span className={`rounded-full px-3 py-1.5 font-bold ${reviewSummary.missingCodes ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{reviewSummary.missingCodes} sin código</span>
                            {reviewSummary.missingRates > 0 && <span className="rounded-full bg-amber-100 px-3 py-1.5 font-bold text-amber-800">{reviewSummary.missingRates} horas sin tarifa (0€)</span>}
                            <span className="rounded-full bg-amber-100 px-3 py-1.5 font-bold text-amber-800">{reviewSummary.manualOverrides} con correcciones</span>
                            {gestoriaPreview && <span className={`rounded-full px-3 py-1.5 font-bold ${gestoriaPreview.errors?.length ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{gestoriaPreview.errors?.length || 0} incidencias de plantilla</span>}
                        </div>
                        <span className="text-slate-500">Los importes amarillos han sido corregidos manualmente.</span>
                    </div>
                    <div className="max-h-[70vh] overflow-auto">
                        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-xs">
                            <thead className="sticky top-0 z-20 bg-emerald-950 text-white shadow-sm">
                                <tr>
                                    <th className="sticky left-0 z-30 min-w-32 border-b border-r border-emerald-800 bg-emerald-950 p-2.5">
                                        Código trabajador
                                    </th>
                                    <th className="sticky left-32 z-30 min-w-56 border-b border-r border-emerald-800 bg-emerald-950 p-2.5">
                                        Trabajador
                                    </th>
                                    <th className="w-20 border-b border-r border-emerald-800 p-2.5 text-center">
                                        Fila Excel
                                    </th>
                                    {gestoriaColumns.map((column) => (
                                        <th key={column.code} className="min-w-28 border-b border-r border-emerald-800 p-2.5 text-right">
                                            <span className="block font-mono text-[11px] text-emerald-300">{column.code}</span>
                                            <span className="block whitespace-nowrap">{column.label}</span>
                                        </th>
                                    ))}
                                    <th className="min-w-36 border-b border-emerald-800 p-2.5">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleGestoriaRecords.length === 0 && (
                                    <tr>
                                        <td colSpan={gestoriaColumns.length + 4} className="px-6 py-14 text-center text-sm text-slate-500">
                                            No hay trabajadores que coincidan con este filtro.
                                        </td>
                                    </tr>
                                )}
                                {visibleGestoriaRecords.map((record) => {
                                    const employeeName = `${record.employee?.lastName || ''}, ${record.employee?.firstName || record.employee?.name || ''}`;
                                    const employeeCode = record.gestoriaCode || record.employee?.payrollAgencyEmployeeCode || '';
                                    const previewRow = gestoriaPreviewRows.get(record.employeeId) as any;
                                    const missingCode = !employeeCode;
                                    const missingTemplateRow = Boolean(gestoriaPreview) && !previewRow?.row;
                                    const hasMissingRate = (
                                        (Number(record.overtimeHours || 0) > 0 && Number(record.overtimeRate || 0) === 0) ||
                                        (Number(record.holidayOvertimeHours || 0) > 0 && Number(record.holidayOvertimeRate || 0) === 0)
                                    );
                                    const invalid = missingCode || missingTemplateRow;

                                    return (
                                        <tr key={record.id} className={lastSavedRecordId === record.id ? 'bg-emerald-100/80 outline outline-1 -outline-offset-1 outline-emerald-400 dark:bg-emerald-950/30' : invalid ? 'bg-rose-50/70 dark:bg-rose-950/15' : 'hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10'}>
                                            <td className={`sticky left-0 z-10 border-b border-r border-slate-200 p-1 ${invalid ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-white dark:bg-slate-900'} dark:border-slate-700`}>
                                                <input
                                                    type="text"
                                                    disabled={isLocked}
                                                    defaultValue={employeeCode}
                                                    onBlur={(event) => handleCellBlur(record.id, 'gestoriaCode', event.target.value.trim() || null)}
                                                    placeholder="Sin código"
                                                    className={`h-8 w-full rounded border-0 bg-transparent px-2 font-mono font-bold outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 dark:focus:bg-slate-800 ${missingCode ? 'text-rose-700 placeholder:text-rose-500' : 'text-slate-800 dark:text-slate-100'}`}
                                                />
                                            </td>
                                            <td className={`sticky left-32 z-10 border-b border-r border-slate-200 px-3 py-2 font-semibold ${invalid ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-white dark:bg-slate-900'} dark:border-slate-700`}>
                                                {employeeName}
                                            </td>
                                            <td className="border-b border-r border-slate-200 px-2 text-center font-mono text-slate-500 dark:border-slate-700">
                                                {previewRow?.row || '—'}
                                            </td>
                                            {gestoriaColumns.map((column) => {
                                                if (column.conceptConfigId === 'totalOvertimeAmount') {
                                                    return (
                                                        <td key={column.code} className={`border-b border-r border-slate-200 p-1 dark:border-slate-700 ${record.isTotalOvertimeAmountManual ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}>
                                                            <div className="flex items-center">
                                                                {record.isTotalOvertimeAmountManual && <button type="button" onClick={() => handleRestoreField(record.id, 'totalOvertimeAmount')} title="Restaurar cálculo" className="text-amber-600"><RotateCcw size={12} /></button>}
                                                                <input type="number" step="0.01" disabled={isLocked} defaultValue={Number(record.totalOvertimeAmount || 0)} onBlur={(event) => handleCellBlur(record.id, 'totalOvertimeAmount', Number(event.target.value))} className="h-8 w-full bg-transparent px-2 text-right font-mono outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 dark:focus:bg-slate-800" />
                                                            </div>
                                                        </td>
                                                    );
                                                }
                                                if (column.conceptConfigId === 'diets') {
                                                    return (
                                                        <td key={column.code} className="border-b border-r border-slate-200 p-1 dark:border-slate-700">
                                                            <input type="number" step="0.01" disabled={isLocked} defaultValue={Number(record.diets || 0)} onBlur={(event) => handleCellBlur(record.id, 'diets', Number(event.target.value))} className="h-8 w-full bg-transparent px-2 text-right font-mono outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 dark:focus:bg-slate-800" />
                                                        </td>
                                                    );
                                                }
                                                const concept = (record.conceptValues || []).find((item: any) => item.conceptConfigId === column.conceptConfigId);
                                                return (
                                                    <td key={column.code} className="border-b border-r border-slate-200 p-1 dark:border-slate-700">
                                                        <input type="number" step="0.01" disabled={isLocked || !concept} defaultValue={Number(concept?.value || 0)} onBlur={(event) => concept && handleConceptBlur(record, concept.conceptConfigId, Number(event.target.value))} className="h-8 w-full bg-transparent px-2 text-right font-mono outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 dark:focus:bg-slate-800" />
                                                    </td>
                                                );
                                            })}
                                            <td className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                                                {missingCode ? (
                                                    <span className="inline-flex items-center gap-1 font-semibold text-rose-700"><AlertCircle size={13} /> Falta código</span>
                                                ) : missingTemplateRow ? (
                                                    <span className="inline-flex items-center gap-1 font-semibold text-rose-700"><AlertCircle size={13} /> No está en plantilla</span>
                                                ) : hasMissingRate ? (
                                                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700" title="Horas calculadas con tarifa a 0.00 €/h"><AlertCircle size={13} /> Tarifa 0 €</span>
                                                ) : gestoriaPreview ? (
                                                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><CheckCircle2 size={13} /> Preparado</span>
                                                ) : (
                                                    <span className="text-slate-400">Sin validar</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="sticky bottom-0 z-20 bg-slate-900 font-bold text-white">
                                <tr>
                                    <td colSpan={3} className="sticky left-0 bg-slate-900 p-3 text-right uppercase tracking-wide">Totales para gestoría</td>
                                    {gestoriaColumns.map((column) => (
                                        <td key={column.code} className="border-l border-slate-700 p-3 text-right font-mono">
                                            {Number(gestoriaTotals[column.code] || 0).toFixed(2)} €
                                        </td>
                                    ))}
                                    <td className="border-l border-slate-700 p-3">
                                        {visibleGestoriaRecords.length} trabajadores
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            ) : Object.keys(groupedRecords).length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    No hay registros de empleados para el filtro seleccionado.
                </div>
            ) : (
                <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm ${controlModalOpen ? 'flex min-h-0 flex-1 flex-col' : ''}`}>
                    <div className={controlModalOpen ? 'h-full min-h-0 overflow-auto' : 'overflow-x-auto max-h-[70vh]'}>
                        <table onKeyDown={handleControlGridKeyDown} className={`w-full border-collapse text-left tabular-nums ${columnPreset === 'ESSENTIAL' ? 'payroll-essential-columns' : ''} ${
                            tableDensity === 'COMFORTABLE'
                                ? 'min-w-[2450px] text-sm [&_thead_th]:px-4 [&_thead_th]:py-3.5 [&_tbody_td]:px-3 [&_tbody_td]:py-2.5 [&_tbody_input]:min-h-9 [&_tbody_input]:min-w-24 [&_tbody_input]:px-2.5 [&_tbody_input]:py-2'
                                : 'min-w-[1900px] text-xs [&_thead_th]:px-2.5 [&_thead_th]:py-2.5 [&_tbody_td]:px-1.5 [&_tbody_td]:py-1 [&_tbody_input]:min-w-20 [&_tbody_input]:py-1'
                        }`}>
                            <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-semibold sticky top-0 z-20 shadow-sm">
                                <tr className="bg-slate-950 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">
                                    <th colSpan={4} className="border-r border-slate-700 px-3 py-2 text-left">Empleado y tarifas</th>
                                    <th colSpan={3} className="border-r border-slate-700 px-3 py-2 text-center">Horas</th>
                                    <th colSpan={3} className="border-r border-slate-700 px-3 py-2 text-center">Variables</th>
                                    <th colSpan={3} className="border-r border-slate-700 px-3 py-2 text-center">Retenciones</th>
                                    <th colSpan={4} className="border-r border-slate-700 px-3 py-2 text-center">Resultados efectivos</th>
                                    {configurableConcepts.length > 0 && <th colSpan={configurableConcepts.length} className="px-3 py-2 text-center">Otros conceptos</th>}
                                </tr>
                                <tr>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700">Categoría</th>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Tarifa H.Ext</th>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Tarifa H.Fest</th>
                                    {/* Trabajador BLOQUEADO */}
                                    <th className="min-w-64 p-2.5 border-b border-r border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-700 font-bold text-slate-900 dark:text-white sticky left-0 z-30 shadow-[6px_0_10px_-8px_rgba(15,23,42,0.65)]">
                                        Trabajador (Solo Lectura)
                                    </th>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Cant. H.Ext</th>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Cant. H.Fest</th>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right font-bold text-blue-600 dark:text-blue-400">Total Importe</th>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Var. Positiva</th>
                                    <th title="Campo informativo. No resta en las fórmulas automáticas." className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Var. Negativa ⓘ</th>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Dietas</th>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">IRPF %</th>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">TGSS %</th>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">% Dispon.</th>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right font-bold text-slate-900 dark:text-white">BRUTO</th>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Productividad (ratio)</th>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Horas</th>
                                    <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">Diferencia</th>
                                    {configurableConcepts.map((concept) => <th key={concept.conceptConfigId} className="p-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-right">{concept.label}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {Object.entries(groupedRecords).map(([dept, deptRecords]) => {
                                    // Subtotales del grupo
                                    const subtotal = deptRecords.reduce((acc, r) => ({
                                        total: acc.total + Number(r.totalOvertimeAmount || 0),
                                        posVar: acc.posVar + Number(r.positiveVariable || 0),
                                        diets: acc.diets + Number(r.diets || 0),
                                        gross: acc.gross + Number(r.gross || 0),
                                        prod: acc.prod + Number(r.productivity || 0),
                                        hours: acc.hours + Number(r.hoursAmount || 0),
                                        diff: acc.diff + Number(r.difference || 0)
                                    }), { total: 0, posVar: 0, diets: 0, gross: 0, prod: 0, hours: 0, diff: 0 });

                                    return (
                                        <Fragment key={dept}>
                                            {/* Cabecera de Grupo */}
                                            <tr className="bg-slate-200/70 dark:bg-slate-800/80 font-bold text-slate-800 dark:text-slate-200">
                                                <td colSpan={columnCount} className="p-2 pl-4 text-xs uppercase tracking-wide">
                                                    {dept} ({deptRecords.length} trabajadores)
                                                </td>
                                            </tr>

                                            {/* Filas de Empleados del Grupo */}
                                            {deptRecords.map(r => {
                                                const empName = `${r.employee?.lastName || ''}, ${r.employee?.firstName || r.employee?.name || ''}`;

                                                return (
                                                    <tr key={r.id} className={`payroll-record-row transition-colors ${lastSavedRecordId === r.id ? 'bg-emerald-100/80 outline outline-1 -outline-offset-1 outline-emerald-400 dark:bg-emerald-950/30' : 'hover:bg-blue-50/40 dark:hover:bg-slate-800/40'}`}>
                                                        {/* Categoría */}
                                                        <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                                                            <input
                                                                type="text"
                                                                disabled={isClosed}
                                                                defaultValue={r.category || ''}
                                                                onBlur={(e) => handleCellBlur(r.id, 'category', e.target.value)}
                                                                className="w-full bg-transparent px-2 py-1 text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 rounded"
                                                            />
                                                        </td>

                                                        {/* Tarifa H.Ext */}
                                                        <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                disabled={isClosed}
                                                                defaultValue={Number(r.overtimeRate || 0)}
                                                                onBlur={(e) => handleCellBlur(r.id, 'overtimeRate', Number(e.target.value))}
                                                                className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 rounded"
                                                            />
                                                        </td>

                                                        {/* Tarifa H.Fest */}
                                                        <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                disabled={isClosed}
                                                                defaultValue={Number(r.holidayOvertimeRate || 0)}
                                                                onBlur={(e) => handleCellBlur(r.id, 'holidayOvertimeRate', Number(e.target.value))}
                                                                className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 rounded"
                                                            />
                                                        </td>

                                                        {/* NOMBRE TRABAJADOR - LECTURA BLOQUEADA */}
                                                        <td className="min-w-64 p-2 border-r border-slate-300 dark:border-slate-600 font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/90 sticky left-0 z-10 select-none shadow-[6px_0_10px_-8px_rgba(15,23,42,0.65)]">
                                                            {empName}
                                                        </td>

                                                        {/* Cantidad H.Ext */}
                                                        <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                            <input
                                                                type="number"
                                                                step="0.5"
                                                                disabled={isClosed}
                                                                defaultValue={Number(r.overtimeHours || 0)}
                                                                onBlur={(e) => handleCellBlur(r.id, 'overtimeHours', Number(e.target.value))}
                                                                className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 rounded"
                                                            />
                                                        </td>

                                                        {/* Cantidad H.Fest */}
                                                        <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                            <input
                                                                type="number"
                                                                step="0.5"
                                                                disabled={isClosed}
                                                                defaultValue={Number(r.holidayOvertimeHours || 0)}
                                                                onBlur={(e) => handleCellBlur(r.id, 'holidayOvertimeHours', Number(e.target.value))}
                                                                className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 rounded"
                                                            />
                                                        </td>

                                                        {/* Total Importe (Calculado/Sobrescrito) */}
                                                        <td title={r.isTotalOvertimeAmountManual ? `Calculado: ${Number(r.totalOvertimeAmountCalculated || 0).toFixed(2)} € · Manual efectivo: ${Number(r.totalOvertimeAmount || 0).toFixed(2)} €` : 'Valor calculado automáticamente'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right font-semibold ${r.isTotalOvertimeAmountManual ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50/60 dark:bg-slate-800/30'}`}>
                                                            <div className="flex items-center justify-end gap-1">
                                                                {r.isTotalOvertimeAmountManual && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRestoreField(r.id, 'totalOvertimeAmount')}
                                                                        title="Restaurar cálculo automático"
                                                                        className="text-amber-600 hover:text-amber-800"
                                                                    >
                                                                        <RotateCcw size={12} />
                                                                    </button>
                                                                )}
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    disabled={isLocked}
                                                                    defaultValue={Number(r.totalOvertimeAmount || 0)}
                                                                    onBlur={(e) => handleCellBlur(r.id, 'totalOvertimeAmount', Number(e.target.value))}
                                                                    className="w-full bg-transparent px-1 py-1 text-right font-bold text-blue-600 dark:text-blue-400 focus:ring-1 focus:ring-blue-500 rounded"
                                                                />
                                                            </div>
                                                        </td>

                                                        {/* Var. Positiva */}
                                                        <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                disabled={isLocked}
                                                                defaultValue={Number(r.positiveVariable || 0)}
                                                                onBlur={(e) => handleCellBlur(r.id, 'positiveVariable', Number(e.target.value))}
                                                                className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 rounded"
                                                            />
                                                        </td>

                                                        {/* Var. Negativa */}
                                                        <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                disabled={isLocked}
                                                                defaultValue={Number(r.negativeVariable || 0)}
                                                                onBlur={(e) => handleCellBlur(r.id, 'negativeVariable', Number(e.target.value))}
                                                                className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 rounded"
                                                            />
                                                        </td>

                                                        {/* Dietas */}
                                                        <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                disabled={isLocked}
                                                                defaultValue={Number(r.diets || 0)}
                                                                onBlur={(e) => handleCellBlur(r.id, 'diets', Number(e.target.value))}
                                                                className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 rounded"
                                                            />
                                                        </td>

                                                        {/* IRPF % */}
                                                        <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                disabled={isLocked}
                                                                defaultValue={Number(r.irpf || 0) * 100}
                                                                onBlur={(e) => handleCellBlur(r.id, 'irpf', Number(e.target.value) / 100)}
                                                                className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 rounded"
                                                            />
                                                        </td>

                                                        {/* TGSS % */}
                                                        <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                disabled={isLocked}
                                                                defaultValue={Number(r.tgss || 0) * 100}
                                                                onBlur={(e) => handleCellBlur(r.id, 'tgss', Number(e.target.value) / 100)}
                                                                className="w-full bg-transparent px-2 py-1 text-right text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 rounded"
                                                            />
                                                        </td>

                                                        {/* % Disponible */}
                                                        <td title={r.isAvailablePercentageManual ? `Calculado: ${(Number(r.availablePercentageCalculated || 0) * 100).toFixed(2)} % · Manual efectivo: ${(Number(r.availablePercentage || 0) * 100).toFixed(2)} %` : 'Valor calculado automáticamente'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right ${r.isAvailablePercentageManual ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50/60 dark:bg-slate-800/30'}`}>
                                                            <div className="flex items-center justify-end gap-1">
                                                                {r.isAvailablePercentageManual && <button type="button" onClick={() => handleRestoreField(r.id, 'availablePercentage')} title="Restaurar cálculo automático" className="text-amber-600"><RotateCcw size={12} /></button>}
                                                                <input type="number" step="0.01" disabled={isLocked} defaultValue={Number(r.availablePercentage || 0) * 100} onBlur={(e) => handleCellBlur(r.id, 'availablePercentage', Number(e.target.value) / 100)} className="w-full bg-transparent px-1 py-1 text-right focus:ring-1 focus:ring-blue-500 rounded" />
                                                            </div>
                                                        </td>

                                                        {/* BRUTO */}
                                                        <td title={r.isGrossManual ? `Calculado: ${Number(r.grossCalculated || 0).toFixed(2)} € · Manual efectivo: ${Number(r.gross || 0).toFixed(2)} €` : 'Valor calculado automáticamente'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right font-bold ${r.isGrossManual ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50/60 dark:bg-slate-800/30'}`}>
                                                            <div className="flex items-center justify-end gap-1">
                                                                {r.isGrossManual && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRestoreField(r.id, 'gross')}
                                                                        title="Restaurar cálculo automático"
                                                                        className="text-amber-600 hover:text-amber-800"
                                                                    >
                                                                        <RotateCcw size={12} />
                                                                    </button>
                                                                )}
                                                                <input
                                                                    type="number"
                                                                    step="0.0001"
                                                                    disabled={isLocked}
                                                                    defaultValue={Number(r.gross || 0)}
                                                                    onBlur={(e) => handleCellBlur(r.id, 'gross', Number(e.target.value))}
                                                                    className="w-full bg-transparent px-1 py-1 text-right font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 rounded"
                                                                />
                                                            </div>
                                                        </td>

                                                        {/* Productividad */}
                                                        <td title={r.isProductivityManual ? `Calculado: ${Number(r.productivityCalculated || 0).toFixed(4)} · Manual efectivo: ${Number(r.productivity || 0).toFixed(4)}` : 'Valor calculado automáticamente'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right ${r.isProductivityManual ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50/60 dark:bg-slate-800/30'}`}>
                                                            <div className="flex items-center justify-end gap-1">
                                                                {r.isProductivityManual && <button type="button" onClick={() => handleRestoreField(r.id, 'productivity')} title="Restaurar cálculo automático" className="text-amber-600"><RotateCcw size={12} /></button>}
                                                                <input
                                                                    type="number"
                                                                    step="0.0001"
                                                                    disabled={isLocked}
                                                                    defaultValue={Number(r.productivity || 0)}
                                                                    onBlur={(e) => handleCellBlur(r.id, 'productivity', Number(e.target.value))}
                                                                    className="w-full rounded bg-transparent px-2 py-1 text-right text-slate-800 focus:ring-1 focus:ring-blue-500 dark:text-slate-200"
                                                                />
                                                            </div>
                                                        </td>

                                                        {/* Horas */}
                                                        <td title={r.isHoursAmountManual ? `Calculado: ${Number(r.hoursCalculated || 0).toFixed(2)} € · Manual efectivo: ${Number(r.hoursAmount || 0).toFixed(2)} €` : 'Valor calculado automáticamente'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right ${r.isHoursAmountManual ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50/60 dark:bg-slate-800/30'}`}>
                                                            <div className="flex items-center justify-end gap-1">
                                                                {r.isHoursAmountManual && <button type="button" onClick={() => handleRestoreField(r.id, 'hoursAmount')} title="Restaurar cálculo automático" className="text-amber-600"><RotateCcw size={12} /></button>}
                                                                <input type="number" step="0.01" disabled={isLocked} defaultValue={Number(r.hoursAmount || 0)} onBlur={(e) => handleCellBlur(r.id, 'hoursAmount', Number(e.target.value))} className="w-full bg-transparent px-1 py-1 text-right focus:ring-1 focus:ring-blue-500 rounded" />
                                                            </div>
                                                        </td>

                                                        {/* Diferencia */}
                                                        <td title={r.isDifferenceManual ? `Calculado: ${Number(r.differenceCalculated || 0).toFixed(2)} € · Manual efectivo: ${Number(r.difference || 0).toFixed(2)} €` : 'Valor calculado automáticamente'} className={`p-1 border-r border-slate-100 dark:border-slate-800 text-right ${r.isDifferenceManual ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50/60 dark:bg-slate-800/30'}`}>
                                                            <div className="flex items-center justify-end gap-1">
                                                                {r.isDifferenceManual && <button type="button" onClick={() => handleRestoreField(r.id, 'difference')} title="Restaurar cálculo automático" className="text-amber-600"><RotateCcw size={12} /></button>}
                                                                <input type="number" step="0.01" disabled={isLocked} defaultValue={Number(r.difference || 0)} onBlur={(e) => handleCellBlur(r.id, 'difference', Number(e.target.value))} className="w-full bg-transparent px-1 py-1 text-right focus:ring-1 focus:ring-blue-500 rounded" />
                                                            </div>
                                                        </td>
                                                        {configurableConcepts.map((definition) => {
                                                            const concept = (r.conceptValues || []).find((item: any) => item.conceptConfigId === definition.conceptConfigId);
                                                            return <td key={definition.conceptConfigId} className="p-1 border-r border-slate-100 dark:border-slate-800 text-right"><input type="number" step="0.01" disabled={isLocked || !concept} defaultValue={Number(concept?.value || 0)} onBlur={(e) => concept && handleConceptBlur(r, concept.conceptConfigId, Number(e.target.value))} className="w-full bg-transparent px-1 py-1 text-right focus:ring-1 focus:ring-blue-500 rounded" /></td>;
                                                        })}
                                                    </tr>
                                                );
                                            })}

                                            {/* Subtotal del Grupo */}
                                            <tr className="payroll-detail-total border-t border-slate-200 bg-slate-100/60 font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                                                <td colSpan={3} className="p-2 pl-4 text-right">SUBTOTAL {dept}:</td>
                                                <td className="p-2 bg-slate-200/50 dark:bg-slate-800 sticky left-0">--</td>
                                                <td colSpan={2}></td>
                                                <td className="p-2 text-right text-blue-600 dark:text-blue-400 font-bold">{subtotal.total.toFixed(2)} €</td>
                                                <td className="p-2 text-right">{subtotal.posVar.toFixed(2)} €</td>
                                                <td colSpan={1}></td>
                                                <td className="p-2 text-right">{subtotal.diets.toFixed(2)} €</td>
                                                <td colSpan={3}></td>
                                                <td className="p-2 text-right font-bold text-slate-900 dark:text-white">{subtotal.gross.toFixed(2)} €</td>
                                                <td className="p-2 text-right">{subtotal.prod.toFixed(2)} €</td>
                                                <td className="p-2 text-right">{subtotal.hours.toFixed(2)} €</td>
                                                <td className="p-2 text-right">{subtotal.diff.toFixed(2)} €</td>
                                                {configurableConcepts.map((concept) => <td key={concept.conceptConfigId}></td>)}
                                            </tr>
                                        </Fragment>
                                    );
                                })}

                                {/* Fila Gran Total Final */}
                                <tr className="payroll-detail-total border-t-2 border-slate-700 bg-slate-900 text-sm font-bold text-white">
                                    <td colSpan={3} className="p-3 text-right">GRAN TOTAL GENERAL:</td>
                                    <td className="p-3 bg-slate-900 sticky left-0">TOTALES</td>
                                    <td colSpan={2}></td>
                                    <td className="p-3 text-right text-blue-400">{grandTotals.overtimeAmount.toFixed(2)} €</td>
                                    <td className="p-3 text-right text-emerald-400">{grandTotals.positiveVar.toFixed(2)} €</td>
                                    <td className="p-3 text-right text-rose-400">{grandTotals.negativeVar.toFixed(2)} €</td>
                                    <td className="p-3 text-right">{grandTotals.diets.toFixed(2)} €</td>
                                    <td colSpan={3}></td>
                                    <td className="p-3 text-right text-white font-extrabold text-base">{grandTotals.gross.toFixed(2)} €</td>
                                    <td className="p-3 text-right">{grandTotals.productivity.toFixed(2)} €</td>
                                    <td className="p-3 text-right">{grandTotals.hoursAmount.toFixed(2)} €</td>
                                    <td className="p-3 text-right">{grandTotals.difference.toFixed(2)} €</td>
                                    {configurableConcepts.map((concept) => <td key={concept.conceptConfigId}></td>)}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="sticky bottom-0 z-30 grid shrink-0 grid-cols-2 gap-px border-t border-slate-700 bg-slate-700 text-white sm:grid-cols-3 xl:grid-cols-6" aria-label="Resumen de cierre mensual">
                        <div className="bg-slate-950 px-4 py-2.5">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Trabajadores visibles</span>
                            <strong className="text-base">{filteredRecords.length}</strong>
                        </div>
                        <div className="bg-slate-950 px-4 py-2.5">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Incidencias código</span>
                            <strong className={reviewSummary.missingCodes ? 'text-rose-300' : 'text-emerald-300'}>{reviewSummary.missingCodes}</strong>
                        </div>
                        <div className="bg-slate-950 px-4 py-2.5">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Correcciones manuales</span>
                            <strong className={reviewSummary.manualOverrides ? 'text-amber-300' : 'text-emerald-300'}>{reviewSummary.manualOverrides}</strong>
                        </div>
                        <div className="bg-slate-950 px-4 py-2.5">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Horas extra</span>
                            <strong>{grandTotals.overtimeAmount.toFixed(2)} €</strong>
                        </div>
                        <div className="bg-slate-950 px-4 py-2.5">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Dietas</span>
                            <strong>{grandTotals.diets.toFixed(2)} €</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3 bg-slate-950 px-4 py-2.5">
                            <div>
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Bruto efectivo</span>
                                <strong className="text-lg">{grandTotals.gross.toFixed(2)} €</strong>
                            </div>
                            <span className={`h-2.5 w-2.5 rounded-full ${savingState === 'ERROR' ? 'bg-rose-400' : savingState === 'SAVING' ? 'animate-pulse bg-amber-300' : 'bg-emerald-400'}`} title={savingState === 'ERROR' ? 'Error al guardar' : savingState === 'SAVING' ? 'Guardando' : 'Guardado'} />
                        </div>
                    </div>
                </div>
            )}
                </div>
            </div>
            )}
            </>
            ) : !loading ? (
                <section className="rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 px-6 py-10 text-center dark:border-blue-800 dark:bg-blue-950/20">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-700 text-white">
                        <CalendarDays size={22} />
                    </div>
                    <h2 className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">
                        {MONTHS[month - 1]} {year} todavía no está asignado
                    </h2>
                    <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                        La consulta no crea datos automáticamente. Confirma la creación para asignar ahora los empleados activos y congelar su categoría, código de gestoría y datos mensuales iniciales.
                    </p>
                    <button
                        type="button"
                        onClick={handleCreatePeriod}
                        disabled={creatingPeriod || (isGlobalAdmin && !selectedCompanyId)}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {creatingPeriod ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        Crear período y asignar empleados
                    </button>
                </section>
            ) : null}

            {/* Modal para Reapertura con Justificación */}
            {reopenModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3 text-amber-600">
                            <Unlock size={24} />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reabrir Período Mensual</h3>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Por motivos de seguridad y auditoría, debe introducir una justificación explicativa para reabrir este período mensual de control.
                        </p>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Motivo de reapertura <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                rows={3}
                                value={reopenReason}
                                onChange={(e) => setReopenReason(e.target.value)}
                                placeholder="Ej: Ajuste solicitado por RRHH tras revisión de horas extra de carpintería..."
                                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => { setReopenModalOpen(false); setReopenReason(''); }}
                                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium rounded-xl transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={submitReopen}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
                            >
                                Confirmar Reapertura
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
