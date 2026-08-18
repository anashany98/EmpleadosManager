// HIGH-009: Cálculos de nómina convierten Decimal a float y usan
// tasas hardcodeadas.
//
// Síntomas confirmados antes del fix:
//   - `PayrollAutomationService.processPayrollGenerationJob` hacía
//     `Number(employee.monthlyGrossSalary)` y luego
//     `new Prisma.Decimal(monthlySalary * salaryFactor)`,
//     recibiendo un resultado binario (float64) ya redondeado.
//   - Las horas trabajadas se acumulaban como `number`, lo que
//     arrastraba la imprecisión binary64 en la división
//     proportion = totalHoursWorked / expectedHours.
//   - Las tasas (SS, IRPF) eran constantes `0.0635` / `0.15` /
//     `0.236` hardcodeadas en el código, sin versión ni fecha de
//     efectividad: imposible reproducir la regla histórica sin
//     recompilar el binario.
//
// El fix:
//   1. `PayrollRulesService` mantiene un array inmutable de
//      `PayrollRuleSet` con `version` (ISO date) y `effectiveFrom`.
//      `getRulesForDate(date)` devuelve la regla activa para una
//      fecha dada. Las tasas se almacenan como `string` para
//      preservar la precisión exacta (no `0.0635` float sino
//      "0.0635" string → Prisma.Decimal).
//   2. Todos los cálculos monetarios se hacen con `Prisma.Decimal`
//      end-to-end. `totalHoursWorked` también es Decimal.
//   3. El redondeo al céntimo se aplica UNA VEZ por línea antes
//      de combinarlas (práctica contable estándar: cada magnitud se
//      redondea al céntimo y la suma/resta se hace sobre los
//      valores ya redondeados; el neto coincide con
//      bruto - ssTrabajador - irpf sin drift).
//   4. Cada `PayrollRow` registra `ruleSetVersion` para
//      reproducibilidad histórica.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

// Spies persistentes entre tests (vi.mock se eleva al top del
// archivo, así que los spies se inicializan perezosamente vía
// globalThis en la primera invocación del factory).
function getMockState() {
    if (!(globalThis as any).__high009MockState) {
        (globalThis as any).__high009MockState = {
            payrollImportBatchCreate: vi.fn(async (args: any) => ({ id: 'batch-1', ...args.data })),
            payrollImportBatchUpdate: vi.fn(async () => undefined),
            employeeFindMany: vi.fn(),
            timeEntryFindMany: vi.fn(),
            payrollRowCreateMany: vi.fn(async () => ({ count: 1 })),
            auditLogCreate: vi.fn(async () => undefined),
            payrollControlPeriodFindUnique: vi.fn(async () => null)
        };
    }
    return (globalThis as any).__high009MockState;
}

vi.mock('../../lib/prisma', () => {
    const ms = getMockState();
    return {
        prisma: {
            payrollImportBatch: {
                create: ms.payrollImportBatchCreate,
                update: ms.payrollImportBatchUpdate
            },
            employee: {
                findMany: ms.employeeFindMany
            },
            timeEntry: {
                findMany: ms.timeEntryFindMany
            },
            payrollRow: {
                createMany: ms.payrollRowCreateMany
            },
            auditLog: {
                create: ms.auditLogCreate
            },
            payrollControlPeriod: {
                findUnique: ms.payrollControlPeriodFindUnique
            },
            $transaction: vi.fn(async (arg: any) => {
                if (typeof arg === 'function') {
                    return arg({
                        payrollImportBatch: { create: ms.payrollImportBatchCreate, update: ms.payrollImportBatchUpdate },
                        employee: { findMany: ms.employeeFindMany },
                        timeEntry: { findMany: ms.timeEntryFindMany },
                        payrollRow: { createMany: ms.payrollRowCreateMany },
                        auditLog: { create: ms.auditLogCreate }
                    });
                }
                return Promise.all(arg);
            })
        }
    };
});

vi.mock('../../services/AuditService', () => ({
    AuditService: { log: vi.fn() }
}));

const mockAddJob = vi.fn().mockResolvedValue({ id: 'job-1' });
vi.mock('../../services/QueueService', () => ({
    queueService: { addJob: (...args: unknown[]) => mockAddJob(...args) },
    QUEUES: { PAYROLL_GENERATION: 'payroll-generation-queue' }
}));

import { PayrollRulesService, getRulesForDate, ruleSetToDecimals, roundToCents } from '../../services/PayrollRulesService';
import { PayrollAutomationService } from '../../services/PayrollAutomationService';

const mockState = getMockState();

describe('HIGH-009 — PayrollRulesService reglas versionadas', () => {
    it('getRulesForDate: usa la regla con effectiveFrom <= date', () => {
        const r2020 = getRulesForDate(new Date('2021-06-15'));
        expect(r2020.version).toBe('2020-01-01');
        expect(r2020.ssWorkerRate).toBe('0.0635');

        const r2024 = getRulesForDate(new Date('2024-06-15'));
        expect(r2024.version).toBe('2024-01-01');
        expect(r2024.ssWorkerRate).toBe('0.0645');

        // Para fechas anteriores a 2020, devuelve la primera (por defecto)
        const rDefault = getRulesForDate(new Date('2019-01-01'));
        expect(rDefault.version).toBe('2020-01-01');
    });

    it('getRulesForDate: NO falla por zona horaria (effectiveFrom en UTC midnight)', () => {
        // El bug era: `new Date(2024, 0, 1).getTime()` en Madrid =
        // 2023-12-31T23:00:00.000Z, antes que 2024-01-01T00:00:00.000Z,
        // por lo que la regla 2024 se descartaba. Ahora comparamos por
        // string de fecha local → 2024-01-01 <= 2024-01-01 → regla 2024.
        const r = getRulesForDate(new Date(2024, 0, 1));
        expect(r.version).toBe('2024-01-01');
        expect(r.ssWorkerRate).toBe('0.0645');
    });

    it('getAllRuleSets: devuelve todas las reglas ordenadas por fecha', () => {
        const all = PayrollRulesService.getAllRuleSets();
        expect(all.length).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < all.length; i++) {
            expect(all[i].effectiveFrom >= all[i - 1].effectiveFrom).toBe(true);
        }
    });

    it('ruleSetToDecimals: convierte las tasas string a Prisma.Decimal exactos', () => {
        const r = getRulesForDate(new Date('2020-06-15'));
        const d = ruleSetToDecimals(r);
        expect(d.ssWorkerRate).toBeInstanceOf(Prisma.Decimal);
        expect(d.ssWorkerRate.toString()).toBe('0.0635');
        expect(d.ssWorkerRate.toFixed()).toBe('0.0635');
    });

    it('roundToCents: aplica banker rounding (half-even) al céntimo', () => {
        // 0.005 → half-even → 0 (Prisma devuelve "0" sin ceros trailing)
        expect(roundToCents(new Prisma.Decimal('0.005')).toString()).toBe('0');
        // 0.015 → half-even → 0.02
        expect(roundToCents(new Prisma.Decimal('0.015')).toString()).toBe('0.02');
        // 0.025 → half-even → 0.02
        expect(roundToCents(new Prisma.Decimal('0.025')).toString()).toBe('0.02');
        // 0.035 → half-even → 0.04
        expect(roundToCents(new Prisma.Decimal('0.035')).toString()).toBe('0.04');
        // 1.234 → 1.23
        expect(roundToCents(new Prisma.Decimal('1.234')).toString()).toBe('1.23');
        // 1.235 → 1.24 (par más cercano)
        expect(roundToCents(new Prisma.Decimal('1.235')).toString()).toBe('1.24');
    });
});

describe('HIGH-009 — Cálculo de nómina end-to-end Decimal', () => {
    beforeEach(() => {
        mockState.payrollImportBatchCreate.mockClear();
        mockState.payrollImportBatchUpdate.mockClear();
        mockState.employeeFindMany.mockReset();
        mockState.timeEntryFindMany.mockReset();
        mockState.payrollRowCreateMany.mockClear();
    });

    it('proporción exacta al céntimo: 1500.75 * (160/173.2) sin drift binario', async () => {
        mockState.payrollImportBatchCreate.mockResolvedValue({ id: 'batch-1' });
        mockState.employeeFindMany.mockResolvedValue([{
            id: 'emp-1',
            name: 'Decimal Test',
            weeklyHours: 40,
            monthlyGrossSalary: new Prisma.Decimal('1500.75')
        }]);
        // 160 horas trabajadas (mes completo, 8h/día x 20 días)
        const entries: any[] = [];
        for (let day = 1; day <= 20; day++) {
            entries.push(
                { employeeId: 'emp-1', type: 'IN', timestamp: new Date(2024, 0, day, 8, 0, 0) },
                { employeeId: 'emp-1', type: 'OUT', timestamp: new Date(2024, 0, day, 16, 0, 0) }
            );
        }
        mockState.timeEntryFindMany.mockResolvedValue(entries);

        await PayrollAutomationService.generateFromAttendance(2024, 1, 'comp-1', 'user-1');

        const createCall = mockState.payrollRowCreateMany.mock.calls[0]?.[0] as any;
        const row = createCall?.data?.[0];

        // expectedHours = 40 * 4.33 = 173.2
        // proportion = 160 / 173.2 = 0.92378752886...
        // bruto = 1500.75 * 0.92378752886 = 1386.37 (redondeado a 2 decimales)
        expect(row.bruto.toString()).toBe('1386.37');

        // Tasas con regla 2024 (ssWorker = 0.0645)
        // ssTrabajador = 1386.37 * 0.0645 = 89.42 (redondeado)
        // irpf = 1386.37 * 0.15 = 207.96 (redondeado)
        expect(row.ssTrabajador.toString()).toBe('89.42');
        expect(row.irpf.toString()).toBe('207.96');

        // neto = bruto - ssTrabajador - irpf (todos ya redondeados)
        // 1386.37 - 89.42 - 207.96 = 1088.99
        expect(row.neto.toString()).toBe('1088.99');

        // La regla usada debe estar persistida en la fila.
        expect(row.ruleSetVersion).toBe('2024-01-01');
    });

    it('regla 2020 (ssWorker=0.0635) se usa para nóminas de 2023', async () => {
        mockState.payrollImportBatchCreate.mockResolvedValue({ id: 'batch-2020' });
        mockState.employeeFindMany.mockResolvedValue([{
            id: 'emp-2020',
            name: 'Pre-2024 Employee',
            weeklyHours: 40,
            monthlyGrossSalary: new Prisma.Decimal('2000.00')
        }]);
        // 22 días * 8h = 176h trabajadas. expectedHours = 40*4.33 = 173.2
        // proportion = 176/173.2 = 1.0162 (< 1.1, no se capa)
        // bruto = 2000 * 1.0162 = 2032.33 → redondeado = 2032.33
        // ssTrabajador (2020) = 2032.33 * 0.0635 = 129.05
        // irpf = 2032.33 * 0.15 = 304.85
        const entries: any[] = [];
        for (let day = 1; day <= 22; day++) {
            entries.push(
                { employeeId: 'emp-2020', type: 'IN', timestamp: new Date(2023, 5, day, 8, 0, 0) },
                { employeeId: 'emp-2020', type: 'OUT', timestamp: new Date(2023, 5, day, 16, 0, 0) }
            );
        }
        mockState.timeEntryFindMany.mockResolvedValue(entries);

        await PayrollAutomationService.generateFromAttendance(2023, 6, 'comp-1', 'user-1');

        const createCall = mockState.payrollRowCreateMany.mock.calls[0]?.[0] as any;
        const row = createCall?.data?.[0];

        expect(row.ruleSetVersion).toBe('2020-01-01');
        expect(row.ssTrabajador.toString()).toBe('129.05');
        expect(row.irpf.toString()).toBe('304.85');
    });

    it('regla 2024 (ssWorker=0.0645) se usa para nóminas de 2025', async () => {
        mockState.payrollImportBatchCreate.mockResolvedValue({ id: 'batch-2024' });
        mockState.employeeFindMany.mockResolvedValue([{
            id: 'emp-2024',
            name: '2024 Employee',
            weeklyHours: 40,
            monthlyGrossSalary: new Prisma.Decimal('2000.00')
        }]);
        const entries: any[] = [];
        for (let day = 1; day <= 22; day++) {
            entries.push(
                { employeeId: 'emp-2024', type: 'IN', timestamp: new Date(2025, 5, day, 8, 0, 0) },
                { employeeId: 'emp-2024', type: 'OUT', timestamp: new Date(2025, 5, day, 16, 0, 0) }
            );
        }
        mockState.timeEntryFindMany.mockResolvedValue(entries);

        await PayrollAutomationService.generateFromAttendance(2025, 6, 'comp-1', 'user-1');

        const createCall = mockState.payrollRowCreateMany.mock.calls[0]?.[0] as any;
        const row = createCall?.data?.[0];

        expect(row.ruleSetVersion).toBe('2024-01-01');
        expect(row.ssTrabajador.toString()).toBe('131.09');
    });

    it('cálculo no produce drift binario (regression test para 0.1 + 0.2)', () => {
        // La trampa clásica de float: 0.1 + 0.2 = 0.30000000000000004
        const a = new Prisma.Decimal('0.1');
        const b = new Prisma.Decimal('0.2');
        const sum = a.plus(b);
        expect(sum.toString()).toBe('0.3');
        // Verificación equivalente con multiplicación
        const c = new Prisma.Decimal('0.0635');
        const d = new Prisma.Decimal('100');
        const m = c.times(d);
        expect(m.toString()).toBe('6.35');
    });

    it('totalHoursWorked Decimal: 16h sobre expected=173.2 → bruto=92.38 + WARNING', async () => {
        mockState.payrollImportBatchCreate.mockResolvedValue({ id: 'batch-h' });
        mockState.employeeFindMany.mockResolvedValue([{
            id: 'emp-h',
            name: 'Hours test',
            weeklyHours: 40,
            monthlyGrossSalary: new Prisma.Decimal('1000.00')
        }]);
        // Solo 2 días = 16 horas. expectedHours = 173.2.
        // proportion = 16/173.2 = 0.0924 (muy por debajo de 0.8 → WARNING).
        mockState.timeEntryFindMany.mockResolvedValue([
            { employeeId: 'emp-h', type: 'IN', timestamp: new Date(2024, 0, 1, 8, 0, 0) },
            { employeeId: 'emp-h', type: 'OUT', timestamp: new Date(2024, 0, 1, 16, 0, 0) },
            { employeeId: 'emp-h', type: 'IN', timestamp: new Date(2024, 0, 2, 8, 0, 0) },
            { employeeId: 'emp-h', type: 'OUT', timestamp: new Date(2024, 0, 2, 16, 0, 0) }
        ]);

        await PayrollAutomationService.generateFromAttendance(2024, 1, 'comp-1', 'user-1');

        const createCall = mockState.payrollRowCreateMany.mock.calls[0]?.[0] as any;
        const row = createCall?.data?.[0];
        // bruto = 1000 * 0.0924 = 92.38
        expect(row.bruto.toString()).toBe('92.38');
        // proportion < 0.8 → WARNING con nota de validación
        expect(row.status).toBe('WARNING');
        expect(row.validationNotes).toMatch(/Horas trabajadas/);
    });

    it('redondeo al céntimo: no acumula drift por operaciones encadenadas', () => {
        const dec = new Prisma.Decimal('0.1');
        const res = dec.times(3);
        expect(roundToCents(res).toString()).toBe('0.3');
    });
});
