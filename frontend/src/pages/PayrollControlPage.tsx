import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    AlertCircle, Landmark, Loader2, Maximize2, RefreshCw, Rows3, Table2, X
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import PayrollControlHeader from './payroll-control/PayrollControlHeader';
import MonthlyHistorySection from './payroll-control/MonthlyHistorySection';
import ControlToolbar from './payroll-control/ControlToolbar';
import GestoriaView from './payroll-control/GestoriaView';
import MonthlyControlGrid from './payroll-control/MonthlyControlGrid';
import EmptyPeriodState from './payroll-control/EmptyPeriodState';
import ReopenModal from './payroll-control/ReopenModal';
import { controlHorarioTotals, MONTHS, PERIOD_STATUS_LABELS } from './payroll-control/types';
import type { MonthlyHistoryItem, PayrollExportHistoryItem } from './payroll-control/types';

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
    const gestoriaPreviewRows = useMemo(() => new Map<string, any>(
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
    const columnCount = 20 + configurableConcepts.length;

    // Totales Generales
    const grandTotals = useMemo(() => {
        return filteredRecords.reduce((acc, r) => {
            const horario = controlHorarioTotals(r);
            return {
                overtimeAmount: acc.overtimeAmount + Number(r.totalOvertimeAmount || 0),
                positiveVar: acc.positiveVar + Number(r.positiveVariable || 0),
                negativeVar: acc.negativeVar + Number(r.negativeVariable || 0),
                diets: acc.diets + Number(r.diets || 0),
                gross: acc.gross + Number(r.gross || 0),
                productivity: acc.productivity + Number(r.productivity || 0),
                hoursAmount: acc.hoursAmount + Number(r.hoursAmount || 0),
                difference: acc.difference + Number(r.difference || 0),
                trabajadas: acc.trabajadas + horario.trabajadas,
                planificadas: acc.planificadas + horario.planificadas,
                horarioDiferencia: acc.horarioDiferencia + horario.diferencia
            };
        }, {
            overtimeAmount: 0, positiveVar: 0, negativeVar: 0, diets: 0,
            gross: 0, productivity: 0, hoursAmount: 0, difference: 0,
            trabajadas: 0, planificadas: 0, horarioDiferencia: 0
        });
    }, [filteredRecords]);

    return (
        <div className="space-y-6">
            <PayrollControlHeader
                isGlobalAdmin={isGlobalAdmin}
                companies={companies}
                selectedCompanyId={selectedCompanyId}
                loadingCompanies={loadingCompanies}
                onCompanyChange={handleCompanyChange}
                savingState={savingState}
                month={month}
                year={year}
                onMonthChange={(value) => setMonth(value)}
                onYearChange={(value) => setYear(value)}
                isClosed={isClosed}
                period={period}
                onStatusChange={handleStatusChange}
                exporting={exporting}
                onExportGestoria={handleExportGestoria}
                recordsLength={records.length}
                reviewSummary={reviewSummary}
                grandTotals={grandTotals}
            />

            <MonthlyHistorySection
                loadingHistory={loadingHistory}
                history={history}
                year={year}
                month={month}
                onOpenHistoryPeriod={openHistoryPeriod}
                period={period}
                loadingExports={loadingExports}
                exportHistory={exportHistory}
                onDownloadExport={handleDownloadExport}
            />

            {period ? (
            <>
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
                    <ControlToolbar
                        controlModalOpen={controlModalOpen}
                        filterText={filterText}
                        onFilterTextChange={setFilterText}
                        selectedDept={selectedDept}
                        onDeptChange={setSelectedDept}
                        departments={departments}
                        recordsLength={records.length}
                        activeView={activeView}
                        groupBy={groupBy}
                        onGroupByChange={setGroupBy}
                        columnPreset={columnPreset}
                        onColumnPresetChange={handleColumnPresetChange}
                        gestoriaStatusFilter={gestoriaStatusFilter}
                        onGestoriaStatusFilterChange={setGestoriaStatusFilter}
                    />
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
                            <Loader2 className="animate-spin" size={24} />
                            <span>Cargando tabla de control general...</span>
                        </div>
                    ) : activeView === 'GESTORIA' ? (
                        <GestoriaView
                            recordsLength={records.length}
                            reviewSummary={reviewSummary}
                            gestoriaPreview={gestoriaPreview}
                            gestoriaColumns={gestoriaColumns}
                            visibleGestoriaRecords={visibleGestoriaRecords}
                            gestoriaPreviewRows={gestoriaPreviewRows}
                            gestoriaTotals={gestoriaTotals}
                            isLocked={isLocked}
                            lastSavedRecordId={lastSavedRecordId}
                            onCellBlur={handleCellBlur}
                            onRestoreField={handleRestoreField}
                            onConceptBlur={handleConceptBlur}
                        />
                    ) : Object.keys(groupedRecords).length === 0 ? (
                        <div className="p-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                            No hay registros de empleados para el filtro seleccionado.
                        </div>
                    ) : (
                        <MonthlyControlGrid
                            controlModalOpen={controlModalOpen}
                            columnPreset={columnPreset}
                            tableDensity={tableDensity}
                            groupedRecords={groupedRecords}
                            configurableConcepts={configurableConcepts}
                            columnCount={columnCount}
                            isClosed={isClosed}
                            isLocked={isLocked}
                            lastSavedRecordId={lastSavedRecordId}
                            grandTotals={grandTotals}
                            visibleCount={filteredRecords.length}
                            missingCodes={reviewSummary.missingCodes}
                            manualOverrides={reviewSummary.manualOverrides}
                            savingState={savingState}
                            onCellBlur={handleCellBlur}
                            onRestoreField={handleRestoreField}
                            onConceptBlur={handleConceptBlur}
                        />
                    )}
                </div>
            </div>
            )}
            </>
            ) : !loading ? (
                <EmptyPeriodState
                    month={month}
                    year={year}
                    creatingPeriod={creatingPeriod}
                    isGlobalAdmin={isGlobalAdmin}
                    selectedCompanyId={selectedCompanyId}
                    onCreatePeriod={handleCreatePeriod}
                />
            ) : null}

            <ReopenModal
                open={reopenModalOpen}
                reason={reopenReason}
                onReasonChange={setReopenReason}
                onCancel={() => { setReopenModalOpen(false); setReopenReason(''); }}
                onSubmit={submitReopen}
            />
        </div>
    );
}
