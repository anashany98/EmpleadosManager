import { useState, useEffect } from 'react';
import {
    FileText,
    Download,
    Calendar,
    Clock,
    TrendingUp,
    Filter,
    ChevronRight,
    Building2,
    AlertTriangle,
    LineChart,
    Users
} from 'lucide-react';
import { api } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ReportType = 'ATTENDANCE' | 'OVERTIME' | 'VACATIONS' | 'COSTS' | 'ABSENCES_DETAILED' | 'KPIS' | 'GENDER_GAP';

export default function Reports() {
    const [activeTab, setActiveTab] = useState<ReportType>('ATTENDANCE');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [companies, setCompanies] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        companyId: '',
        department: '',
        month: (new Date().getMonth() + 1).toString(),
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
        year: new Date().getFullYear().toString()
    });

    const categories = [
        { id: 'ATTENDANCE', name: 'Asistencia y Fichajes', icon: <Clock size={20} />, description: 'Registros de entrada, salida y horas totales.' },
        { id: 'OVERTIME', name: 'Horas Extra y Costes', icon: <TrendingUp size={20} />, description: 'Análisis de horas adicionales y su impacto económico.' },
        { id: 'VACATIONS', name: 'Saldos de Vacaciones', icon: <Calendar size={20} />, description: 'Resumen de días consumidos y saldos por empleado.' },
        { id: 'COSTS', name: 'Coste Empresa (BI)', icon: <Building2 size={20} />, description: 'Desglose de Bruto + SS Empresa para análisis financiero.' },
        { id: 'ABSENCES_DETAILED', name: 'Detalle de Bajas (Audit)', icon: <AlertTriangle size={20} />, description: 'Listado cronológico de todas las bajas y suspensiones.' },
        { id: 'KPIS', name: 'KPIs de Organización', icon: <LineChart size={20} />, description: 'Tasas de absentismo y rotación por departamento.' },
        { id: 'GENDER_GAP', name: 'Igualdad y Diversidad', icon: <Users size={20} />, description: 'Análisis de brecha salarial y paridad por departamentos.' }
    ];

    useEffect(() => {
        fetchCompanies();
    }, []);

    useEffect(() => {
        fetchData();
    }, [activeTab, filters.companyId, filters.department, filters.start, filters.end, filters.year, filters.month]);

    const fetchCompanies = async () => {
        try {
            const res = await api.get('/companies');
            // const baseUrl = 'http://192.168.1.38:3000';
            setCompanies(res.data || res || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let endpoint = '';
            let params: any = {
                companyId: filters.companyId,
                department: filters.department
            };

            if (activeTab === 'ATTENDANCE') {
                endpoint = '/reports/attendance';
                params.start = filters.start;
                params.end = filters.end;
            } else if (activeTab === 'OVERTIME') {
                endpoint = '/reports/overtime';
                params.start = filters.start;
                params.end = filters.end;
            } else if (activeTab === 'VACATIONS') {
                endpoint = '/reports/vacations';
                params.year = filters.year;
            } else if (activeTab === 'COSTS') {
                endpoint = '/reports/costs';
                params.year = filters.year;
                params.month = filters.month;
            } else if (activeTab === 'ABSENCES_DETAILED') {
                endpoint = '/reports/absences-detailed';
                params.start = filters.start;
                params.end = filters.end;
            } else if (activeTab === 'KPIS') {
                endpoint = '/reports/kpis';
                params.year = filters.year;
                params.month = filters.month;
            } else if (activeTab === 'GENDER_GAP') {
                endpoint = '/reports/gender-gap';
                params.year = filters.year;
            }

            const queryString = new URLSearchParams(params).toString();
            const res = await api.get(`${endpoint}?${queryString}`);
            setData(res.data || res);
        } catch (err) {
            toast.error('Error al cargar datos del reporte');
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = async () => {
        try {
            toast.info('Generando Excel...');
            let endpoint = '';
            if (activeTab === 'ATTENDANCE') endpoint = '/reports/attendance';
            else if (activeTab === 'OVERTIME') endpoint = '/reports/overtime';
            else if (activeTab === 'VACATIONS') endpoint = '/reports/vacations';
            else if (activeTab === 'COSTS') endpoint = '/reports/costs';
            else if (activeTab === 'KPIS') endpoint = '/reports/kpis';
            else if (activeTab === 'GENDER_GAP') endpoint = '/reports/gender-gap';
            else endpoint = '/reports/absences-detailed';

            const params = { ...filters, format: 'xlsx' };
            const queryString = new URLSearchParams(params as any).toString();

            window.open(`${'http://192.168.1.38:3000/api'}${endpoint}?${queryString}`, '_blank');
        } catch (err) {
            toast.error('Error al exportar Excel');
        }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const title = categories.find(c => c.id === activeTab)?.name || 'Reporte';

        doc.setFontSize(18);
        doc.text(title, 14, 20);
        doc.setFontSize(10);
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`Filtros: ${filters.companyId ? 'Empresa seleccionada' : 'Todas'} | ${filters.department || 'Todos'}`, 14, 34);

        let tableData: any[] = [];
        let headers: string[] = [];

        if (activeTab === 'ATTENDANCE') {
            headers = ['Empleado', 'Fecha', 'Entrada', 'Salida', 'Horas'];
            tableData = (data || []).map((item: any) => [
                item.employee.name,
                new Date(item.date).toLocaleDateString(),
                item.checkIn ? new Date(item.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
                item.checkOut ? new Date(item.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
                item.totalHours.toFixed(2)
            ]);
        } else if (activeTab === 'OVERTIME') {
            headers = ['Empleado', 'Fecha', 'Horas', 'Precio/H', 'Total'];
            tableData = (data || []).map((item: any) => [
                item.employee.name,
                new Date(item.date).toLocaleDateString(),
                item.hours,
                `${item.rate.toFixed(2)}€`,
                `${item.totalCost.toFixed(2)}€`
            ]);
        } else if (activeTab === 'VACATIONS') {
            headers = ['Empleado', 'Depto', 'Cuota', 'Gastados', 'Quedan'];
            tableData = (data || []).map((item: any) => [
                item.name, item.department || '-', item.totalQuota, item.usedDays, item.remainingDays
            ]);
        } else if (activeTab === 'COSTS') {
            headers = ['Empleado', 'Bruto', 'SS Empresa', 'Neto', 'COSTE TOTAL'];
            tableData = (data || []).map((item: any) => [
                item.name, `${item.bruto.toFixed(2)}€`, `${item.ssEmpresa.toFixed(2)}€`, `${item.neto.toFixed(2)}€`, `${item.totalCost.toFixed(2)}€`
            ]);
        } else if (activeTab === 'KPIS') {
            tableData = (data?.deptStats || []).map((item: any) => [
                item.department, item.employees, item.absenceDays, `${item.rate}%`
            ]);
        } else if (activeTab === 'GENDER_GAP') {
            headers = ['Concepto', 'Masculino', 'Femenino', 'Brecha %'];
            tableData = [
                ['Plantilla', data?.summary?.maleCount, data?.summary?.femaleCount, `${data?.summary?.gapPercentage}%`],
                ['Sueldo Medio', `${data?.summary?.maleAvgBruto?.toFixed(2)}€`, `${data?.summary?.femaleAvgBruto?.toFixed(2)}€`, '-']
            ];
        } else {
            headers = ['Empleado', 'Inicio', 'Fin', 'Días', 'Tipo'];
            tableData = (data || []).map((item: any) => [
                item.employee.name, new Date(item.startDate).toLocaleDateString(), new Date(item.endDate).toLocaleDateString(), item.days, item.type
            ]);
        }

        autoTable(doc, {
            startY: 40,
            head: [headers],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59] }
        });

        doc.save(`Reporte_${activeTab}_${new Date().getTime()}.pdf`);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <FileText className="text-blue-500" size={32} />
                        Reportes de Gestión
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Genera y exporta informes detallados para Administración y RRHH.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="space-y-3">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id as ReportType)}
                            className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 group
                                ${activeTab === cat.id
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-blue-300'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${activeTab === cat.id ? 'bg-white/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                                    {cat.icon}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-sm tracking-tight">{cat.name}</h3>
                                    <p className={`text-[10px] mt-1 leading-tight ${activeTab === cat.id ? 'text-blue-100' : 'text-slate-400'}`}>
                                        {cat.description}
                                    </p>
                                </div>
                                <ChevronRight size={16} className={`${activeTab === cat.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`} />
                            </div>
                        </button>
                    ))}

                    <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-indigo-700 to-blue-800 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <TrendingUp size={80} />
                        </div>
                        <h4 className="font-bold text-sm uppercase tracking-widest text-blue-100 mb-2">BI Insights</h4>
                        <p className="text-xs text-blue-50 leading-relaxed">
                            Los reportes de <strong>KPIs</strong> permiten identificar fugas de talento y departamentos con alto absentismo.
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800">
                            <Building2 size={16} className="text-slate-400" />
                            <select
                                value={filters.companyId}
                                onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
                                className="bg-transparent text-sm font-medium outline-none text-slate-700 dark:text-slate-200"
                            >
                                <option value="">Todas las Empresas</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800">
                            <Filter size={16} className="text-slate-400" />
                            <select
                                value={filters.department}
                                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                                className="bg-transparent text-sm font-medium outline-none text-slate-700 dark:text-slate-200"
                            >
                                <option value="">Todos los Deptos.</option>
                                <option value="IT">IT</option>
                                <option value="Ventas">Ventas</option>
                                <option value="Logística">Logística</option>
                                <option value="Recursos Humanos">Recursos Humanos</option>
                                <option value="Operaciones">Operaciones</option>
                                <option value="Finanzas">Finanzas</option>
                            </select>
                        </div>

                        {activeTab === 'ATTENDANCE' || activeTab === 'OVERTIME' || activeTab === 'ABSENCES_DETAILED' ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={filters.start}
                                    onChange={(e) => setFilters({ ...filters, start: e.target.value })}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-sm font-medium outline-none"
                                />
                                <span className="text-slate-400 text-xs font-bold">AL</span>
                                <input
                                    type="date"
                                    value={filters.end}
                                    onChange={(e) => setFilters({ ...filters, end: e.target.value })}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-sm font-medium outline-none"
                                />
                            </div>
                        ) : activeTab === 'COSTS' || activeTab === 'KPIS' || activeTab === 'GENDER_GAP' ? (
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    value={filters.year}
                                    onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-sm font-medium w-20 outline-none"
                                />
                                {activeTab !== 'GENDER_GAP' && (
                                    <select
                                        value={filters.month}
                                        onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-sm font-medium outline-none"
                                    >
                                        <option value="">Todo el año</option>
                                        {Array.from({ length: 12 }).map((_, i) => (
                                            <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('es', { month: 'long' })}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800">
                                <Calendar size={16} className="text-slate-400" />
                                <input
                                    type="number"
                                    value={filters.year}
                                    onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                                    className="bg-transparent text-sm font-medium outline-none text-slate-700 dark:text-slate-200 w-16"
                                />
                            </div>
                        )}

                        <div className="flex-1 flex justify-end gap-2">
                            <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-colors">
                                <Download size={14} /> EXCEL
                            </button>
                            <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 rounded-xl font-bold text-xs hover:bg-rose-100 transition-colors">
                                <FileText size={14} /> PDF
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm min-h-[500px]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-[500px] gap-4">
                                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm font-medium text-slate-500">Analizando métricas...</p>
                            </div>
                        ) : (
                            <AnimatePresence mode="wait">
                                <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                            {activeTab === 'ATTENDANCE' && (
                                                <tr>
                                                    <th className="px-6 py-4 font-bold">Empleado</th>
                                                    <th className="px-6 py-4 font-bold text-center">Fecha</th>
                                                    <th className="px-6 py-4 font-bold text-center">Entrada</th>
                                                    <th className="px-6 py-4 font-bold text-center">Salida</th>
                                                    <th className="px-6 py-4 font-bold text-right">Horas</th>
                                                </tr>
                                            )}
                                            {activeTab === 'OVERTIME' && (
                                                <tr>
                                                    <th className="px-6 py-4 font-bold">Empleado</th>
                                                    <th className="px-6 py-4 font-bold text-center">Fecha</th>
                                                    <th className="px-6 py-4 font-bold text-center">Horas</th>
                                                    <th className="px-6 py-4 font-bold text-center">Tasa (€/h)</th>
                                                    <th className="px-6 py-4 font-bold text-right">Coste Total</th>
                                                </tr>
                                            )}
                                            {activeTab === 'VACATIONS' && (
                                                <tr>
                                                    <th className="px-6 py-4 font-bold">Empleado</th>
                                                    <th className="px-6 py-4 font-bold">Depto.</th>
                                                    <th className="px-6 py-4 font-bold text-center">Anual</th>
                                                    <th className="px-6 py-4 font-bold text-center">Gastados</th>
                                                    <th className="px-6 py-4 font-bold text-right">Sobrante</th>
                                                </tr>
                                            )}
                                            {activeTab === 'COSTS' && (
                                                <tr>
                                                    <th className="px-6 py-4 font-bold">Empleado</th>
                                                    <th className="px-6 py-4 font-bold text-right">Sueldo Bruto</th>
                                                    <th className="px-6 py-4 font-bold text-right">SS Empresa</th>
                                                    <th className="px-6 py-4 font-bold text-right">IRPF</th>
                                                    <th className="px-6 py-4 font-bold text-right">COSTE TOTAL</th>
                                                </tr>
                                            )}
                                            {activeTab === 'ABSENCES_DETAILED' && (
                                                <tr>
                                                    <th className="px-6 py-4 font-bold">Empleado</th>
                                                    <th className="px-6 py-4 font-bold text-center">Desde</th>
                                                    <th className="px-6 py-4 font-bold text-center">Hasta</th>
                                                    <th className="px-6 py-4 font-bold text-center">Días</th>
                                                    <th className="px-6 py-4 font-bold text-right">Tipo</th>
                                                </tr>
                                            )}
                                            {activeTab === 'KPIS' && (
                                                <tr>
                                                    <th className="px-6 py-4 font-bold">Departamento</th>
                                                    <th className="px-6 py-4 font-bold text-center">Empleados</th>
                                                    <th className="px-6 py-4 font-bold text-center">Días Ausencia</th>
                                                    <th className="px-6 py-4 font-bold text-right">Tasa %</th>
                                                </tr>
                                            )}
                                            {activeTab === 'GENDER_GAP' && (
                                                <tr>
                                                    <th className="px-6 py-4 font-bold">Concepto / Dimensión</th>
                                                    <th className="px-6 py-4 font-bold text-center">Masculino</th>
                                                    <th className="px-6 py-4 font-bold text-center">Femenino</th>
                                                    <th className="px-6 py-4 font-bold text-right">Brecha / Gap %</th>
                                                </tr>
                                            )}
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {activeTab === 'KPIS' && data?.summary && (
                                                <tr className="bg-indigo-50/20 dark:bg-indigo-900/5">
                                                    <td colSpan={4} className="p-6">
                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                            <KPICard title="Plantilla" value={data.summary.headcount} subtitle="Promedio" />
                                                            <KPICard title="Altas/Bajas" value={`${data.summary.hires}/${data.summary.exits}`} subtitle="Movimiento" color="text-blue-500" />
                                                            <KPICard title="Rotación" value={`${data.summary.turnoverRate}%`} subtitle="Tasa mensual" color="text-amber-500" />
                                                            <KPICard title="Absentismo" value={`${data.summary.absenteeismRate}%`} subtitle="Global" color="text-indigo-600" />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                            {activeTab === 'GENDER_GAP' && data?.summary && (
                                                <tr className="bg-blue-50/20 dark:bg-blue-900/5">
                                                    <td colSpan={4} className="p-6">
                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                            <KPICard title="Brecha Salarial" value={`${data.summary.gapPercentage}%`} subtitle="Diferencia global" color="text-rose-600" />
                                                            <KPICard title="Sueldo Medio H" value={`${data.summary.maleAvgBruto.toFixed(2)}€`} subtitle="Hombres" />
                                                            <KPICard title="Sueldo Medio M" value={`${data.summary.femaleAvgBruto.toFixed(2)}€`} subtitle="Mujeres" />
                                                            <KPICard title="Paridad (M/H)" value={`${data.summary.femaleCount}/${data.summary.maleCount}`} subtitle="Distribución" color="text-indigo-500" />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                            {(!data || (Array.isArray(data) ? data.length === 0 : (activeTab === 'GENDER_GAP' ? data.rows?.length === 0 : data.deptStats?.length === 0))) ? (
                                                <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400">Sin datos para este periodo.</td></tr>
                                            ) : (Array.isArray(data) ? data : (activeTab === 'GENDER_GAP' ? data.rows : data.deptStats)).map((item: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    {activeTab === 'GENDER_GAP' && (
                                                        <>
                                                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white uppercase tracking-tighter text-xs">{item.department || 'GLOBAL'}</td>
                                                            <td className="px-6 py-4 text-center font-mono">{(item.maleAvg || 0).toFixed(2)}€ <span className="text-[10px] text-slate-400 opacity-50 block font-sans">(n={item.maleCount})</span></td>
                                                            <td className="px-6 py-4 text-center font-mono">{(item.femaleAvg || 0).toFixed(2)}€ <span className="text-[10px] text-slate-400 opacity-50 block font-sans">(n={item.femaleCount})</span></td>
                                                            <td className={`px-6 py-4 text-right font-black ${item.gap > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{(item.gap || 0).toFixed(2)}%</td>
                                                        </>
                                                    )}
                                                    {activeTab === 'ATTENDANCE' && (
                                                        <>
                                                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                                                                    {item.employee?.name?.charAt(0) || '?'}
                                                                </div>
                                                                {item.employee?.name || 'N/A'}
                                                            </td>
                                                            <td className="px-6 py-4 text-center text-slate-500">{item.date ? new Date(item.date).toLocaleDateString() : '-'}</td>
                                                            <td className="px-6 py-4 text-center font-mono text-emerald-600">{item.checkIn ? new Date(item.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                                            <td className="px-6 py-4 text-center font-mono text-rose-600">{item.checkOut ? new Date(item.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                                            <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">{(item.totalHours || 0).toFixed(2)}h</td>
                                                        </>
                                                    )}
                                                    {activeTab === 'OVERTIME' && (
                                                        <>
                                                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{item.employee?.name || 'N/A'}</td>
                                                            <td className="px-6 py-4 text-center">{item.date ? new Date(item.date).toLocaleDateString() : '-'}</td>
                                                            <td className="px-6 py-4 text-center">{(item.hours || 0).toFixed(1)}h</td>
                                                            <td className="px-6 py-4 text-center">{(item.rate || 0).toFixed(2)}€/h</td>
                                                            <td className="px-6 py-4 text-right font-bold text-indigo-600">{(item.totalCost || 0).toFixed(2)}€</td>
                                                        </>
                                                    )}
                                                    {activeTab === 'VACATIONS' && (
                                                        <>
                                                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                                                            <td className="px-6 py-4 text-left text-slate-500 text-xs">{item.department || '-'}</td>
                                                            <td className="px-6 py-4 text-center font-bold">{item.totalQuota}</td>
                                                            <td className="px-6 py-4 text-center text-rose-500">{item.usedDays}</td>
                                                            <td className="px-6 py-4 text-right font-bold text-emerald-600">{item.remainingDays}</td>
                                                        </>
                                                    )}
                                                    {activeTab === 'COSTS' && (
                                                        <>
                                                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                                                            <td className="px-6 py-4 text-right font-mono">{(item.bruto || 0).toFixed(2)}€</td>
                                                            <td className="px-6 py-4 text-right font-mono">{(item.ssEmpresa || 0).toFixed(2)}€</td>
                                                            <td className="px-6 py-4 text-right font-mono text-amber-600">{(item.irpf || 0).toFixed(2)}€</td>
                                                            <td className="px-6 py-4 text-right font-bold text-indigo-600">{(item.totalCost || 0).toFixed(2)}€</td>
                                                        </>
                                                    )}
                                                    {activeTab === 'KPIS' && (
                                                        <>
                                                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{item.department}</td>
                                                            <td className="px-6 py-4 text-center">{item.employees}</td>
                                                            <td className="px-6 py-4 text-center text-rose-500">{item.absenceDays}</td>
                                                            <td className="px-6 py-4 text-right font-black text-indigo-600">{item.rate}%</td>
                                                        </>
                                                    )}
                                                    {activeTab === 'ABSENCES_DETAILED' && (
                                                        <>
                                                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{item.employee?.name || 'N/A'}</td>
                                                            <td className="px-6 py-4 text-center">{new Date(item.startDate).toLocaleDateString()}</td>
                                                            <td className="px-6 py-4 text-center">{new Date(item.endDate).toLocaleDateString()}</td>
                                                            <td className="px-6 py-4 text-center font-bold text-indigo-500">{item.days}</td>
                                                            <td className="px-6 py-4 text-right"><span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold uppercase">{item.type}</span></td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
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

function KPICard({ title, value, subtitle, color = "text-slate-800 dark:text-white" }: any) {
    return (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
            <h4 className={`text-xl font-black mt-1 ${color}`}>{value}</h4>
            <p className="text-[10px] text-slate-400 mt-1">{subtitle}</p>
        </div>
    );
}
