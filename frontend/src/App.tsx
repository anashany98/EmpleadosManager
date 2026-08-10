import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
// HIGH-004: el módulo Kiosco está desactivado (decisión funcional
// 2026-07-20). Eliminamos el import y la ruta para que la UI no
// la exponga y el bundle no incluya `VITE_KIOSK_DEVICE_SECRET`.
// El archivo KioskPage.tsx se conserva en disco como referencia
// histórica para una futura reactivación.
import RequestReset from './pages/RequestReset';
import ResetPassword from './pages/ResetPassword';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import CommandPalette from './components/CommandPalette';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { Breadcrumbs } from './components/ui/Breadcrumbs';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const RRHHDashboard = lazy(() => import('./pages/RRHHDashboard'));
const FinancialDashboard = lazy(() => import('./pages/FinancialDashboard'));
const EmployeeDetail = lazy(() => import('./pages/EmployeeDetail'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const Companies = lazy(() => import('./pages/Companies'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const MyDocumentsPage = lazy(() => import('./pages/MyDocumentsPage'));
const TimesheetPage = lazy(() => import('./pages/TimesheetPage'));
const OrgChart = lazy(() => import('./pages/OrgChart'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
const GlobalAssetsPage = lazy(() => import('./pages/GlobalAssetsPage'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const InboxPage = lazy(() => import('./pages/InboxPage'));
const PayrollBatchDetail = lazy(() => import('./pages/PayrollBatchDetail'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const AnomaliesPage = lazy(() => import('./pages/Anomalies'));
const AttendanceReconciliation = lazy(() => import('./pages/AttendanceReconciliation'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const PerformancePage = lazy(() => import('./pages/PerformancePage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const Employees = lazy(() => import('./pages/Employees'));
const Reports = lazy(() => import('./pages/Reports'));
const PayrollImport = lazy(() => import('./pages/PayrollImport'));
const VacationRequests = lazy(() => import('./pages/VacationRequests'));
const AbsenceTypesPage = lazy(() => import('./pages/AbsenceTypesPage'));
const ObrasPage = lazy(() => import('./pages/ObrasPage'));
const ObraDetailPage = lazy(() => import('./pages/ObraDetailPage'));
const ObraImportPage = lazy(() => import('./pages/ObraImportPage'));
const ContractorsPage = lazy(() => import('./pages/ContractorsPage'));
const PayrollControlPage = lazy(() => import('./pages/PayrollControlPage'));
const HrTaskCenterPage = lazy(() => import('./pages/HrTaskCenterPage'));
const HrMonthlyClosePage = lazy(() => import('./pages/HrMonthlyClosePage'));
const HrAlertSettingsPage = lazy(() => import('./pages/HrAlertSettingsPage'));

function RouteLoading() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  // H5: Use matchMedia instead of resize listener (fires only on breakpoint change, not every px)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => setSidebarOpen(e.matches);
    mql.addEventListener('change', handleChange);
    // Sync initial state
    setSidebarOpen(mql.matches);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // If loading user info (checking token), don't show anything yet
  // ProtectedRoute handles this for individual routes, but we need to hide the layout
  if (loading) {
    return null;
  }

  // If no user, only show login route (or redirect)
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/request-reset" element={<RequestReset />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <div className={`flex h-screen transition-colors duration-300 ${darkMode ? 'dark bg-slate-950' : 'bg-slate-50'}`}>

      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        darkMode={darkMode}
      />

      {/* Main Content */}
      <main id="main-content" className="flex-1 overflow-hidden flex flex-col relative">

        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />

        <div className="px-3 sm:px-4 md:px-6">
          <Breadcrumbs />
        </div>

        <OfflineBanner />

<div className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 lg:p-8 scroll-smooth safe-bottom">
                <div className={`${location.pathname === '/calendar' ? 'max-w-[1600px]' : 'max-w-7xl'} mx-auto w-full`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Suspense fallback={<RouteLoading />}>
                <Routes location={location} key={location.pathname}>
                  <Route path="/" element={<ProtectedRoute feature="dashboard"><Dashboard /></ProtectedRoute>} />
                  <Route path="/employees" element={<ProtectedRoute feature="employees"><Employees /></ProtectedRoute>} />
                  <Route path="/employees/:id" element={<ProtectedRoute feature="employeeDetail"><EmployeeDetail /></ProtectedRoute>} />
                  <Route path="/employees/org-chart" element={<ProtectedRoute feature="orgChart"><OrgChart /></ProtectedRoute>} />
                  <Route path="/employees/rrhh-dashboard" element={<ProtectedRoute feature="employees"><RRHHDashboard /></ProtectedRoute>} />
                  <Route path="/hr/tasks" element={<ProtectedRoute feature="employees"><HrTaskCenterPage /></ProtectedRoute>} />
                  <Route path="/hr/monthly-close" element={<ProtectedRoute feature="employees"><HrMonthlyClosePage /></ProtectedRoute>} />
                  <Route path="/hr/alerts" element={<ProtectedRoute feature="employees"><HrAlertSettingsPage /></ProtectedRoute>} />
                  <Route path="/companies" element={<ProtectedRoute feature="companies"><Companies /></ProtectedRoute>} />
                  <Route path="/calendar" element={<ProtectedRoute feature="calendar"><CalendarPage /></ProtectedRoute>} />
                  <Route path="/audit" element={<ProtectedRoute feature="audit"><AuditLogPage /></ProtectedRoute>} />
                  <Route path="/assets" element={<ProtectedRoute anyFeature={['assets', 'fleet', 'cards']}><GlobalAssetsPage /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute feature="reports"><Reports /></ProtectedRoute>} />
                  <Route path="/timesheet" element={<ProtectedRoute feature="timesheetManagement"><TimesheetPage /></ProtectedRoute>} />
                  <Route path="/inbox" element={<ProtectedRoute feature="inbox"><InboxPage /></ProtectedRoute>} />
                  <Route path="/import" element={<ProtectedRoute feature="payrollImport"><PayrollImport /></ProtectedRoute>} />
                  <Route path="/payroll" element={<Navigate to="/payroll/control" replace />} />
                  <Route path="/payroll/control" element={<ProtectedRoute feature="payrollControl"><PayrollControlPage /></ProtectedRoute>} />
                  <Route path="/payroll/batch/:id" element={<ProtectedRoute feature="payrollBatch"><PayrollBatchDetail /></ProtectedRoute>} />
                  <Route path="/my-documents" element={
                    <ProtectedRoute feature="myDocuments">
                      <MyDocumentsPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/vacations" element={<ProtectedRoute feature="vacationsPortal"><VacationRequests /></ProtectedRoute>} />
                  <Route path="/absence-types" element={<ProtectedRoute feature="settings"><AbsenceTypesPage /></ProtectedRoute>} />
                  <Route path="/expenses" element={<ProtectedRoute feature="expensesPortal"><ExpensesPage /></ProtectedRoute>} />
                  <Route path="/anomalies" element={<ProtectedRoute feature="anomalies"><AnomaliesPage /></ProtectedRoute>} />
                  <Route path="/reconciliation" element={<ProtectedRoute feature="reconciliation"><AttendanceReconciliation /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute feature="profileSelf"><MyProfile /></ProtectedRoute>} />
                  <Route path="/users" element={<ProtectedRoute feature="users"><UserManagement /></ProtectedRoute>} />
                  <Route path="/templates" element={<ProtectedRoute feature="settings"><TemplatesPage /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute feature="settings"><SettingsPage /></ProtectedRoute>} />
                  <Route path="/admin/financial-dashboard" element={<ProtectedRoute feature="settings"><FinancialDashboard /></ProtectedRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute feature="analytics"><AnalyticsDashboard /></ProtectedRoute>} />
                  <Route path="/performance" element={<ProtectedRoute feature="performance"><PerformancePage /></ProtectedRoute>} />
                  <Route path="/obras" element={<ProtectedRoute feature="projects"><ObrasPage /></ProtectedRoute>} />
                  <Route path="/obras/imports" element={<ProtectedRoute feature="projects"><ObraImportPage /></ProtectedRoute>} />
                  <Route path="/obras/contractors" element={<ProtectedRoute feature="projects"><ContractorsPage /></ProtectedRoute>} />
                  <Route path="/obras/:id" element={<ProtectedRoute feature="projects"><ObraDetailPage /></ProtectedRoute>} />
                  <Route path="/login" element={<Navigate to="/" replace />} />
                </Routes>
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
      <CommandPalette />
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}

import { ConfirmProvider } from './context/ConfirmContext';
import { NotificationProvider } from './contexts/NotificationContext';

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <ConfirmProvider>
                    <NotificationProvider>
                        {/* Skip-navigation link for keyboard users.
                            Hidden until focused (per WCAG 2.4.1). */}
                        <a href="#main-content" className="skip-link">
                            Saltar al contenido principal
                        </a>
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </NotificationProvider>
        </ConfirmProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
