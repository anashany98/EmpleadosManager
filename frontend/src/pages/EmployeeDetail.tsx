import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { LockBanner } from '../components/lock/LockBanner';
import OffboardingWizard from '../components/OffboardingWizard';
import OnboardingWizard from '../components/OnboardingWizard';
import { useAuth } from '../contexts/AuthContext';
import { EDIT_TABS, getViewTabs } from '../features/employee-detail/constants';
import { EmployeeDetailHeader } from '../features/employee-detail/components/EmployeeDetailHeader';
import { EmployeeDetailTabs } from '../features/employee-detail/components/EmployeeDetailTabs';
import { EmployeeEditTabContent } from '../features/employee-detail/components/EmployeeEditTabContent';
import { EmployeeViewTabContent } from '../features/employee-detail/components/EmployeeViewTabContent';
import { useEmployeeDetail } from '../features/employee-detail/hooks/useEmployeeDetail';
import { useLockPolling } from '../hooks/useLockPolling';
import { getEmployeeDisplayName } from '../utils/employeeDisplay';

export default function EmployeeDetail(props: { employeeId?: string }) {
    const { id: paramId } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const employeeId = props.employeeId || paramId || '';
    const isNew = employeeId === 'new';
    const isAdmin = user?.role === 'admin';
    const isGlobalAdmin = isAdmin && !user?.companyId;
    const canEdit = isAdmin;

    const detail = useEmployeeDetail({
        employeeId,
        isAdmin,
        isNew,
        navigate
    });

    const { isOwner, isLocked, currentHolder, acquireLock, releaseLock } = useLockPolling(employeeId, user?.id);

    useEffect(() => {
        if (employeeId && !isNew && !detail.isEditing) {
            acquireLock();
        }
    }, [employeeId, isNew, detail.isEditing, acquireLock, releaseLock]);

    useEffect(() => {
        return () => {
            if (employeeId && !isNew) {
                releaseLock();
            }
        };
    }, [employeeId, isNew, releaseLock]);

    if (detail.loading) {
        return <div className="p-10 text-center animate-pulse text-slate-500">Cargando perfil...</div>;
    }

  if (!detail.isEditing && detail.employeeView) {
    return (
      <div className="space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
        <Link to="/employees" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-500 transition-colors touch-active">
          <ArrowLeft size={16} /> <span className="text-sm">Volver a Empleados</span>
        </Link>

                <LockBanner employeeId={employeeId} userId={user?.id} />

                <EmployeeDetailHeader
                    employee={detail.employeeView}
                    canEdit={canEdit}
                    canManageLifecycle={isGlobalAdmin}
                    generatingAccess={detail.generatingAccess}
                    onGenerateAccess={detail.handleGenerateAccess}
                    onOpenOnboarding={() => detail.setShowOnboardingWizard(true)}
                    onOpenOffboarding={() => detail.setShowOffboardingWizard(true)}
                    onEdit={detail.enterEditMode}
                />

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <EmployeeDetailTabs
                        tabs={getViewTabs(isAdmin, isGlobalAdmin)}
                        activeTab={detail.activeTab}
                        onChange={detail.setActiveTab}
                    />

        <div className="p-4 sm:p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={detail.activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
                <EmployeeViewTabContent
                                    activeTab={detail.activeTab}
                                    employeeId={employeeId}
                                    employeeView={detail.employeeView}
                                    onVacationBalanceChange={(vacationBalance) => detail.setEmployeeView((current) => current ? {
                                        ...current,
                                        vacationDaysTotal: vacationBalance.totalEntitledDays,
                                        vacationBalance
                                    } : current)}
                                    privateNotes={detail.formData.privateNotes}
                                    saving={detail.saving}
                                    onPrivateNotesChange={(value) => detail.setFormData((current) => ({ ...current, privateNotes: value }))}
                                    onPrivateNotesSave={detail.handlePrivateNotesSave}
                                    onDocumentGenerated={() => detail.setActiveTab('expediente')}
                                />
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {detail.showOnboardingWizard && (
                    <OnboardingWizard
                        employeeId={employeeId}
                        employeeName={getEmployeeDisplayName(detail.employeeView)}
                        onClose={() => detail.setShowOnboardingWizard(false)}
                        onSuccess={() => {
                            detail.setShowOnboardingWizard(false);
                            detail.setActiveTab('expediente');
                        }}
                    />
                )}

                {detail.showOffboardingWizard && (
                    <OffboardingWizard
                        employeeId={employeeId}
                        employeeName={getEmployeeDisplayName(detail.employeeView)}
                        onClose={() => detail.setShowOffboardingWizard(false)}
                        onSuccess={() => {
                            detail.setShowOffboardingWizard(false);
                            navigate('/employees');
                        }}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <Link to="/employees" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-500 transition-colors self-start">
                    <ArrowLeft size={16} /> <span className="md:inline">Volver</span>
                </Link>
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <button type="button" onClick={() => { if (isNew) { navigate('/employees'); } else { detail.exitEditMode(); releaseLock(); } }} className="px-4 py-3 md:py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg w-full md:w-auto text-center">
                        Cancelar
                    </button>
                    <button disabled={detail.saving} onClick={async () => { await detail.handleSubmit(); releaseLock(); }} className="px-6 py-3 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-50 w-full md:w-auto transition-all active:scale-95">
                        {detail.saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {isNew ? 'Crear Empleado' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <EmployeeDetailTabs tabs={EDIT_TABS} activeTab={detail.activeTab} onChange={detail.setActiveTab} />

    <div className="p-4 sm:p-6 md:p-8 min-h-[400px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={detail.activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          <form className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
                                <EmployeeEditTabContent
                                    activeTab={detail.activeTab}
                                    isNew={isNew}
                                    employeeId={employeeId}
                                    formData={detail.formData}
                                    companies={detail.companies}
                                    allEmployees={detail.allEmployees}
                                    fieldOptions={detail.fieldOptions}
                                    newContact={detail.newContact}
                                    onChange={detail.handleChange}
                                    setFormData={detail.setFormData}
                                    setNewContact={detail.setNewContact}
                                />
                            </form>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3" />
            </div>
        </div>
    );
}
