import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
    Star, Target, TrendingUp, Users, Calendar, Award, 
    Plus, Filter, ChevronRight, Clock, CheckCircle2,
    BarChart3, FileText, User
} from 'lucide-react';
import { 
    useEvaluations, 
    useObjectives, 
    usePDIs,
    useEvaluationStats,
    useObjectiveStats 
} from '../hooks/usePerformance';

type TabType = 'overview' | 'evaluations' | 'objectives' | 'pdis';

export default function PerformancePage() {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [statusFilter, setStatusFilter] = useState<string>('');

    // Queries
    const { data: evaluations, isLoading: evalLoading } = useEvaluations(
        statusFilter ? { status: statusFilter } : undefined
    );
    const { data: objectives, isLoading: objLoading } = useObjectives(
        statusFilter ? { status: statusFilter } : undefined
    );
    const { data: pdis, isLoading: pdiLoading } = usePDIs();
    const { data: evalStats } = useEvaluationStats();
    const { data: objStats } = useObjectiveStats();

    const isLoading = evalLoading || objLoading || pdiLoading;

    // Calculate summary stats
    const pendingEvaluations = evaluations?.filter(e => 
        e.status === 'DRAFT' || e.status === 'SELF_IN_PROGRESS'
    ).length || 0;
    
    const completedEvaluations = evaluations?.filter(e => 
        e.status === 'COMPLETED' || e.status === 'ACKNOWLEDGED'
    ).length || 0;

    const overdueObjectives = objectives?.filter(o => 
        new Date(o.dueDate) < new Date() && o.status !== 'COMPLETED'
    ).length || 0;

    const activePDIs = pdis?.filter(p => p.status === 'ACTIVE').length || 0;

    const tabs = [
        { id: 'overview', label: 'Resumen', icon: BarChart3 },
        { id: 'evaluations', label: 'Evaluaciones', icon: Star },
        { id: 'objectives', label: 'Objetivos', icon: Target },
        { id: 'pdis', label: 'Planes de Desarrollo', icon: TrendingUp },
    ];

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            'DRAFT': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
            'SELF_IN_PROGRESS': 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
            'MANAGER_IN_PROGRESS': 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400',
            'COMPLETED': 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400',
            'ACKNOWLEDGED': 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
            'NOT_STARTED': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
            'IN_PROGRESS': 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
            'ACTIVE': 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400',
            'CANCELLED': 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400',
        };
        return colors[status] || colors['DRAFT'];
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'DRAFT': 'Borrador',
            'SELF_IN_PROGRESS': 'Autoevaluación',
            'MANAGER_IN_PROGRESS': 'Evaluación Manager',
            'COMPLETED': 'Completada',
            'ACKNOWLEDGED': 'Confirmada',
            'NOT_STARTED': 'No iniciado',
            'IN_PROGRESS': 'En progreso',
            'ACTIVE': 'Activo',
            'CANCELLED': 'Cancelado',
        };
        return labels[status] || status;
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                            Gestión del Desempeño
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Evaluaciones, objetivos y planes de desarrollo
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-sm"
                        >
                            <option value="">Todos los estados</option>
                            <option value="DRAFT">Borrador</option>
                            <option value="IN_PROGRESS">En progreso</option>
                            <option value="COMPLETED">Completado</option>
                            <option value="ACTIVE">Activo</option>
                        </select>

                        <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors">
                            <Plus size={18} />
                            <span className="text-sm font-medium">Nuevo</span>
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                            activeTab === tab.id
                                ? 'bg-blue-500 text-white shadow-sm'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                        }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <>
                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
                                            <Clock size={20} className="text-amber-600 dark:text-amber-400" />
                                        </div>
                                        <span className="text-xs text-slate-500">Pendientes</span>
                                    </div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {pendingEvaluations}
                                    </div>
                                    <div className="text-sm text-slate-500">Evaluaciones pendientes</div>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl">
                                            <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <span className="text-xs text-slate-500">Completadas</span>
                                    </div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {completedEvaluations}
                                    </div>
                                    <div className="text-sm text-slate-500">Evaluaciones completadas</div>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-xl">
                                            <Target size={20} className="text-red-600 dark:text-red-400" />
                                        </div>
                                        <span className="text-xs text-slate-500">Vencidos</span>
                                    </div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {overdueObjectives}
                                    </div>
                                    <div className="text-sm text-slate-500">Objetivos vencidos</div>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-xl">
                                            <TrendingUp size={20} className="text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <span className="text-xs text-slate-500">Activos</span>
                                    </div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {activePDIs}
                                    </div>
                                    <div className="text-sm text-slate-500">Planes de desarrollo</div>
                                </motion.div>
                            </div>

                            {/* Recent Activity */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Recent Evaluations */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                            Evaluaciones Recientes
                                        </h3>
                                        <button 
                                            onClick={() => setActiveTab('evaluations')}
                                            className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                                        >
                                            Ver todas <ChevronRight size={16} />
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {evaluations?.slice(0, 5).map((evaluation) => (
                                            <div 
                                                key={evaluation.id}
                                                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                                        <User size={16} className="text-blue-600 dark:text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                                                            {evaluation.employee.name}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            {evaluation.template.name}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(evaluation.status)}`}>
                                                    {getStatusLabel(evaluation.status)}
                                                </span>
                                            </div>
                                        ))}
                                        {(!evaluations || evaluations.length === 0) && (
                                            <div className="text-center py-8 text-slate-400">
                                                No hay evaluaciones
                                            </div>
                                        )}
                                    </div>
                                </motion.div>

                                {/* Recent Objectives */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                            Objetivos Activos
                                        </h3>
                                        <button 
                                            onClick={() => setActiveTab('objectives')}
                                            className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                                        >
                                            Ver todos <ChevronRight size={16} />
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {objectives?.filter(o => o.status !== 'COMPLETED').slice(0, 5).map((objective) => (
                                            <div 
                                                key={objective.id}
                                                className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                                                        {objective.title}
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(objective.status)}`}>
                                                        {getStatusLabel(objective.status)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-blue-500 rounded-full transition-all"
                                                            style={{ width: `${objective.progress}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-slate-500 w-10 text-right">
                                                        {objective.progress}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {(!objectives || objectives.length === 0) && (
                                            <div className="text-center py-8 text-slate-400">
                                                No hay objetivos
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>
                        </>
                    )}

                    {/* Evaluations Tab */}
                    {activeTab === 'evaluations' && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 dark:bg-slate-800">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                Empleado
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                Plantilla
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                Período
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                Estado
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                Puntuación
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {evaluations?.map((evaluation) => (
                                            <tr key={evaluation.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                                            <User size={16} className="text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                                                                {evaluation.employee.name}
                                                            </div>
                                                            <div className="text-xs text-slate-500">
                                                                {evaluation.employee.jobTitle}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                                    {evaluation.template.name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                                    {new Date(evaluation.periodStart).toLocaleDateString()} - {new Date(evaluation.periodEnd).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(evaluation.status)}`}>
                                                        {getStatusLabel(evaluation.status)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                                    {evaluation.finalScore ? evaluation.finalScore.toFixed(1) : '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <button className="text-blue-500 hover:text-blue-600 text-sm font-medium">
                                                        Ver detalles
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {/* Objectives Tab */}
                    {activeTab === 'objectives' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {objectives?.map((objective) => (
                                <motion.div
                                    key={objective.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className={`p-2 rounded-lg ${
                                            objective.category === 'PERFORMANCE' ? 'bg-blue-100 dark:bg-blue-900' :
                                            objective.category === 'DEVELOPMENT' ? 'bg-purple-100 dark:bg-purple-900' :
                                            'bg-emerald-100 dark:bg-emerald-900'
                                        }`}>
                                            <Target size={18} className={
                                                objective.category === 'PERFORMANCE' ? 'text-blue-600 dark:text-blue-400' :
                                                objective.category === 'DEVELOPMENT' ? 'text-purple-600 dark:text-purple-400' :
                                                'text-emerald-600 dark:text-emerald-400'
                                            } />
                                        </div>
                                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(objective.status)}`}>
                                            {getStatusLabel(objective.status)}
                                        </span>
                                    </div>
                                    
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                                        {objective.title}
                                    </h4>
                                    
                                    <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                                        {objective.description || 'Sin descripción'}
                                    </p>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-500">Progreso</span>
                                            <span className="font-medium text-slate-900 dark:text-white">
                                                {objective.progress}%
                                            </span>
                                        </div>
                                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all ${
                                                    objective.progress >= 100 ? 'bg-emerald-500' :
                                                    objective.progress >= 50 ? 'bg-blue-500' :
                                                    'bg-amber-500'
                                                }`}
                                                style={{ width: `${objective.progress}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                            <Calendar size={12} />
                                            {new Date(objective.dueDate).toLocaleDateString()}
                                        </div>
                                        <button className="text-xs text-blue-500 hover:text-blue-600 font-medium">
                                            Actualizar
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {/* PDIs Tab */}
                    {activeTab === 'pdis' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {pdis?.map((pdi) => (
                                <motion.div
                                    key={pdi.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                                                <TrendingUp size={20} className="text-purple-600 dark:text-purple-400" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {pdi.employee.name}
                                                </h4>
                                                <p className="text-xs text-slate-500">
                                                    {pdi.employee.jobTitle}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(pdi.status)}`}>
                                            {getStatusLabel(pdi.status)}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 mb-4">
                                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                            <div className="text-lg font-bold text-slate-900 dark:text-white">
                                                {pdi.goals?.length || 0}
                                            </div>
                                            <div className="text-xs text-slate-500">Metas</div>
                                        </div>
                                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                            <div className="text-lg font-bold text-slate-900 dark:text-white">
                                                {pdi.skills?.length || 0}
                                            </div>
                                            <div className="text-xs text-slate-500">Habilidades</div>
                                        </div>
                                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                            <div className="text-lg font-bold text-slate-900 dark:text-white">
                                                {pdi.training?.length || 0}
                                            </div>
                                            <div className="text-xs text-slate-500">Formación</div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-500">Progreso general</span>
                                            <span className="font-medium text-slate-900 dark:text-white">
                                                {pdi.progress}%
                                            </span>
                                        </div>
                                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-purple-500 rounded-full transition-all"
                                                style={{ width: `${pdi.progress}%` }}
                                            />
                                        </div>
                                    </div>

                                    <button className="w-full mt-4 py-2 text-sm text-blue-500 hover:text-blue-600 font-medium border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        Ver detalle del plan
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}