// CRIT-003: Reportes programados deben estar aislados por empresa.
// Antes del fix, un usuario de la empresa A podía:
//   1. Listar / activar / ejecutar schedules de la empresa B
//   2. Crear un schedule con companyId forzado a la empresa B
//   3. Enviar reportes a destinatarios arbitrarios (incluido externos)
//
// Este test ataca el servicio directamente (mockeando prisma) porque
// reproduce el bug en su origen. Las pruebas de integración HTTP se
// añaden cuando el stack de CI tenga Postgres + Redis.

import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/prisma', () => {
    const reportSchedule = {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
    };
    return { prisma: { reportSchedule } };
});

vi.mock('../../services/reports', () => ({
    ReportService: {
        getAttendanceData: vi.fn(),
        getAttendanceDailySummary: vi.fn(),
        getOvertimeData: vi.fn(),
        getVacationData: vi.fn(),
        getCompanyCostData: vi.fn(),
        getDetailedAbsenceData: vi.fn(),
        getKPIMetrics: vi.fn(),
        getAbsenteeismByDepartment: vi.fn(),
        getGenderGapData: vi.fn()
    }
}));

vi.mock('../../services/ExcelService', () => ({
    ExcelService: {
        generateAttendanceReport: vi.fn(async () => Buffer.from('xlsx')),
        generateAttendanceSummaryReport: vi.fn(async () => Buffer.from('xlsx')),
        generateOvertimeReport: vi.fn(async () => Buffer.from('xlsx')),
        generateVacationReport: vi.fn(async () => Buffer.from('xlsx')),
        generateCostReport: vi.fn(async () => Buffer.from('xlsx')),
        generateDetailedAbsenceReport: vi.fn(async () => Buffer.from('xlsx')),
        generateKPIReport: vi.fn(async () => Buffer.from('xlsx')),
        generateGenderGapReport: vi.fn(async () => Buffer.from('xlsx'))
    }
}));

vi.mock('../../services/EmailService', () => ({
    EmailService: { sendMail: vi.fn().mockResolvedValue(undefined) }
}));

vi.mock('../../services/StorageService', () => ({
    StorageService: {
        saveBuffer: vi.fn().mockResolvedValue({ key: 'reports/scheduled/test.xlsx' }),
        getBuffer: vi.fn().mockResolvedValue(Buffer.from('xlsx'))
    }
}));

vi.mock('../../services/AuditService', () => ({
    AuditService: { log: vi.fn().mockResolvedValue(undefined) }
}));

vi.mock('../../services/LoggerService', () => ({
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

import { prisma } from '../../lib/prisma';
import { EmailService } from '../../services/EmailService';
import { AuditService } from '../../services/AuditService';
import { reportScheduler } from '../../services/ReportScheduler';

const mockedPrisma = prisma as unknown as {
    reportSchedule: {
        findUnique: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
    };
};

const ACTOR_A = {
    id: 'user-A',
    role: 'admin',
    companyId: 'company-A',
    employeeId: null,
    permissions: {}
};

const ACTOR_B = {
    id: 'user-B',
    role: 'admin',
    companyId: 'company-B',
    employeeId: null,
    permissions: {}
};

const GLOBAL_ADMIN = {
    id: 'user-G',
    role: 'admin',
    companyId: null,
    employeeId: null,
    permissions: {}
};

describe('CRIT-003 — ReportScheduler tenant isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getSchedules', () => {
        it('lista solo los schedules de la empresa del actor', async () => {
            mockedPrisma.reportSchedule.findMany.mockResolvedValue([]);
            await reportScheduler.getSchedules(ACTOR_A);
            expect(mockedPrisma.reportSchedule.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { companyId: 'company-A' } })
            );
        });

        it('permite a un admin global listar todos los schedules', async () => {
            mockedPrisma.reportSchedule.findMany.mockResolvedValue([]);
            await reportScheduler.getSchedules(GLOBAL_ADMIN);
            expect(mockedPrisma.reportSchedule.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: {} })
            );
        });

        it('bloquea a un actor sin empresa (no global admin) para que no vea nada', async () => {
            mockedPrisma.reportSchedule.findMany.mockResolvedValue([]);
            const orphan = { id: 'u-x', role: 'hr', companyId: null, employeeId: null, permissions: {} };
            await reportScheduler.getSchedules(orphan);
            expect(mockedPrisma.reportSchedule.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { companyId: '__none__' } })
            );
        });
    });

    describe('createSchedule', () => {
        it('ignora el companyId del body y fuerza el del actor', async () => {
            mockedPrisma.reportSchedule.create.mockResolvedValue({ id: 'new-id' });
            await reportScheduler.createSchedule(
                {
                    name: 'demo',
                    reportType: 'attendance',
                    params: '{}',
                    frequency: 'DAILY',
                    sendEmail: false,
                    recipients: '[]',
                    companyId: 'company-B' // intento del actor A
                },
                ACTOR_A
            );
            const arg = mockedPrisma.reportSchedule.create.mock.calls[0][0];
            expect(arg.data.companyId).toBe('company-A');
        });

        it('rechaza destinatarios que no sean emails válidos', async () => {
            mockedPrisma.reportSchedule.create.mockResolvedValue({ id: 'new-id' });
            await expect(
                reportScheduler.createSchedule(
                    {
                        name: 'demo',
                        reportType: 'attendance',
                        params: '{}',
                        frequency: 'DAILY',
                        sendEmail: true,
                        recipients: JSON.stringify(['not-an-email', 'ext@external.com'])
                    },
                    ACTOR_A
                )
            ).rejects.toThrow(/destinatarios/i);
            expect(mockedPrisma.reportSchedule.create).not.toHaveBeenCalled();
        });
    });

    describe('toggleSchedule / generateReport', () => {
        it('impide activar un schedule de otra empresa', async () => {
            mockedPrisma.reportSchedule.findUnique.mockResolvedValue({
                id: 'sched-B',
                reportType: 'attendance',
                params: '{}',
                isActive: true,
                frequency: 'DAILY',
                companyId: 'company-B',
                recipients: '[]',
                sendEmail: false
            });
            const result = await reportScheduler.toggleSchedule('sched-B', false, ACTOR_A);
            expect(result).toMatchObject({ success: false, error: expect.stringMatching(/not found|forbidden/i) });
            expect(mockedPrisma.reportSchedule.update).not.toHaveBeenCalled();
        });

        it('permite a un admin global alternar cualquier schedule', async () => {
            mockedPrisma.reportSchedule.findUnique.mockResolvedValue({
                id: 'sched-B',
                reportType: 'attendance',
                params: '{}',
                isActive: true,
                frequency: 'DAILY',
                companyId: 'company-B',
                recipients: '[]',
                sendEmail: false
            });
            mockedPrisma.reportSchedule.update.mockResolvedValue({ id: 'sched-B', isActive: false });
            const result = await reportScheduler.toggleSchedule('sched-B', false, GLOBAL_ADMIN);
            expect(result).toMatchObject({ success: true });
        });

        it('impide generar un schedule de otra empresa', async () => {
            mockedPrisma.reportSchedule.findUnique.mockResolvedValue({
                id: 'sched-B',
                reportType: 'attendance',
                params: '{}',
                isActive: true,
                frequency: 'DAILY',
                companyId: 'company-B',
                recipients: '[]',
                sendEmail: false
            });
            const result = await reportScheduler.generateReport('sched-B', ACTOR_A);
            expect(result.success).toBe(false);
            expect(EmailService.sendMail).not.toHaveBeenCalled();
        });
    });

    describe('runPendingSchedules', () => {
        it('solo procesa schedules de la empresa que se le pide', async () => {
            mockedPrisma.reportSchedule.findMany.mockResolvedValue([]);
            await reportScheduler.runPendingSchedules(ACTOR_A.companyId!);
            expect(mockedPrisma.reportSchedule.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-A' }) })
            );
        });
    });

    describe('auditoría', () => {
        it('registra cada ejecución autorizada en AuditService', async () => {
            mockedPrisma.reportSchedule.findUnique.mockResolvedValue({
                id: 'sched-A',
                reportType: 'attendance',
                params: '{}',
                isActive: true,
                frequency: 'DAILY',
                companyId: 'company-A',
                recipients: '[]',
                sendEmail: false
            });
            mockedPrisma.reportSchedule.update.mockResolvedValue({});
            const { ReportService } = await import('../../services/reports');
            (ReportService.getAttendanceData as any).mockResolvedValue({ data: [] });

            await reportScheduler.generateReport('sched-A', ACTOR_A);

            expect(AuditService.log).toHaveBeenCalled();
        });
    });

    /**
     * MED-005: test parametrizado por `reportType`. Antes del
     * fix había dos `case 'attendanceSummary'` en el switch; el
     * segundo era inaccesible y el primero generaba el reporte
     * detallado equivocado. Este test verifica que cada tipo
     * conocido llama exactamente al método de `ReportService`
     * correcto (sin solaparse con otro) y al método de
     * `ExcelService` correspondiente. Si alguien añade un tipo
     * nuevo sin cablearlo correctamente, este test lo detecta.
     */
    describe('MED-005 — cada reportType llama al generador correcto', () => {
        // Mapeo oficial entre reportType (lo que se guarda en BD) y
        // los métodos de ReportService + ExcelService que DEBEN
        // invocarse. Si añades un tipo, añade su entrada aquí.
        const REPORT_TYPE_MATRIX: Array<{
            reportType: string;
            reportServiceMethod: keyof typeof REPORT_SERVICE_METHODS;
            excelServiceMethod: keyof typeof EXCEL_SERVICE_METHODS;
            params: Record<string, unknown>;
        }> = [
            {
                reportType: 'attendance',
                reportServiceMethod: 'getAttendanceData',
                excelServiceMethod: 'generateAttendanceReport',
                params: { startDate: '2024-01-01', endDate: '2024-01-31' }
            },
            {
                reportType: 'attendance-summary',
                reportServiceMethod: 'getAttendanceDailySummary',
                excelServiceMethod: 'generateAttendanceSummaryReport',
                params: { startDate: '2024-01-01', endDate: '2024-01-31' }
            },
            {
                reportType: 'overtime',
                reportServiceMethod: 'getOvertimeData',
                excelServiceMethod: 'generateOvertimeReport',
                params: { startDate: '2024-01-01', endDate: '2024-01-31' }
            },
            {
                reportType: 'vacation',
                reportServiceMethod: 'getVacationData',
                excelServiceMethod: 'generateVacationReport',
                params: { year: 2024 }
            },
            {
                reportType: 'vacations',
                reportServiceMethod: 'getVacationData',
                excelServiceMethod: 'generateVacationReport',
                params: { year: 2024 }
            },
            {
                reportType: 'costs',
                reportServiceMethod: 'getCompanyCostData',
                excelServiceMethod: 'generateCostReport',
                params: { year: 2024, month: 6 }
            },
            {
                reportType: 'absences',
                reportServiceMethod: 'getDetailedAbsenceData',
                excelServiceMethod: 'generateDetailedAbsenceReport',
                params: { startDate: '2024-01-01', endDate: '2024-01-31' }
            },
            {
                reportType: 'absences-detailed',
                reportServiceMethod: 'getDetailedAbsenceData',
                excelServiceMethod: 'generateDetailedAbsenceReport',
                params: { startDate: '2024-01-01', endDate: '2024-01-31' }
            },
            {
                reportType: 'kpis',
                reportServiceMethod: 'getKPIMetrics',
                excelServiceMethod: 'generateKPIReport',
                params: { year: 2024, month: 6 }
            },
            {
                reportType: 'gender-gap',
                reportServiceMethod: 'getGenderGapData',
                excelServiceMethod: 'generateGenderGapReport',
                params: {}
            },
            {
                reportType: 'genderGap',
                reportServiceMethod: 'getGenderGapData',
                excelServiceMethod: 'generateGenderGapReport',
                params: {}
            }
        ];

        // Sentinel para que TypeScript no se queje de los strings
        // de método. Mantenemos el shape real abajo.
        const REPORT_SERVICE_METHODS = {
            getAttendanceData: 'getAttendanceData',
            getAttendanceDailySummary: 'getAttendanceDailySummary',
            getOvertimeData: 'getOvertimeData',
            getVacationData: 'getVacationData',
            getCompanyCostData: 'getCompanyCostData',
            getDetailedAbsenceData: 'getDetailedAbsenceData',
            getKPIMetrics: 'getKPIMetrics',
            getGenderGapData: 'getGenderGapData'
        } as const;
        const EXCEL_SERVICE_METHODS = {
            generateAttendanceReport: 'generateAttendanceReport',
            generateAttendanceSummaryReport: 'generateAttendanceSummaryReport',
            generateOvertimeReport: 'generateOvertimeReport',
            generateVacationReport: 'generateVacationReport',
            generateCostReport: 'generateCostReport',
            generateDetailedAbsenceReport: 'generateDetailedAbsenceReport',
            generateKPIReport: 'generateKPIReport',
            generateGenderGapReport: 'generateGenderGapReport'
        } as const;

        it.each(REPORT_TYPE_MATRIX)(
            '%s → llama a ReportService.$reportServiceMethod y ExcelService.$excelServiceMethod',
            async ({ reportType, reportServiceMethod, excelServiceMethod, params }) => {
                const { ReportService } = await import('../../services/reports');
                const { ExcelService } = await import('../../services/ExcelService');

                // Reset de los mocks del servicio: queremos contar
                // exactamente qué métodos se llaman para ESTE tipo.
                vi.mocked(ReportService.getAttendanceData).mockClear();
                vi.mocked(ReportService.getAttendanceDailySummary).mockClear();
                vi.mocked(ReportService.getOvertimeData).mockClear();
                vi.mocked(ReportService.getVacationData).mockClear();
                vi.mocked(ReportService.getCompanyCostData).mockClear();
                vi.mocked(ReportService.getDetailedAbsenceData).mockClear();
                vi.mocked(ReportService.getKPIMetrics).mockClear();
                vi.mocked(ReportService.getGenderGapData).mockClear();
                vi.mocked(ExcelService.generateAttendanceReport).mockClear();
                vi.mocked(ExcelService.generateAttendanceSummaryReport).mockClear();
                vi.mocked(ExcelService.generateOvertimeReport).mockClear();
                vi.mocked(ExcelService.generateVacationReport).mockClear();
                vi.mocked(ExcelService.generateCostReport).mockClear();
                vi.mocked(ExcelService.generateDetailedAbsenceReport).mockClear();
                vi.mocked(ExcelService.generateKPIReport).mockClear();
                vi.mocked(ExcelService.generateGenderGapReport).mockClear();

                // Mock de retorno del método esperado
                const expectedReportData = { data: [] } as any;
                (ReportService as any)[reportServiceMethod].mockResolvedValue(expectedReportData);
                (ExcelService as any)[excelServiceMethod].mockResolvedValue(Buffer.from('xlsx'));

                // Schedule del tipo a probar
                mockedPrisma.reportSchedule.findUnique.mockResolvedValue({
                    id: `sched-${reportType}`,
                    reportType,
                    params: JSON.stringify(params),
                    isActive: true,
                    frequency: 'DAILY',
                    companyId: 'company-A',
                    recipients: '[]',
                    sendEmail: false
                } as any);
                mockedPrisma.reportSchedule.update.mockResolvedValue({});

                const result = await reportScheduler.generateReport(`sched-${reportType}`, ACTOR_A);

                // El report se generó correctamente
                expect(result.success).toBe(true);

                // Se llamó AL método de ReportService esperado
                expect(ReportService[reportServiceMethod]).toHaveBeenCalled();
                // Y NO se llamó a los otros (verificación cruzada:
                // cada tipo usa exactamente su generador, no se
                // solapa con otros).
                for (const other of Object.values(REPORT_SERVICE_METHODS)) {
                    if (other === reportServiceMethod) continue;
                    expect((ReportService as any)[other]).not.toHaveBeenCalled();
                }

                // Se llamó AL método de ExcelService esperado
                expect(ExcelService[excelServiceMethod]).toHaveBeenCalled();
                for (const other of Object.values(EXCEL_SERVICE_METHODS)) {
                    if (other === excelServiceMethod) continue;
                    expect((ExcelService as any)[other]).not.toHaveBeenCalled();
                }
            }
        );

        it('attendanceSummary: usa el método "summary", no el "detailed" (regression MED-005)', async () => {
            // Caso explícito: si alguien añade un case duplicado
            // 'attendanceSummary' en el switch del scheduler, este
            // test detecta que se ha llamado al servicio equivocado.
            const { ReportService } = await import('../../services/reports');
            const { ExcelService } = await import('../../services/ExcelService');

            vi.mocked(ReportService.getAttendanceData).mockClear();
            vi.mocked(ReportService.getAttendanceDailySummary).mockClear();
            vi.mocked(ExcelService.generateAttendanceReport).mockClear();
            vi.mocked(ExcelService.generateAttendanceSummaryReport).mockClear();
            (ReportService.getAttendanceDailySummary as any).mockResolvedValue({});
            (ExcelService.generateAttendanceSummaryReport as any).mockResolvedValue(Buffer.from('xlsx'));

            mockedPrisma.reportSchedule.findUnique.mockResolvedValue({
                id: 'sched-summary',
                reportType: 'attendanceSummary',
                params: '{}',
                isActive: true,
                frequency: 'DAILY',
                companyId: 'company-A',
                recipients: '[]',
                sendEmail: false
            } as any);
            mockedPrisma.reportSchedule.update.mockResolvedValue({});

            await reportScheduler.generateReport('sched-summary', ACTOR_A);

            // summary llama a summary, NO a detailed
            expect(ReportService.getAttendanceDailySummary).toHaveBeenCalled();
            expect(ReportService.getAttendanceData).not.toHaveBeenCalled();
            expect(ExcelService.generateAttendanceSummaryReport).toHaveBeenCalled();
            expect(ExcelService.generateAttendanceReport).not.toHaveBeenCalled();
        });

        it('reportType desconocido devuelve error sin tocar ReportService', async () => {
            const { ReportService } = await import('../../services/reports');
            const { ExcelService } = await import('../../services/ExcelService');

            // Reset todos los spies para detectar cualquier llamada
            for (const m of Object.values(REPORT_SERVICE_METHODS)) {
                vi.mocked((ReportService as any)[m]).mockClear();
            }
            for (const m of Object.values(EXCEL_SERVICE_METHODS)) {
                vi.mocked((ExcelService as any)[m]).mockClear();
            }

            mockedPrisma.reportSchedule.findUnique.mockResolvedValue({
                id: 'sched-unknown',
                reportType: 'no-existe-este-tipo',
                params: '{}',
                isActive: true,
                frequency: 'DAILY',
                companyId: 'company-A',
                recipients: '[]',
                sendEmail: false
            } as any);

            const result = await reportScheduler.generateReport('sched-unknown', ACTOR_A);

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Unknown report type/i);
            // Ningún método de ReportService ni ExcelService fue llamado
            for (const m of Object.values(REPORT_SERVICE_METHODS)) {
                expect((ReportService as any)[m]).not.toHaveBeenCalled();
            }
            for (const m of Object.values(EXCEL_SERVICE_METHODS)) {
                expect((ExcelService as any)[m]).not.toHaveBeenCalled();
            }
        });
    });
});
