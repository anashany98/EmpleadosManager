import { useEffect, useMemo, useState } from 'react';
import {
    Briefcase,
    Building2,
    Calendar,
    ChevronRight,
    Download,
    FileText,
    Filter,
    LineChart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { api, API_URL } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import ReportScheduleModal from '../components/reports/ReportScheduleModal';

import type { ReportType, CompanyOption, DepartmentOptionsResponse } from '../features/reports/reportTypes';
import { reportsCatalog, getReportDefinition, getToneClasses } from '../features/reports/reportTypes';
import { extractResponseData, buildRequestParams, toQueryString, getPeriodLabel } from '../features/reports/reportHelpers';
import { getNormalizedRows, buildSummaryCards, buildInsight, buildPdfTable } from '../features/reports/reportDataProcessing';
import { FilterSelect, SummaryCard, ReportTableHead, ReportTableBody } from '../features/reports/reportTableComponents';

export default function Reports() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isGlobalAdmin = user?.role === 'admin' && !user?.companyId;

    const [activeTab, setActiveTab] = useState<ReportType>('ATTENDANCE');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [companies, setCompanies] = useState<CompanyOption[]>([]);
    const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
    const [filters, setFilters] = useState({
        companyId: '',
        department: '',
        status: '',
        month: (new Date().getMonth() + 1).toString(),
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
        year: new Date().getFullYear().toString()
    });

    const [scheduleModal, setScheduleModal] = useState<{ isOpen: boolean; reportType: string; reportName: string }>({
        isOpen: false,
        reportType: '',
        reportName: ''
    });

    const activeReport = getReportDefinition(activeTab);
    const ActiveReportIcon = activeReport.icon;
    const normalizedRows = useMemo(() => getNormalizedRows(activeTab, data), [activeTab, data]);
    const summaryCards = useMemo(() => buildSummaryCards(activeTab, normalizedRows, data), [activeTab, normalizedRows, data]);
    const reportInsight = useMemo(() => buildInsight(activeTab, normalizedRows, data), [activeTab, normalizedRows, data]);

    useEffect(() => {
        void fetchCompanies();
        void fetchDepartmentOptions();
    }, []);

    useEffect(() => {
        void fetchData();
    }, [activeTab, filters.companyId, filters.department, filters.start, filters.end, filters.year, filters.month, filters.status]);

    const fetchCompanies = async () => {
        try {
            const response = await api.get('/companies');
            setCompanies(extractResponseData<CompanyOption[]>(response) || []);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchDepartmentOptions = async () => {
        try {
            const response = await api.get('/employees/options');
            const options = extractResponseData<DepartmentOptionsResponse>(response);
            setDepartmentOptions(options?.departments || []);
        } catch (error) {
            console.error(error);
            setDepartmentOptions([]);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = buildRequestParams(activeTab, filters);
            const queryString = toQueryString(params);
            const response = await api.get(`${activeReport.endpoint}?${queryString}`);
            setData(extractResponseData<any>(response));
        } catch (error) {
            toast.error('Error al cargar el reporte');
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = () => {
        try {
            const params = buildRequestParams(activeTab, filters);
            params.format = 'xlsx';
            const queryString = toQueryString(params);
            window.open(`${API_URL}${activeReport.endpoint}?${queryString}`, '_blank');
        } catch (error) {
            toast.error('Error al exportar Excel');
        }
    };

    const handleExportPDF = async () => {
        try {
            const report = reportsCatalog.find(r => r.id === activeTab);
            if (!report) return;

            // H4: Lazy-import jspdf (~350KB) only when user clicks export
            const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
                import('jspdf'),
                import('jspdf-autotable')
            ]);

            const pdfTable = buildPdfTable(activeTab, normalizedRows, data);

            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text(report.name, 14, 20);
            doc.setFontSize(10);
            doc.text(`Generado el: ${new Date().toLocaleString('es-ES')}`, 14, 28);
            doc.text(`Periodo: ${getPeriodLabel(activeTab, filters)}`, 14, 34);
            doc.text(`Empresa: ${filters.companyId ? 'Filtrada' : 'Todas'} | Departamento: ${filters.department || 'Todos'}`, 14, 40);

            autoTable(doc, {
                startY: 48,
                head: [pdfTable.headers],
                body: pdfTable.body,
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42] },
                styles: { fontSize: 9, cellPadding: 2.5 }
            });

            doc.save(`Reporte_${activeTab}_${new Date().getTime()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Error al generar PDF');
        }
    };

    const openScheduleModal = (reportType: string, reportName: string) => {
        setScheduleModal({ isOpen: true, reportType, reportName });
    };

    const toneClasses = getToneClasses(activeReport.tone);
    const showCompanyFilter = isGlobalAdmin || companies.length > 1;

    return (
    <div className="space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4 sm:gap-8 items-start">
        <div className="space-y-3 sm:space-y-4">
          {reportsCatalog.map((report) => {
            const ReportIcon = report.icon;
            const reportTone = getToneClasses(report.tone);
            const isActive = activeTab === report.id;

            return (
              <div
                key={report.id}
                onClick={() => setActiveTab(report.id)}
                className={`w-full text-left p-3 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all duration-300 group touch-active cursor-pointer ${
                  isActive
                    ? `${reportTone.soft} ${reportTone.border} shadow-lg`
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                                <div className="flex items-start gap-4">
                                    <div className={`mt-0.5 p-3 rounded-2xl ${isActive ? reportTone.soft : 'bg-slate-50 dark:bg-slate-800'} ${reportTone.text}`}>
                                        <ReportIcon size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className={`font-black text-sm ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-100'}`}>{report.name}</h3>
                                            <ChevronRight size={16} className={`${isActive ? 'opacity-100 text-slate-500' : 'opacity-0 group-hover:opacity-100 text-slate-400'} transition-opacity`} />
                                        </div>
                                        <p className={`text-xs mt-2 leading-5 ${isActive ? 'text-slate-600 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>{report.description}</p>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openScheduleModal(report.id, report.name); }}
                                            className="flex items-center gap-2 px-3 py-1.5 text-xs border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors mt-2"
                                        >
                                            <Calendar size={14} />
                                            Programar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <div className={`rounded-2xl sm:rounded-3xl border p-4 sm:p-5 ${toneClasses.soft} ${toneClasses.border}`}>
                        <div className={`inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] ${toneClasses.text}`}>
                            <LineChart size={14} />
                            Insight actual
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-200 leading-7 mt-3">{reportInsight}</p>
                    </div>
                </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white dark:bg-slate-900 p-3 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-3 sm:gap-4">
                        {showCompanyFilter ? (
                            <FilterSelect
                                icon={Building2}
                                value={filters.companyId}
                                onChange={(value) => setFilters({ ...filters, companyId: value })}
                                options={[{ value: '', label: 'Todas las empresas' }, ...companies.map((company) => ({ value: company.id, label: company.name }))]}
                            />
                        ) : null}

                        <FilterSelect
                            icon={Filter}
                            value={filters.department}
                            onChange={(value) => setFilters({ ...filters, department: value })}
                            options={[{ value: '', label: 'Todos los departamentos' }, ...departmentOptions.map((department) => ({ value: department, label: department }))]}
                        />

                        {(activeTab === 'ATTENDANCE' || activeTab === 'OVERTIME' || activeTab === 'ABSENCES_DETAILED') ? (
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    type="date"
                                    value={filters.start}
                                    onChange={(event) => setFilters({ ...filters, start: event.target.value })}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none"
                                />
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">a</span>
                                <input
                                    type="date"
                                    value={filters.end}
                                    onChange={(event) => setFilters({ ...filters, end: event.target.value })}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none"
                                />
                            </div>
                        ) : activeTab === 'OBRA_SUMMARY' || activeTab === 'OBRA_EMPLOYEES' ? (
                            <div className="flex flex-wrap items-center gap-2">
                                {(activeTab === 'OBRA_SUMMARY') && (
                                    <select
                                        value={filters.status}
                                        onChange={(event) => setFilters({ ...filters, status: event.target.value })}
                                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none"
                                    >
                                        <option value="">Todas (activas y cerradas)</option>
                                        <option value="ACTIVE">Solo activas</option>
                                        <option value="INACTIVE">Solo cerradas</option>
                                    </select>
                                )}
                                <input
                                    type="date"
                                    value={filters.start}
                                    onChange={(event) => setFilters({ ...filters, start: event.target.value })}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none"
                                />
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">a</span>
                                <input
                                    type="date"
                                    value={filters.end}
                                    onChange={(event) => setFilters({ ...filters, end: event.target.value })}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none"
                                />
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center gap-3">
                                <input
                                    type="number"
                                    value={filters.year}
                                    onChange={(event) => setFilters({ ...filters, year: event.target.value })}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium w-24 outline-none"
                                />
                                {activeTab !== 'VACATIONS' && activeTab !== 'GENDER_GAP' ? (
                                    <select
                                        value={filters.month}
                                        onChange={(event) => setFilters({ ...filters, month: event.target.value })}
                                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none"
                                    >
                                        <option value="">Todo el año</option>
                                        {Array.from({ length: 12 }).map((_, index) => (
                                            <option key={index + 1} value={String(index + 1)}>{new Date(0, index).toLocaleString('es-ES', { month: 'long' })}</option>
                                        ))}
                                    </select>
                                ) : null}
                            </div>
                        )}

                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            <button onClick={() => void handleExportExcel()} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
                                <Download size={14} /> Excel
                            </button>
                            <button onClick={() => void handleExportPDF()} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300 font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors">
                                <FileText size={14} /> PDF
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                        {summaryCards.map((card) => (
                            <SummaryCard key={card.label} data={card} />
                        ))}
                    </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden min-h-[400px] sm:min-h-[520px]">
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 bg-slate-50/70 dark:bg-slate-950/40">
                            <div>
                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-[0.2em] ${toneClasses.soft} ${toneClasses.text}`}>
                                    <ActiveReportIcon size={14} />
                                    {activeReport.name}
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 max-w-3xl">{activeReport.description}</p>
                            </div>
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                {normalizedRows.length} registro(s) visibles · {getPeriodLabel(activeTab, filters)}
                                {(activeTab === 'OBRA_SUMMARY' || activeTab === 'OBRA_EMPLOYEES') && (
                                    <button
                                        onClick={() => navigate('/obras')}
                                        className="ml-2 inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-500/20"
                                    >
                                        <Briefcase size={12} /> Ir a Obras
                                    </button>
                                )}
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-[460px] gap-4">
                                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm font-medium text-slate-500">Calculando métricas y preparando resumen...</p>
                            </div>
                        ) : normalizedRows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[460px] gap-4 px-6 text-center">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${toneClasses.soft} ${toneClasses.text}`}>
                                    <ActiveReportIcon size={28} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Sin datos para este periodo</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg">Ajusta las fechas, la empresa o el departamento para obtener un conjunto de datos relevante.</p>
                                </div>
                            </div>
                        ) : (
                            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="table-responsive">
                <table className="w-full text-left text-sm min-w-[980px]">
                                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                            <ReportTableHead activeTab={activeTab} />
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            <ReportTableBody activeTab={activeTab} rows={normalizedRows} />
                                        </tbody>
                                    </table>
                                </motion.div>
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </div>
        </div>

    );
}
