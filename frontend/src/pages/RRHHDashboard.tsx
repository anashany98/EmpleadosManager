import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api/client";
import { motion } from "framer-motion";
import {
  Users, Plus, Calendar, Clock, AlertTriangle, TrendingUp, Activity, CheckCircle, FileText, DollarSign
} from "lucide-react";

function MetricCard({ title, value, subtitle, icon, color }: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: "blue" | "emerald" | "amber" | "violet";
}) {
  const colors = {
    blue: "from-blue-500 to-blue-600",
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    violet: "from-violet-500 to-violet-600"
  };
  const displayValue = typeof value === "object" ? 0 : value;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{displayValue}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

function QuickAction({ icon, label, href, bgClass }: {
  icon: React.ReactNode;
  label: string;
  href: string;
  bgClass: string;
}) {
  return (
    <Link
      to={href}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:scale-105 hover:shadow-md transition-all ${bgClass}`}
    >
      <div className="w-10 h-10 flex items-center justify-center">{icon}</div>
      <span className="text-xs font-semibold text-center">{label}</span>
    </Link>
  );
}

function ActivityItem({ action, user, time, type }: {
  action: string;
  user?: string;
  time: string;
  type: "create" | "update" | "delete" | "system";
}) {
  const dotColors = {
    create: "bg-emerald-500",
    update: "bg-blue-500",
    delete: "bg-rose-500",
    system: "bg-slate-400"
  };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${dotColors[type]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white">{action}</p>
        <p className="text-xs text-slate-500 mt-0.5">{user || "Sistema"} - {time}</p>
      </div>
    </div>
  );
}

export default function RRHHDashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [alertsCount, setAlertsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/v2/employees").catch(() => ({ data: null })),
      api.get("/dashboard/audit?limit=5").catch(() => ({ data: [] })),
      api.get("/alerts").catch(() => ({ data: [] }))
    ]).then(([metricsRes, auditRes, alertsRes]) => {
      const data = metricsRes.data;
      setMetrics(data || {});

      const activityData = auditRes.data || [];
      setRecentActivity(Array.isArray(activityData) ? activityData : []);

      const alertsData = alertsRes.data;
      if (Array.isArray(alertsData)) {
        setAlertsCount(alertsData.length);
      } else if (alertsData && typeof alertsData === "object") {
        setAlertsCount(alertsData.count || 0);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const getNumericValue = (obj: any, fallback = 0): number => {
    if (typeof obj === "number") return obj;
    if (typeof obj === "string") return parseInt(obj, 10) || fallback;
    return fallback;
  };

  const stats = [
    {
      title: "Total Empleados",
      value: getNumericValue(metrics?.headcount?.total),
      subtitle: "En la empresa",
      icon: <Users size={24} className="text-white" />,
      color: "blue" as const
    },
    {
      title: "Nuevos Este Mes",
      value: getNumericValue(metrics?.headcount?.newThisMonth),
      subtitle: "Altas recientes",
      icon: <TrendingUp size={24} className="text-white" />,
      color: "emerald" as const
    },
    {
      title: "Ausencias Pendientes",
      value: getNumericValue(metrics?.absences?.pending),
      subtitle: "Requieren aprobación",
      icon: <Clock size={24} className="text-white" />,
      color: "amber" as const
    },
    {
      title: "Vacaciones Activas",
      value: getNumericValue(metrics?.vacations?.active),
      subtitle: "En curso",
      icon: <Calendar size={24} className="text-white" />,
      color: "violet" as const
    }
  ];

  const quickActions = [
    { icon: <Plus size={20} className="text-blue-600" />, label: "Nuevo Empleado", href: "/employees/new", bgClass: "bg-blue-50 dark:bg-blue-900/20" },
    { icon: <Calendar size={20} className="text-emerald-600" />, label: "Vacaciones", href: "/vacations", bgClass: "bg-emerald-50 dark:bg-emerald-900/20" },
    { icon: <FileText size={20} className="text-amber-600" />, label: "Informes", href: "/reports", bgClass: "bg-amber-50 dark:bg-amber-900/20" },
    { icon: <Calendar size={20} className="text-violet-600" />, label: "Calendario", href: "/calendar", bgClass: "bg-violet-50 dark:bg-violet-900/20" }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Panel RRHH
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 capitalize">
              {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <MetricCard key={idx} {...stat} />
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Acciones Rápidas</h3>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action, idx) => (
              <QuickAction key={idx} {...action} />
            ))}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column - Activity */}
          <div className="lg:col-span-2 space-y-6">

            {/* Activity Feed */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Activity size={16} className="text-blue-500" />
                  Actividad Reciente
                </h3>
                <Link to="/audit" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Ver todo</Link>
              </div>
              <div className="p-4">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Sin actividad reciente</p>
                ) : (
                  recentActivity.slice(0, 5).map((item: any, idx: number) => (
                    <ActivityItem
                      key={idx}
                      action={item.action || item.description || "Actividad"}
                      user={item.user?.name || item.userName || item.email || "Sistema"}
                      time={item.createdAt ? new Date(item.createdAt).toLocaleString("es-ES") : "Ahora"}
                      type={item.type || "system"}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Alerts Summary */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  Alertas
                </h3>
                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-bold">
                  {alertsCount}
                </span>
              </div>
              <div className="p-4">
                {alertsCount === 0 ? (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle size={20} className="text-emerald-500" />
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">Todo bajo control</span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {alertsCount} alerta{alertsCount !== 1 ? "s" : ""} pendiente{alertsCount !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">

            {/* Quick Info */}
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full -ml-10 -mb-10" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={20} className="text-white" />
                  <h3 className="text-sm font-bold uppercase tracking-wide">Resumen</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-orange-400 flex items-center justify-center text-lg">
                      <Users size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Total Empleados</p>
                      <p className="text-xs text-white/70">{getNumericValue(metrics?.headcount?.total)} registros</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 to-indigo-400 flex items-center justify-center text-lg">
                      <TrendingUp size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Nuevos Este Mes</p>
                      <p className="text-xs text-white/70">{getNumericValue(metrics?.headcount?.newThisMonth)} altas</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}