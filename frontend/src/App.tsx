import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
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
import EmployeeDashboard from './pages/EmployeeDashboard';
import Reports from './pages/Reports';
import OrgChart from './pages/OrgChart';
import AuditLogPage from './pages/AuditLogPage';
import GlobalAssetsPage from './pages/GlobalAssetsPage';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
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

  return (
    <QueryClientProvider client={queryClient}>
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
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/employees/:id" element={<EmployeeDetail />} />
                    <Route path="/employees/org-chart" element={<OrgChart />} />
                    <Route path="/companies" element={<Companies />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/audit" element={<AuditLogPage />} />
                    <Route path="/assets" element={<GlobalAssetsPage />} />
                    <Route path="/dashboard/employees" element={<EmployeeDashboard />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/timesheet" element={<TimesheetPage />} />
                    <Route path="/import" element={<PayrollImport />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Routes>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>
        <Toaster position="top-right" richColors closeButton />
      </div>
    </QueryClientProvider>
  );
}

export default App;
