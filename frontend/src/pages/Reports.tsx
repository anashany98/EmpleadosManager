import { useEffect, useMemo, useRef, useState, Fragment } from 'react';
import {
    Briefcase,
    Building2,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Download,
    FileText,
    Filter,
    LineChart,
    Search,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { api, API_URL } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import ReportScheduleModal from '../components/reports/ReportScheduleModal';

import type { ReportType, CompanyOption, DepartmentOptionsResponse } from '../features/reports/reportTypes';
import { reportsCatalog, reportCategories, getReportDefinition, getToneClasses } from '../features/reports/reportTypes';
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
    const [searchQuery, setSearchQuery] = useState('');
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

    // Filtra el catalogo por searchQuery (case-insensitive sobre
    // name + description) y lo agrupa por categoria. El orden de las
    // categorias lo fija reportCategories (estable) y se ocultan las
    // que no tienen matches para no dejar headers vacios.
    const groupedReports = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const filtered = q
            ? reportsCatalog.filter((report) =>
                report.name.toLowerCase().includes(q) ||
                report.description.toLowerCase().includes(q)
            )
            : reportsCatalog;

        return reportCategories
            .map((category) => ({
                category,
                reports: filtered.filter((report) => report.category === category.id)
            }))
            .filter((group) => group.reports.length > 0);
    }, [searchQuery]);

    const totalMatches = groupedReports.reduce((acc, g) => acc + g.reports.length, 0);

    // Scroll horizontal del strip de chips. Las flechas aparecen solo
    // cuando hay contenido fuera de vista en esa direccion. Se
    // recalcula en mount, en cada cambio del catalogo filtrado, en
    // resize y en scroll del propio strip.
    const stripRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollState = () => {
        const el = stripRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 1);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    };

    useEffect(() => {
        const el = stripRef.current;
        if (!el) return;
        updateScrollState();
        el.addEventListener('scroll', updateScrollState, { passive: true });
        window.addEventListener('resize', updateScrollState);
        return () => {
            el.removeEventListener('scroll', updateScrollState);
            window.removeEventListener('resize', updateScrollState);
        };
    }, [groupedReports]);

    // Scroll relativo: un click mueve ~3-4 chips (suficiente para
    // pasar al siguiente grupo). Usamos scrollBy con behavior smooth
    // para que se vea fluido, no brusco.
    const scrollStrip = (direction: -1 | 1) => {
        const el = stripRef.current;
        if (!el) return;
        const step = Math.max(240, Math.floor(el.clientWidth * 0.6));
        el.scrollBy({ left: direction * step, behavior: 'smooth' });
    };

    return (
        <div className="space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Strip horizontal arriba: buscador + chips de reportes por categoria */}
            <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 sm:max-w-md">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Buscar reporte…"
                            aria-label="Buscar reporte"
                            className="w-full pl-9 pr-9 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                aria-label="Limpiar búsqueda"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    {searchQuery && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            {totalMatches} coincidencia{totalMatches === 1 ? '' : 's'} para &laquo;{searchQuery}&raquo;
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => openScheduleModal(activeTab, activeReport.name)}
                        className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <Calendar size={14} /> Programar {activeReport.name}
                    </button>
                </div>

                {groupedReports.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center text-sm text-slate-500">
                        Ning&uacute;n reporte coincide con &laquo;{searchQuery}&raquo;.
                    </div>
                ) : (
                    <div className="relative group/strip">
                        {/* Flechas de navegacion. Aparecen solo cuando hay
                            contenido fuera de vista en esa direccion. Cada
                            flecha tiene un degradado detras para que el chip
                            que tape se vea "desdibujado" en el borde, sugiriendo
                            que hay mas. */}
                        {canScrollLeft && (
                            <>
                                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white dark:from-slate-900 to-transparent z-10 rounded-l-2xl" aria-hidden="true" />
                                <button
                                    type="button"
                                    onClick={() => scrollStrip(-1)}
                                    aria-label="Desplazar reportes a la izquierda"
                                    className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors touch-active"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                            </>
                        )}
                        {canScrollRight && (
                            <>
                                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white dark:from-slate-900 to-transparent z-10 rounded-r-2xl" aria-hidden="true" />
                                <button
                                    type="button"
                                    onClick={() => scrollStrip(1)}
                                    aria-label="Desplazar reportes a la derecha"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors touch-active"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </>
                        )}
                        <div
                            ref={stripRef}
                            className="flex overflow-x-auto gap-1.5 pb-1 -mx-1 px-1 no-scrollbar"
                            role="tablist"
                            aria-label="Selector de reportes"
                        >
                        {groupedReports.map(({ category, reports }, groupIdx) => (
                            <Fragment key={category.id}>
                                {groupIdx > 0 && (
                                    <div
                                        aria-hidden="true"
                                        className="shrink-0 w-px self-stretch bg-slate-200 dark:bg-slate-800 mx-1.5"
                                        title={category.label}
                                    />
                                )}
                                {reports.map((report) => {
                                    const ReportIcon = report.icon;
                                    const reportTone = getToneClasses(report.tone);
                                    const isActive = activeTab === report.id;
                                    return (
                                        <button
                                            type="button"
                                            key={report.id}
                                            role="tab"
                                            aria-selected={isActive}
                                            onClick={() => setActiveTab(report.id)}
                                            title={report.description}
                                            className={`shrink-0 group flex flex-col items-center justify-center gap-1.5 min-w-[120px] sm:min-w-[132px] px-3 py-2.5 rounded-2xl border transition-all duration-200 touch-active ${
                                                isActive
                                                    ? `${reportTone.soft} ${reportTone.border} shadow-md`
                                                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                            }`}
                                        >
                                            <div className={`p-2 rounded-xl ${isActive ? reportTone.soft : 'bg-slate-50 dark:bg-slate-800'} ${reportTone.text}`}>
                                                <ReportIcon size={18} />
                                            </div>
                                            <span className={`text-[11px] font-bold text-center leading-tight line-clamp-2 ${
                                                isActive ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'
                                            }`}>
                                                {report.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </Fragment>
                        ))}
                    </div>
                    </div>
                )}
            </div>

            {/* Contenido principal: filtros + KPIs + tabla */}
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

                <div className={`rounded-2xl sm:rounded-3xl border p-4 sm:p-5 ${toneClasses.soft} ${toneClasses.border}`}>
                    <div className={`inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] ${toneClasses.text}`}>
                        <LineChart size={14} />
                        Insight actual
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-7 mt-3">{reportInsight}</p>
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
                            {normalizedRows.length} registro(s) visibles &middot; {getPeriodLabel(activeTab, filters)}
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
                            <p className="text-sm font-medium text-slate-500">Calculando m&eacute;tricas y preparando resumen...</p>
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

            <AnimatePresence>
                {scheduleModal.isOpen && (
                    <ReportScheduleModal
                        isOpen={scheduleModal.isOpen}
                        onClose={() => setScheduleModal({ isOpen: false, reportType: '', reportName: '' })}
                        reportType={scheduleModal.reportType}
                        reportName={scheduleModal.reportName}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
