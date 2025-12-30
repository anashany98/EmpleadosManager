import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import PayrollImport from './pages/PayrollImport';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import CalendarPage from './pages/CalendarPage';
import Companies from './pages/Companies';
import SettingsPage from './pages/Settings';
import TimesheetPage from './pages/TimesheetPage';
import Reports from './pages/Reports';
import OrgChart from './pages/OrgChart';
import AuditLogPage from './pages/AuditLogPage';
import GlobalAssetsPage from './pages/GlobalAssetsPage';
import UserManagement from './pages/UserManagement';
import InboxPage from './pages/InboxPage';
import PayrollBatchDetail from './pages/PayrollBatchDetail';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import CommandPalette from './components/CommandPalette';

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

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
      <main className="flex-1 overflow-hidden flex flex-col relative">

        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />

        <div className="flex-1 overflow-auto p-4 md:p-8 scroll-smooth">
          <div className={`${location.pathname === '/calendar' ? 'max-w-[1600px]' : 'max-w-7xl'} mx-auto`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Routes location={location} key={location.pathname}>
                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
                  <Route path="/employees/:id" element={<ProtectedRoute><EmployeeDetail /></ProtectedRoute>} />
                  <Route path="/employees/org-chart" element={<ProtectedRoute><OrgChart /></ProtectedRoute>} />
                  <Route path="/companies" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
                  <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                  <Route path="/audit" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
                  <Route path="/assets" element={<ProtectedRoute><GlobalAssetsPage /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                  <Route path="/timesheet" element={<ProtectedRoute><TimesheetPage /></ProtectedRoute>} />
                  <Route path="/inbox" element={<ProtectedRoute roles={['admin']}><InboxPage /></ProtectedRoute>} />
                  <Route path="/import" element={<ProtectedRoute><PayrollImport /></ProtectedRoute>} />
                  <Route path="/payroll/batch/:id" element={<ProtectedRoute><PayrollBatchDetail /></ProtectedRoute>} />
                  <Route path="/users" element={<ProtectedRoute roles={['admin']}><UserManagement /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>} />
                  <Route path="/login" element={<Navigate to="/" replace />} />
                </Routes>
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
            <AppContent />
          </NotificationProvider>
        </ConfirmProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
