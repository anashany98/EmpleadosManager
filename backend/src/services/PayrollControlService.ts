import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { CalendarService } from './CalendarService';

const Decimal = Prisma.Decimal;
const FORMULA_VERSION = '2026-control-v1';
const EDITABLE_PERIOD_STATUSES = new Set(['DRAFT', 'IN_REVIEW', 'REOPENED']);
// TGSS fijo para todos los empleados (cuota del trabajador a la Seguridad
// Social). Se aplica siempre, sin importar el valor almacenado: la columna
// de la rejilla es fija y el cálculo de BRUTO/% disponible lo usa directo.
const DEFAULT_TGSS_RATE = new Decimal('0.0635');

const DEFAULT_CONCEPTS = [
    { key: 'ARREARS', label: 'Atrasos', gestoriaCode: '044', order: 10 },
    { key: 'COMMISSION', label: 'Comisión', gestoriaCode: '048', order: 20 },
    { key: 'PRODUCTIVITY_AMOUNT', label: 'Productividad', gestoriaCode: '050', order: 30 },
    { key: 'EXPENSES', label: 'Gastos', gestoriaCode: '182', order: 40 },
    { key: 'OVERTIME_AMOUNT', label: 'Horas extra', gestoriaCode: '434', order: 50 },
    { key: 'DIETS', label: 'Dietas', gestoriaCode: '604', order: 60 },
    { key: 'WEEKLY_ADVANCE', label: 'Anticipo semanal', gestoriaCode: '791', order: 70 }
] as const;

export interface CellUpdatePayload {
    expectedVersion: number;
    overtimeRate?: number;
    holidayOvertimeRate?: number;
    overtimeHours?: number;
    holidayOvertimeHours?: number;
    totalOvertimeAmount?: number;
    positiveVariable?: number;
    negativeVariable?: number;
    diets?: number;
    irpf?: number;
    tgss?: number;
    availablePercentage?: number;
    gross?: number;
    productivity?: number;
    hoursAmount?: number;
    difference?: number;
    category?: string;
    department?: string;
    gestoriaCode?: string | null;
    observations?: string;
}

export interface ConceptValuePayload {
    conceptConfigId: string;
    value: number;
}

export interface DailyEntryPayload {
    workDate: string;
    entryTime: string | null;
    breakOutTime: string | null;
    breakInTime: string | null;
    exitTime: string | null;
    discountHours: number;
    scheduledHours: number;
    isHoliday: boolean;
    dietAmount: number;
    notes: string;
}

type RecordForCalculation = Record<string, unknown>;

function decimal(value: unknown): Prisma.Decimal {
    return new Decimal(value === null || value === undefined || value === '' ? 0 : String(value));
}

function money(value: Prisma.Decimal): Prisma.Decimal {
    return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function percentage(value: Prisma.Decimal): Prisma.Decimal {
    return value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

function manualOrCalculated(record: RecordForCalculation, field: string, calculated: Prisma.Decimal): Prisma.Decimal {
    const isManual = record[`is${field.charAt(0).toUpperCase()}${field.slice(1)}Manual`];
    const manual = record[`${field}Manual`];
    return isManual === true && manual !== null && manual !== undefined ? decimal(manual) : calculated;
}

function assertEditable(status: string): void {
    if (!EDITABLE_PERIOD_STATUSES.has(status)) {
        throw new AppError('El período está cerrado, exportado o enviado a gestoría. Debe reabrirse antes de modificarlo.', 403);
    }
}

function auditData(action: string, entity: string, entityId: string, userId: string, metadata: Record<string, unknown>) {
    return {
        action,
        entity,
        entityId,
        userId,
        metadata: JSON.stringify(metadata)
    };
}

function utcDate(dateValue: string): Date {
    return new Date(`${dateValue}T00:00:00.000Z`);
}

function timeOnDate(dateValue: string, timeValue: string | null): Date | null {
    return timeValue ? new Date(`${dateValue}T${timeValue}:00.000Z`) : null;
}

function intervalHours(start: Date | null, end: Date | null): Prisma.Decimal {
    if (!start || !end) return new Decimal(0);
    let milliseconds = end.getTime() - start.getTime();
    if (milliseconds < 0) milliseconds += 24 * 60 * 60 * 1000;
    return new Decimal(milliseconds).div(3_600_000);
}

function calculateDailyEntry(entry: DailyEntryPayload, calendarHolidayName?: string, vacationDates?: Set<string>) {
    const entryAt = timeOnDate(entry.workDate, entry.entryTime);
    const breakOutAt = timeOnDate(entry.workDate, entry.breakOutTime);
    const breakInAt = timeOnDate(entry.workDate, entry.breakInTime);
    const exitAt = timeOnDate(entry.workDate, entry.exitTime);
    const hasSplitShift = Boolean(breakOutAt || breakInAt);
    const worked = hasSplitShift
        ? intervalHours(entryAt, breakOutAt).plus(intervalHours(breakInAt, exitAt))
        : intervalHours(entryAt, exitAt);
    const workedHours = worked.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const date = utcDate(entry.workDate);
    const day = date.getUTCDay();
    const holidayOrWeekend = entry.isHoliday || Boolean(calendarHolidayName) || day === 0 || day === 6;
    const isVacationDay = Boolean(vacationDates?.has(entry.workDate));
    // Festivos, fines de semana y vacaciones aprobadas no tienen jornada
    // planificada ni descuento, igual que la plantilla de control horario
    // (H.LAB = 0 y DESCONTAR = 0) y que la rejilla del empleado. Sin esta
    // regla, un festivo o un día de vacaciones trabajado sumaba 8 h a las
    // planificadas y descuadraba el total frente a la plantilla de gestoría.
    // Las vacaciones se resuelven aquí con los datos aprobados del empleado
    // para que el traspaso no dependa de que el cliente envíe 0 en H.LAB.
    const noScheduledShift = holidayOrWeekend || isVacationDay;
    const discountHours = noScheduledShift
        ? new Decimal(0)
        : decimal(entry.discountHours).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const scheduledHours = noScheduledShift
        ? new Decimal(0)
        : decimal(entry.scheduledHours).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const netWorked = workedHours.minus(discountHours);
    // En vacaciones trabajadas las horas cuentan como extra normal (no como
    // extra festiva), igual que en la rejilla del empleado; solo festivos y
    // fines de semana van a la columna de festivas.
    const overtimeHours = holidayOrWeekend
        ? new Decimal(0)
        : Decimal.max(netWorked.minus(scheduledHours), 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const holidayOvertimeHours = holidayOrWeekend
        ? Decimal.max(netWorked, 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        : new Decimal(0);

    return {
        workDate: date,
        entryAt,
        breakOutAt,
        breakInAt,
        exitAt,
        workedHours,
        discountHours,
        scheduledHours,
        overtimeHours,
        holidayOvertimeHours,
        dietAmount: money(decimal(entry.dietAmount)),
        isHoliday: entry.isHoliday,
        isCalendarHoliday: Boolean(calendarHolidayName),
        holidayName: calendarHolidayName || null,
        notes: entry.notes || null
    };
}

const recordInclude = {
    employee: {
        select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            category: true,
            department: true,
            payrollAgencyEmployeeCode: true,
            active: true
        }
    },
    overrides: { orderBy: { createdAt: 'desc' as const }, take: 20 },
    conceptValues: { orderBy: { key: 'asc' as const } },
    dailyEntries: { orderBy: { workDate: 'asc' as const } }
};

export class PayrollControlService {
    static calculateDailyEntryState(entry: DailyEntryPayload, calendarHolidayName?: string, vacationDates?: Set<string>) {
        return calculateDailyEntry(entry, calendarHolidayName, vacationDates);
    }

    static calculateRecordState(record: RecordForCalculation) {
        const overtimeRate = decimal(record.overtimeRate);
        const holidayOvertimeRate = decimal(record.holidayOvertimeRate);
        // Una jornada por debajo de la prevista es una desviación de presencia,
        // no una hora extra negativa. El límite se aplica también aquí para
        // sanear registros históricos anteriores a esta regla.
        const overtimeHours = Decimal.max(decimal(record.overtimeHours), 0);
        const holidayOvertimeHours = Decimal.max(decimal(record.holidayOvertimeHours), 0);
        const totalOvertimeAmountCalculated = money(overtimeRate.mul(overtimeHours).plus(holidayOvertimeRate.mul(holidayOvertimeHours)));
        const totalOvertimeAmount = manualOrCalculated(record, 'totalOvertimeAmount', totalOvertimeAmountCalculated);

        const irpf = decimal(record.irpf);
        // TGSS es 6,35% fijo para todos: no se hereda ni se edita por empleado.
        const tgss = DEFAULT_TGSS_RATE;
        const availablePercentageCalculated = percentage(new Decimal(1).minus(irpf).minus(tgss));
        const availablePercentage = manualOrCalculated(record, 'availablePercentage', availablePercentageCalculated);

        if (availablePercentage.lte(0) && totalOvertimeAmount.gt(0)) {
            throw new AppError('IRPF y TGSS dejan un porcentaje disponible no válido para calcular el bruto.', 422);
        }

        const grossCalculated = availablePercentage.gt(0)
            ? money(totalOvertimeAmount.div(availablePercentage))
            : new Decimal(0);
        const gross = manualOrCalculated(record, 'gross', grossCalculated);
        const positiveVariable = decimal(record.positiveVariable);
        const productivityCalculated = gross.gt(0) ? percentage(positiveVariable.div(gross)) : new Decimal(0);
        const productivity = manualOrCalculated(record, 'productivity', productivityCalculated);
        const hoursCalculated = money(gross.minus(productivity));
        const hoursAmount = manualOrCalculated(record, 'hoursAmount', hoursCalculated);
        const differenceCalculated = money(gross.minus(totalOvertimeAmount));
        const difference = manualOrCalculated(record, 'difference', differenceCalculated);
        const reconciliationCalculated = gross.minus(gross.mul(irpf).plus(gross.mul(tgss))).minus(totalOvertimeAmount)
            .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

        return {
            totalOvertimeAmountCalculated,
            totalOvertimeAmount: record.isTotalOvertimeAmountManual ? money(totalOvertimeAmount) : totalOvertimeAmountCalculated,
            availablePercentageCalculated,
            availablePercentage: record.isAvailablePercentageManual ? percentage(availablePercentage) : availablePercentageCalculated,
            grossCalculated,
            gross: record.isGrossManual ? money(gross) : grossCalculated,
            productivityCalculated,
            productivity: record.isProductivityManual ? percentage(productivity) : productivityCalculated,
            hoursCalculated,
            hoursAmount: record.isHoursAmountManual ? money(hoursAmount) : hoursCalculated,
            differenceCalculated,
            difference: record.isDifferenceManual ? money(difference) : differenceCalculated,
            reconciliationCalculated
        };
    }

    static async ensureDefaultConceptConfigs(companyId: string) {
        await prisma.payrollControlConceptConfig.createMany({
            data: DEFAULT_CONCEPTS.map((concept) => ({ companyId, ...concept })),
            skipDuplicates: true
        });
        return prisma.payrollControlConceptConfig.findMany({
            where: { companyId, active: true },
            orderBy: { order: 'asc' }
        });
    }

    static async listPeriods(companyId: string, limit = 24) {
        const periods = await prisma.payrollControlPeriod.findMany({
            where: { companyId },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            take: Math.min(Math.max(limit, 1), 60),
            select: {
                id: true,
                year: true,
                month: true,
                status: true,
                formulaVersion: true,
                closedAt: true,
                exportedAt: true,
                updatedAt: true,
                _count: { select: { exports: true } },
                records: {
                    select: {
                        totalOvertimeAmount: true,
                        diets: true,
                        gross: true,
                        _count: { select: { dailyEntries: true } }
                    }
                }
            }
        });

        return periods.map((period) => {
            const totals = period.records.reduce((current, record) => ({
                overtime: current.overtime.plus(record.totalOvertimeAmount),
                diets: current.diets.plus(record.diets),
                gross: current.gross.plus(record.gross)
            }), {
                overtime: new Decimal(0),
                diets: new Decimal(0),
                gross: new Decimal(0)
            });

            return {
                id: period.id,
                year: period.year,
                month: period.month,
                status: period.status,
                formulaVersion: period.formulaVersion,
                employeeCount: period.records.length,
                completedEmployeeCount: period.records.filter((record) => record._count.dailyEntries > 0).length,
                totalOvertimeAmount: money(totals.overtime).toFixed(2),
                totalDiets: money(totals.diets).toFixed(2),
                totalGross: money(totals.gross).toFixed(2),
                exportCount: period._count.exports,
                closedAt: period.closedAt,
                exportedAt: period.exportedAt,
                updatedAt: period.updatedAt
            };
        });
    }

    static async getPeriod(companyId: string, year: number, month: number) {
        if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
            throw new AppError('Año o mes de período inválido.', 400);
        }

        return prisma.payrollControlPeriod.findUnique({
            where: { companyId_year_month: { companyId, year, month } },
            include: { records: { include: recordInclude, orderBy: [{ department: 'asc' }, { employeeId: 'asc' }] } }
        });
    }

    static async createPeriod(companyId: string, year: number, month: number, userId: string) {
        if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
            throw new AppError('Año o mes de período inválido.', 400);
        }
        const existing = await this.getPeriod(companyId, year, month);
        if (existing) throw new AppError('Ya existe un período para esa empresa, año y mes.', 409);

        const employees = await prisma.employee.findMany({
            where: { companyId, active: true, deletedAt: null },
            select: { id: true, category: true, department: true, payrollAgencyEmployeeCode: true }
        });
        const configs = await this.ensureDefaultConceptConfigs(companyId);

        // Herencia de tarifas: para cada empleado se busca SU último registro en
        // cualquier período anterior (no solo el mes inmediatamente anterior), de
        // modo que el IRPF se recuerde mes a mes aunque haya meses sin período o
        // el empleado se añadiera al período previo más tarde.
        const previousRecords = await prisma.payrollControlRecord.findMany({
            where: {
                period: {
                    companyId,
                    OR: [
                        { year: { lt: year } },
                        { year, month: { lt: month } }
                    ]
                }
            },
            orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }],
            select: { employeeId: true, overtimeRate: true, holidayOvertimeRate: true, irpf: true }
        });
        const prevRatesByEmployee = new Map<string, (typeof previousRecords)[number]>();
        for (const record of previousRecords) {
            if (!prevRatesByEmployee.has(record.employeeId)) {
                prevRatesByEmployee.set(record.employeeId, record);
            }
        }

        const categoryRates = await prisma.categoryRate.findMany();
        const categoryRateMap = new Map(categoryRates.map((cr) => [cr.category.toLowerCase().trim(), cr]));

        try {
            return await prisma.$transaction(async (tx) => {
                const created = await tx.payrollControlPeriod.create({
                    data: { companyId, year, month, status: 'DRAFT', formulaVersion: FORMULA_VERSION }
                });
                if (employees.length > 0) {
                    await tx.payrollControlRecord.createMany({
                        data: employees.map((employee) => {
                            const prev = prevRatesByEmployee.get(employee.id);
                            const catKey = (employee.category || '').toLowerCase().trim();
                            const catRate = categoryRateMap.get(catKey);

                            const overtimeRate = prev && Number(prev.overtimeRate) > 0
                                ? prev.overtimeRate
                                : catRate ? catRate.overtimeRate : 0;
                            const holidayOvertimeRate = prev && Number(prev.holidayOvertimeRate) > 0
                                ? prev.holidayOvertimeRate
                                : catRate ? catRate.holidayOvertimeRate : 0;
                            const irpf = prev ? prev.irpf : 0;
                            // TGSS fijo 6,35% para todos: siempre se asigna al crear.
                            const tgss = DEFAULT_TGSS_RATE;

                            return {
                                periodId: created.id,
                                employeeId: employee.id,
                                category: employee.category || 'General',
                                department: employee.department || 'Otros',
                                gestoriaCode: employee.payrollAgencyEmployeeCode || null,
                                overtimeRate,
                                holidayOvertimeRate,
                                overtimeHours: 0,
                                holidayOvertimeHours: 0,
                                irpf,
                                tgss
                            };
                        })
                    });
                    const records = await tx.payrollControlRecord.findMany({
                        where: { periodId: created.id },
                        select: { id: true }
                    });
                    if (configs.length > 0) {
                        await tx.payrollControlConceptValue.createMany({
                            data: records.flatMap((record) => configs.map((config) => ({
                                recordId: record.id,
                                conceptConfigId: config.id,
                                key: config.key,
                                label: config.label,
                                gestoriaCode: config.gestoriaCode,
                                value: 0
                            })))
                        });
                    }
                }
                await tx.auditLog.create({
                    data: auditData('CREATE_PAYROLL_CONTROL_PERIOD', 'PAYROLL_CONTROL_PERIOD', created.id, userId, {
                        companyId,
                        year,
                        month,
                        assignedEmployeeIds: employees.map((employee) => employee.id),
                        employeeCount: employees.length,
                        formulaVersion: FORMULA_VERSION
                    })
                });
                return tx.payrollControlPeriod.findUniqueOrThrow({
                    where: { id: created.id },
                    include: { records: { include: recordInclude, orderBy: [{ department: 'asc' }, { employeeId: 'asc' }] } }
                });
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new AppError('Ya existe un período para esa empresa, año y mes.', 409);
            }
            throw error;
        }
    }

    static async addEmployeeToPeriod(
        periodId: string,
        employee: { id: string; category: string | null; department: string | null; payrollAgencyEmployeeCode: string | null },
        companyId: string,
        year: number,
        month: number
    ) {
        // Último registro del empleado en cualquier período anterior para
        // recordar su IRPF mes a mes (misma regla que en createPeriod).
        const prev = await prisma.payrollControlRecord.findFirst({
            where: {
                employeeId: employee.id,
                period: {
                    companyId,
                    OR: [
                        { year: { lt: year } },
                        { year, month: { lt: month } }
                    ]
                }
            },
            orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }],
            select: { overtimeRate: true, holidayOvertimeRate: true, irpf: true }
        });
        const catRate = employee.category
            ? await prisma.categoryRate.findFirst({ where: { category: { equals: employee.category, mode: 'insensitive' } } })
            : null;

        const overtimeRate = prev && Number(prev.overtimeRate) > 0
            ? prev.overtimeRate
            : catRate ? catRate.overtimeRate : 0;
        const holidayOvertimeRate = prev && Number(prev.holidayOvertimeRate) > 0
            ? prev.holidayOvertimeRate
            : catRate ? catRate.holidayOvertimeRate : 0;
        const irpf = prev ? prev.irpf : 0;
        // TGSS fijo 6,35% para todos: siempre se asigna al crear.
        const tgss = DEFAULT_TGSS_RATE;

        const configs = await this.ensureDefaultConceptConfigs(companyId);

        return prisma.$transaction(async (tx) => {
            const newRecord = await tx.payrollControlRecord.create({
                data: {
                    periodId,
                    employeeId: employee.id,
                    category: employee.category || 'General',
                    department: employee.department || 'Otros',
                    gestoriaCode: employee.payrollAgencyEmployeeCode || null,
                    overtimeRate,
                    holidayOvertimeRate,
                    overtimeHours: 0,
                    holidayOvertimeHours: 0,
                    irpf,
                    tgss
                }
            });
            if (configs.length > 0) {
                await tx.payrollControlConceptValue.createMany({
                    data: configs.map((config) => ({
                        recordId: newRecord.id,
                        conceptConfigId: config.id,
                        key: config.key,
                        label: config.label,
                        gestoriaCode: config.gestoriaCode,
                        value: 0
                    }))
                });
            }
            return tx.payrollControlRecord.findUniqueOrThrow({
                where: { id: newRecord.id },
                include: recordInclude
            });
        });
    }

    static async getEmployeeRecord(employeeId: string, year: number, month: number) {
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, deletedAt: null },
            select: { id: true, companyId: true, category: true, department: true, payrollAgencyEmployeeCode: true, active: true }
        });
        if (!employee?.companyId) throw new AppError('Empleado sin empresa asignada.', 404);

        const monthStart = new Date(Date.UTC(year, month - 1, 1));
        const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        const vacations = await prisma.vacation.findMany({
            where: {
                employeeId,
                status: { in: ['APPROVED', 'EXISTING'] },
                startDate: { lte: monthEnd },
                endDate: { gte: monthStart }
            },
            select: {
                id: true,
                startDate: true,
                endDate: true,
                type: true,
                reason: true,
                days: true,
                status: true
            },
            orderBy: { startDate: 'asc' }
        });

        const period = await this.getPeriod(employee.companyId, year, month);
        if (!period) return { periodStatus: 'NOT_CREATED', periodId: null, record: null, companyId: employee.companyId, vacations };

        let record = period.records.find((r) => r.employeeId === employeeId) || null;

        if (!record && EDITABLE_PERIOD_STATUSES.has(period.status) && employee.active) {
            record = await this.addEmployeeToPeriod(period.id, employee, period.companyId, period.year, period.month);
        } else if (record && !record.gestoriaCode && employee.payrollAgencyEmployeeCode) {
            await prisma.payrollControlRecord.update({
                where: { id: record.id },
                data: { gestoriaCode: employee.payrollAgencyEmployeeCode }
            });
            record.gestoriaCode = employee.payrollAgencyEmployeeCode;
        }

        // Tarifas desde la categoría de configuración (Ajustes → Tarifas por
        // categoría): si el registro no tiene precio de hora extra/festiva (0),
        // se rellena con el de la categoría del empleado para que el importe de
        // horas se calcule bien y la rejilla de gestoría no avise de "tarifa a 0".
        // Solo se cubre lo que falte; los precios ya fijados (manuales o
        // heredados) se respetan.
        if (record && employee.category) {
            const missingRate = Number(record.overtimeRate) === 0 || Number(record.holidayOvertimeRate) === 0;
            if (missingRate) {
                const catRate = await prisma.categoryRate.findFirst({
                    where: { category: { equals: employee.category, mode: 'insensitive' } }
                });
                if (catRate) {
                    const overtimeRate = Number(record.overtimeRate) === 0 && Number(catRate.overtimeRate) > 0
                        ? catRate.overtimeRate
                        : undefined;
                    const holidayOvertimeRate = Number(record.holidayOvertimeRate) === 0 && Number(catRate.holidayOvertimeRate) > 0
                        ? catRate.holidayOvertimeRate
                        : undefined;
                    if (overtimeRate !== undefined || holidayOvertimeRate !== undefined) {
                        await prisma.payrollControlRecord.update({
                            where: { id: record.id },
                            data: {
                                ...(overtimeRate !== undefined ? { overtimeRate } : {}),
                                ...(holidayOvertimeRate !== undefined ? { holidayOvertimeRate } : {}),
                                version: { increment: 1 }
                            }
                        });
                        record = {
                            ...record,
                            ...(overtimeRate !== undefined ? { overtimeRate } : {}),
                            ...(holidayOvertimeRate !== undefined ? { holidayOvertimeRate } : {})
                        };
                    }
                }
            }
        }

        return { periodStatus: period.status, periodId: period.id, record, vacations };
    }

    static async listExports(periodId: string) {
        return prisma.payrollControlExport.findMany({
            where: { periodId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                filename: true,
                templateHash: true,
                outputHash: true,
                createdAt: true,
                createdBy: { select: { id: true, email: true } }
            }
        });
    }

    static async updateDailyEntries(
        recordId: string,
        expectedVersion: number,
        entries: DailyEntryPayload[],
        userId: string,
        monthly?: Pick<CellUpdatePayload, 'overtimeRate' | 'holidayOvertimeRate' | 'positiveVariable' | 'negativeVariable' | 'irpf' | 'tgss' | 'gestoriaCode' | 'observations'>
    ) {
        const record = await prisma.payrollControlRecord.findUnique({ where: { id: recordId }, include: { period: true } });
        if (!record) throw new AppError('Registro de control no encontrado.', 404);
        assertEditable(record.period.status);
        if (record.version !== expectedVersion) throw new AppError('El registro cambió en otra sesión. Recarga antes de guardar.', 409);

        // Datos mensuales opcionales: se persisten en la misma transacción que
        // el detalle diario (antes el cliente hacía dos PUTs encadenados).
        const monthlyData: Record<string, unknown> = {};
        if (monthly) {
            const monthlyKeys = ['overtimeRate', 'holidayOvertimeRate', 'positiveVariable', 'negativeVariable', 'irpf', 'tgss', 'observations'] as const;
            for (const key of monthlyKeys) {
                if (monthly[key] !== undefined) monthlyData[key] = monthly[key];
            }
            if (monthly.gestoriaCode !== undefined) {
                monthlyData.gestoriaCode = typeof monthly.gestoriaCode === 'string' ? monthly.gestoriaCode.trim() || null : null;
            }
        }

        const expectedPrefix = `${record.period.year}-${String(record.period.month).padStart(2, '0')}-`;
        const uniqueDates = new Set(entries.map((entry) => entry.workDate));
        if (uniqueDates.size !== entries.length || entries.some((entry) => !entry.workDate.startsWith(expectedPrefix))) {
            throw new AppError('Las filas diarias deben ser únicas y pertenecer al período seleccionado.', 422);
        }

        const monthStart = new Date(Date.UTC(record.period.year, record.period.month - 1, 1));
        const monthEnd = new Date(Date.UTC(record.period.year, record.period.month, 0, 23, 59, 59, 999));
        const calendarEvents = await CalendarService.getUnifiedEvents(
            userId,
            record.period.companyId,
            monthStart,
            monthEnd
        );
        const calendarHolidays = new Map<string, string>();
        for (const event of calendarEvents.filter((item) => item.type === 'holiday')) {
            const cursor = new Date(Math.max(event.start.getTime(), monthStart.getTime()));
            cursor.setUTCHours(0, 0, 0, 0);
            const eventEnd = new Date(Math.min(event.end.getTime(), monthEnd.getTime()));
            eventEnd.setUTCHours(23, 59, 59, 999);
            while (cursor <= eventEnd) {
                calendarHolidays.set(cursor.toISOString().slice(0, 10), event.title.replace(/^⚫\s*/, ''));
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }
        }

        // Vacaciones aprobadas del empleado que caen en el período: la rejilla
        // las muestra sin jornada planificada (H.LAB = 0, DESCONTAR = 0) y el
        // traspaso a gestoría debe aplicar la misma regla aunque el cliente
        // envíe valores antiguos (datos previos al cruce con vacaciones).
        const vacations = await prisma.vacation.findMany({
            where: {
                employeeId: record.employeeId,
                status: { in: ['APPROVED', 'EXISTING'] },
                startDate: { lte: monthEnd },
                endDate: { gte: monthStart }
            },
            select: { startDate: true, endDate: true }
        });
        const vacationDates = new Set<string>();
        for (const vacation of vacations) {
            const cursor = new Date(Math.max(vacation.startDate.getTime(), monthStart.getTime()));
            cursor.setUTCHours(0, 0, 0, 0);
            const vacationEnd = new Date(Math.min(vacation.endDate.getTime(), monthEnd.getTime()));
            vacationEnd.setUTCHours(23, 59, 59, 999);
            while (cursor <= vacationEnd) {
                vacationDates.add(cursor.toISOString().slice(0, 10));
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }
        }

        await prisma.$transaction(async (tx) => {
            for (const entry of entries) {
                const calculated = this.calculateDailyEntryState(entry, calendarHolidays.get(entry.workDate), vacationDates);
                await tx.payrollControlDailyEntry.upsert({
                    where: { recordId_workDate: { recordId, workDate: calculated.workDate } },
                    create: { recordId, ...calculated },
                    update: calculated
                });
            }

            const dailyEntries = await tx.payrollControlDailyEntry.findMany({
                where: {
                    recordId,
                    workDate: {
                        gte: new Date(Date.UTC(record.period.year, record.period.month - 1, 1)),
                        lt: new Date(Date.UTC(record.period.year, record.period.month, 1))
                    }
                }
            });
            const calculatedOvertimeHours = dailyEntries.reduce(
                (sum, entry) => sum.plus(Decimal.max(entry.overtimeHours, 0)),
                new Decimal(0)
            ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            const calculatedHolidayOvertimeHours = dailyEntries.reduce(
                (sum, entry) => sum.plus(entry.holidayOvertimeHours),
                new Decimal(0)
            ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            const calculatedDiets = dailyEntries.reduce(
                (sum, entry) => sum.plus(entry.dietAmount),
                new Decimal(0)
            ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            // Las cantidades sobrescritas a mano en Control Gestoría prevalecen
            // sobre la suma diaria: solo se recalculan si no hay marca manual.
            const overtimeHours = manualOrCalculated(record, 'overtimeHours', calculatedOvertimeHours);
            const holidayOvertimeHours = manualOrCalculated(record, 'holidayOvertimeHours', calculatedHolidayOvertimeHours);
            const diets = manualOrCalculated(record, 'diets', calculatedDiets);

            // Al actualizar horas diarias explícitamente, se limpia cualquier sobrescritura manual
            // previa sobre el importe de horas para sincronizar con las nuevas horas introducidas.
            // Los campos mensuales enviados se aplican en el mismo cálculo y guardado.
            const calculatedRecord = this.calculateRecordState({
                ...record,
                ...monthlyData,
                overtimeHours,
                holidayOvertimeHours,
                diets,
                isTotalOvertimeAmountManual: false,
                totalOvertimeAmountManual: null
            });

            if (monthlyData.gestoriaCode !== undefined && record.employeeId) {
                const rawCode = typeof monthlyData.gestoriaCode === 'string' ? monthlyData.gestoriaCode.trim() || null : null;
                try {
                    await tx.employee.update({
                        where: { id: record.employeeId },
                        data: { payrollAgencyEmployeeCode: rawCode }
                    });
                } catch (err) {
                    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                        throw new AppError(`El código de gestoría '${rawCode}' ya está asignado a otro empleado en esta empresa.`, 409);
                    }
                    throw err;
                }
            }

            const updated = await tx.payrollControlRecord.updateMany({
                where: { id: recordId, version: expectedVersion },
                data: {
                    overtimeHours,
                    holidayOvertimeHours,
                    diets,
                    isTotalOvertimeAmountManual: false,
                    totalOvertimeAmountManual: null,
                    ...monthlyData,
                    ...calculatedRecord,
                    version: { increment: 1 }
                }
            });
            if (updated.count !== 1) throw new AppError('El registro cambió en otra sesión. Recarga antes de guardar.', 409);
            await tx.auditLog.create({
                data: auditData('UPDATE_CONTROL_DAILY_ENTRIES', 'PAYROLL_CONTROL_RECORD', recordId, userId, {
                    employeeId: record.employeeId,
                    periodId: record.periodId,
                    previousVersion: expectedVersion,
                    dates: entries.map((entry) => entry.workDate),
                    totals: {
                        overtimeHours: String(overtimeHours),
                        holidayOvertimeHours: String(holidayOvertimeHours),
                        diets: String(diets)
                    }
                })
            });
        });

        return prisma.payrollControlRecord.findUniqueOrThrow({ where: { id: recordId }, include: recordInclude });
    }

    static async updateRecordCell(recordId: string, payload: CellUpdatePayload, userId: string) {
        const record = await prisma.payrollControlRecord.findUnique({ where: { id: recordId }, include: { period: true } });
        if (!record) throw new AppError('Registro de control no encontrado.', 404);
        assertEditable(record.period.status);
        if (record.version !== payload.expectedVersion) throw new AppError('El registro cambió en otra sesión. Recarga antes de guardar.', 409);

        const { expectedVersion: _expectedVersion, ...input } = payload;
        const manualFields = new Set(['totalOvertimeAmount', 'availablePercentage', 'gross', 'productivity', 'hoursAmount', 'difference']);
        // Campos que la rejilla diaria alimenta automáticamente, pero que se
        // pueden sobrescribir a mano en Control Gestoría. La marca manual hace
        // que la suma diaria posterior respete el valor editado.
        const inputManualFields = new Set(['overtimeHours', 'holidayOvertimeHours', 'diets']);
        const updateData: Record<string, unknown> = {};
        const overrides: Array<{ fieldName: string; calculatedValue: string; manualValue: string; previousValue: string; newValue: string; userId: string }> = [];

        for (const [field, value] of Object.entries(input)) {
            if (value === undefined) continue;
            if (inputManualFields.has(field)) {
                updateData[field] = value;
                updateData[`${field}Manual`] = value;
                updateData[`is${field.charAt(0).toUpperCase()}${field.slice(1)}Manual`] = true;
                overrides.push({
                    fieldName: field,
                    calculatedValue: String((record as unknown as Record<string, unknown>)[field]),
                    manualValue: String(value),
                    previousValue: String((record as unknown as Record<string, unknown>)[field]),
                    newValue: String(value),
                    userId
                });
            } else if (manualFields.has(field)) {
                const calculated = (record as unknown as Record<string, unknown>)[`${field}Calculated`] ?? (record as unknown as Record<string, unknown>)[field];
                updateData[`${field}Manual`] = value;
                updateData[`is${field.charAt(0).toUpperCase()}${field.slice(1)}Manual`] = true;
                overrides.push({
                    fieldName: field,
                    calculatedValue: String(calculated),
                    manualValue: String(value),
                    previousValue: String((record as unknown as Record<string, unknown>)[field]),
                    newValue: String(value),
                    userId
                });
            } else {
                updateData[field] = value;
            }
        }

        const calculations = this.calculateRecordState({ ...record, ...updateData });
        Object.assign(updateData, calculations, { version: { increment: 1 } });

        await prisma.$transaction(async (tx) => {
            if (input.gestoriaCode !== undefined && record.employeeId) {
                const rawCode = typeof input.gestoriaCode === 'string' ? input.gestoriaCode.trim() || null : null;
                updateData.gestoriaCode = rawCode;
                try {
                    await tx.employee.update({
                        where: { id: record.employeeId },
                        data: { payrollAgencyEmployeeCode: rawCode }
                    });
                } catch (err) {
                    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                        throw new AppError(`El código de gestoría '${rawCode}' ya está asignado a otro empleado en esta empresa.`, 409);
                    }
                    throw err;
                }
            }

            const result = await tx.payrollControlRecord.updateMany({
                where: { id: recordId, version: payload.expectedVersion },
                data: updateData as Prisma.PayrollControlRecordUpdateManyMutationInput
            });
            if (result.count !== 1) throw new AppError('El registro cambió en otra sesión. Recarga antes de guardar.', 409);
            if (overrides.length > 0) await tx.payrollControlOverride.createMany({ data: overrides.map((entry) => ({ recordId, ...entry })) });
            await tx.auditLog.create({ data: auditData('UPDATE_CONTROL_CELL', 'PAYROLL_CONTROL_RECORD', recordId, userId, {
                employeeId: record.employeeId,
                periodId: record.periodId,
                previousVersion: payload.expectedVersion,
                fields: Object.keys(input)
            }) });
        });
        return prisma.payrollControlRecord.findUniqueOrThrow({ where: { id: recordId }, include: recordInclude });
    }

    static async restoreCalculatedCell(recordId: string, fieldName: string, expectedVersion: number, userId: string) {
        const record = await prisma.payrollControlRecord.findUnique({ where: { id: recordId }, include: { period: true } });
        if (!record) throw new AppError('Registro no encontrado.', 404);
        assertEditable(record.period.status);
        if (record.version !== expectedVersion) throw new AppError('El registro cambió en otra sesión. Recarga antes de restaurar.', 409);

        const updateData: Record<string, unknown> = {
            [`${fieldName}Manual`]: null,
            [`is${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1)}Manual`]: false
        };
        // Al restaurar una cantidad derivada de la rejilla diaria, se recalcula
        // la suma real de las entradas diarias del período en vez de dejar un
        // valor obsoleto hasta el siguiente guardado de la rejilla.
        if (fieldName === 'overtimeHours' || fieldName === 'holidayOvertimeHours' || fieldName === 'diets') {
            const monthStart = new Date(Date.UTC(record.period.year, record.period.month - 1, 1));
            const monthEnd = new Date(Date.UTC(record.period.year, record.period.month, 1));
            const dailyEntries = await prisma.payrollControlDailyEntry.findMany({
                where: { recordId, workDate: { gte: monthStart, lt: monthEnd } }
            });
            updateData[fieldName] = fieldName === 'overtimeHours'
                ? dailyEntries.reduce((sum, entry) => sum.plus(Decimal.max(entry.overtimeHours, 0)), new Decimal(0)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
                : fieldName === 'holidayOvertimeHours'
                    ? dailyEntries.reduce((sum, entry) => sum.plus(entry.holidayOvertimeHours), new Decimal(0)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
                    : dailyEntries.reduce((sum, entry) => sum.plus(entry.dietAmount), new Decimal(0)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        }
        Object.assign(updateData, this.calculateRecordState({ ...record, ...updateData }), { version: { increment: 1 } });

        await prisma.$transaction(async (tx) => {
            const result = await tx.payrollControlRecord.updateMany({
                where: { id: recordId, version: expectedVersion },
                data: updateData as Prisma.PayrollControlRecordUpdateManyMutationInput
            });
            if (result.count !== 1) throw new AppError('El registro cambió en otra sesión. Recarga antes de restaurar.', 409);
            await tx.payrollControlOverride.create({ data: {
                recordId, fieldName,
                calculatedValue: String((updateData as Record<string, unknown>)[fieldName]),
                manualValue: null,
                previousValue: String((record as unknown as Record<string, unknown>)[fieldName]),
                newValue: String((updateData as Record<string, unknown>)[fieldName]),
                userId
            } });
            await tx.auditLog.create({ data: auditData('RESTORE_CONTROL_CELL', 'PAYROLL_CONTROL_RECORD', recordId, userId, { fieldName, expectedVersion }) });
        });
        return prisma.payrollControlRecord.findUniqueOrThrow({ where: { id: recordId }, include: recordInclude });
    }

    static async updateConceptValue(recordId: string, payload: ConceptValuePayload, expectedVersion: number, userId: string) {
        const record = await prisma.payrollControlRecord.findUnique({ where: { id: recordId }, include: { period: true } });
        if (!record) throw new AppError('Registro no encontrado.', 404);
        assertEditable(record.period.status);
        if (record.version !== expectedVersion) throw new AppError('El registro cambió en otra sesión. Recarga antes de guardar.', 409);
        const value = money(decimal(payload.value));
        await prisma.$transaction(async (tx) => {
            const concept = await tx.payrollControlConceptValue.findFirst({ where: { recordId, conceptConfigId: payload.conceptConfigId } });
            if (!concept) throw new AppError('Concepto no encontrado para este empleado.', 404);
            const updated = await tx.payrollControlRecord.updateMany({ where: { id: recordId, version: expectedVersion }, data: { version: { increment: 1 } } });
            if (updated.count !== 1) throw new AppError('El registro cambió en otra sesión. Recarga antes de guardar.', 409);
            await tx.payrollControlConceptValue.update({ where: { id: concept.id }, data: { value, manualValue: value, isManual: true } });
            await tx.auditLog.create({ data: auditData('UPDATE_CONTROL_CONCEPT', 'PAYROLL_CONTROL_RECORD', recordId, userId, {
                conceptConfigId: payload.conceptConfigId, previousValue: String(concept.value), newValue: String(value)
            }) });
        });
        return prisma.payrollControlRecord.findUniqueOrThrow({ where: { id: recordId }, include: recordInclude });
    }

    static async updatePeriodStatus(periodId: string, status: string, reopenReason: string | null | undefined, userId: string) {
        const period = await prisma.payrollControlPeriod.findUnique({ where: { id: periodId } });
        if (!period) throw new AppError('Período no encontrado.', 404);
        const transitions: Record<string, string[]> = {
            DRAFT: ['IN_REVIEW'],
            IN_REVIEW: ['CLOSED'],
            CLOSED: ['EXPORTED', 'REOPENED'],
            EXPORTED: ['SENT_TO_AGENCY', 'REOPENED'],
            SENT_TO_AGENCY: ['REOPENED'],
            REOPENED: ['IN_REVIEW']
        };
        if (!transitions[period.status]?.includes(status)) throw new AppError(`Transición de ${period.status} a ${status} no permitida.`, 409);
        if (status === 'REOPENED' && (!reopenReason || reopenReason.trim().length < 5)) {
            throw new AppError('La reapertura requiere un motivo de al menos 5 caracteres.', 400);
        }
        const data: Prisma.PayrollControlPeriodUpdateInput = { status, version: { increment: 1 } };
        if (status === 'CLOSED') Object.assign(data, { closedAt: new Date(), closedById: userId });
        if (status === 'REOPENED') Object.assign(data, { reopenedAt: new Date(), reopenedById: userId, reopenReason: reopenReason?.trim() });
        return prisma.$transaction(async (tx) => {
            const updated = await tx.payrollControlPeriod.update({ where: { id: periodId }, data });
            await tx.auditLog.create({ data: auditData('CHANGE_PERIOD_STATUS', 'PAYROLL_CONTROL_PERIOD', periodId, userId, {
                previousStatus: period.status, newStatus: status, reopenReason: status === 'REOPENED' ? reopenReason?.trim() : undefined
            }) });
            return updated;
        });
    }

    static async buildGestoriaPreview(periodId: string) {
        const period = await prisma.payrollControlPeriod.findUnique({
            where: { id: periodId },
            include: { company: true, records: { include: { employee: true, conceptValues: true }, orderBy: { employeeId: 'asc' } } }
        });
        if (!period) throw new AppError('Período no encontrado.', 404);
        const templatePath = process.env.GESTORIA_TEMPLATE_PATH || path.resolve(process.cwd(), '../documentos-referencia/gestoria.xlsx');
        let template: Buffer;
        try { template = await fs.readFile(templatePath); } catch { throw new AppError('No se localiza la plantilla oficial gestoria.xlsx.', 500); }
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);
        const sheet = workbook.getWorksheet('Conceptos');
        if (!sheet) throw new AppError('La plantilla no contiene la hoja Conceptos.', 422);
        const rowsByCode = new Map<string, number>();
        const errors: string[] = [];
        for (let row = 9; row <= 91; row++) {
            const code = String(sheet.getCell(`B${row}`).text || sheet.getCell(`B${row}`).value || '').trim();
            if (!code) continue;
            if (rowsByCode.has(code)) errors.push(`Código duplicado '${code}' en filas ${rowsByCode.get(code)} y ${row} de la plantilla.`);
            rowsByCode.set(code, row);
        }
        const mappings = period.records.map((record) => {
            // `gestoriaCode` es el snapshot del período. Para períodos creados
            // antes de introducir el código explícito solo se admite el nuevo
            // campo del empleado: no hay ningún fallback a DNI, subcuenta o UUID.
            const code = record.gestoriaCode || record.employee.payrollAgencyEmployeeCode || '';
            const row = code ? rowsByCode.get(code) : undefined;
            if (!code) errors.push(`El empleado ${record.employee.id} no tiene código de gestoría.`);
            else if (!row) errors.push(`El código '${code}' no aparece en B9:B91 de la plantilla.`);
            const concepts = new Map(record.conceptValues.map((value) => [value.gestoriaCode || '', value.value]));
            concepts.set('434', record.totalOvertimeAmount);
            concepts.set('604', record.diets);
            return { recordId: record.id, employeeId: record.employeeId, code, row, concepts };
        });
        return { period, templatePath, templateHash: crypto.createHash('sha256').update(template).digest('hex'), mappings, errors };
    }

    static async exportToGestoria(periodId: string, userId: string) {
        const preview = await this.buildGestoriaPreview(periodId);
        if (preview.period.status !== 'CLOSED' && preview.period.status !== 'EXPORTED') {
            throw new AppError('Solo se puede exportar un período cerrado.', 409);
        }
        if (preview.errors.length > 0) throw new AppError(`No se puede exportar: ${preview.errors.join(' ')}`, 422);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(preview.templatePath);
        const sheet = workbook.getWorksheet('Conceptos');
        if (!sheet) throw new AppError('La plantilla no contiene la hoja Conceptos.', 422);
        const columnsByCode: Record<string, string> = { '044': 'D', '048': 'E', '050': 'F', '182': 'G', '434': 'H', '604': 'I', '791': 'J' };
        for (const mapping of preview.mappings) {
            if (!mapping.row) continue;
            for (const [code, column] of Object.entries(columnsByCode)) {
                const amount = mapping.concepts.get(code) || new Decimal(0);
                sheet.getCell(`${column}${mapping.row}`).value = Number(money(decimal(amount)).toString());
            }
        }
        const output = Buffer.from(await workbook.xlsx.writeBuffer());
        const outputHash = crypto.createHash('sha256').update(output).digest('hex');
        const filename = `gestoria_${preview.period.year}_${String(preview.period.month).padStart(2, '0')}_${Date.now()}.xlsx`;
        const mappingJson = JSON.stringify(preview.mappings.map((mapping) => ({
            employeeId: mapping.employeeId, code: mapping.code, row: mapping.row,
            concepts: Object.fromEntries([...mapping.concepts.entries()].map(([code, amount]) => [code, String(amount)]))
        })));
        await prisma.$transaction(async (tx) => {
            await tx.payrollControlExport.create({ data: {
                periodId, filename, templateHash: preview.templateHash, outputHash, content: output, mappingJson, createdById: userId
            } });
            await tx.payrollControlPeriod.update({ where: { id: periodId }, data: { status: 'EXPORTED', exportedAt: new Date(), exportedById: userId, version: { increment: 1 } } });
            await tx.auditLog.create({ data: auditData('EXPORT_GESTORIA', 'PAYROLL_CONTROL_PERIOD', periodId, userId, {
                filename, templateHash: preview.templateHash, outputHash, rowCount: preview.mappings.length
            }) });
        });
        return { filename, buffer: output, templateHash: preview.templateHash, outputHash };
    }

    static async getExport(exportId: string) {
        const exportRecord = await prisma.payrollControlExport.findUnique({ include: { period: true }, where: { id: exportId } });
        if (!exportRecord) throw new AppError('Exportación no encontrada.', 404);
        return exportRecord;
    }

    /**
     * Parte mensual de horas imputadas a obras (Excel). Agrupa por empleado y
     * por obra para el mes indicado y sirve como parte para la gestoría o para
     * facturación. Con `employeeId` el parte es solo de ese empleado (botón del
     * control horario); sin él, de toda la empresa (control de gestoría).
     * Los registros que abarcan varios días suman sus horas completas, la misma
     * regla que el indicador del control horario.
     */
    static async buildObraHoursWorkbook(companyId: string, year: number, month: number, employeeId?: string) {
        const monthStart = new Date(Date.UTC(year, month - 1, 1));
        const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        const entries = await prisma.employeeProjectWork.findMany({
            where: {
                startDate: { lte: monthEnd },
                endDate: { gte: monthStart },
                employee: { companyId, ...(employeeId ? { id: employeeId } : {}) }
            },
            include: {
                employee: { select: { id: true, name: true, firstName: true, lastName: true, category: true } },
                project: { select: { id: true, code: true, name: true } }
            },
            orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }, { project: { code: 'asc' } }]
        });

        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const byEmployee = new Map<string, { employeeName: string; category: string; rows: Array<{ code: string; name: string; hours: number }>; total: number }>();
        const byProject = new Map<string, { code: string; name: string; hours: number }>();
        for (const entry of entries) {
            const empName = entry.employee.lastName
                ? `${entry.employee.lastName}, ${entry.employee.firstName || entry.employee.name || ''}`
                : entry.employee.name;
            const hours = Number(entry.hours || 0);
            const bucket = byEmployee.get(entry.employeeId) || { employeeName: empName, category: entry.employee.category || '', rows: [], total: 0 };
            bucket.total += hours;
            const existing = bucket.rows.find((item) => item.code === entry.project.code);
            if (existing) existing.hours += hours;
            else bucket.rows.push({ code: entry.project.code || '—', name: entry.project.name || 'Obra', hours });
            byEmployee.set(entry.employeeId, bucket);

            const project = byProject.get(entry.projectId) || { code: entry.project.code || '—', name: entry.project.name || 'Obra', hours: 0 };
            project.hours += hours;
            byProject.set(entry.projectId, project);
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Freebuff';
        workbook.created = new Date();
        const periodLabel = `${monthNames[month - 1]} ${year}`;

        const detail = workbook.addWorksheet('Horas por empleado y obra', { views: [{ state: 'frozen', ySplit: 1 }] });
        detail.columns = [
            { header: 'Empleado', key: 'employee', width: 34 },
            { header: 'Categoría', key: 'category', width: 24 },
            { header: 'Obra', key: 'obra', width: 40 },
            { header: 'Código', key: 'code', width: 14 },
            { header: 'Horas', key: 'hours', width: 12, style: { numFmt: '#,##0.00' } }
        ];
        detail.getRow(1).font = { bold: true };
        detail.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

        let grandTotal = 0;
        for (const bucket of byEmployee.values()) {
            for (const row of bucket.rows) {
                detail.addRow({ employee: bucket.employeeName, category: bucket.category, obra: row.name, code: row.code, hours: row.hours });
            }
            const subtotalRow = detail.addRow({ employee: `Subtotal ${bucket.employeeName}`, category: '', obra: '', code: '', hours: bucket.total });
            subtotalRow.font = { bold: true };
            subtotalRow.getCell(5).style.numFmt = '#,##0.00';
            grandTotal += bucket.total;
        }
        const totalRow = detail.addRow({ employee: 'TOTAL', category: '', obra: '', code: '', hours: grandTotal });
        totalRow.font = { bold: true };
        totalRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        totalRow.getCell(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        totalRow.getCell(5).style.numFmt = '#,##0.00';
        totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

        const summary = workbook.addWorksheet('Resumen por obra', { views: [{ state: 'frozen', ySplit: 1 }] });
        summary.columns = [
            { header: 'Obra', key: 'obra', width: 44 },
            { header: 'Código', key: 'code', width: 14 },
            { header: 'Horas', key: 'hours', width: 12, style: { numFmt: '#,##0.00' } },
            { header: '% del total', key: 'pct', width: 12, style: { numFmt: '0.0%' } }
        ];
        summary.getRow(1).font = { bold: true };
        summary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        for (const project of byProject.values()) {
            summary.addRow({ obra: project.name, code: project.code, hours: project.hours, pct: grandTotal > 0 ? project.hours / grandTotal : 0 });
        }

        if (entries.length === 0) {
            detail.addRow({ employee: `Sin horas imputadas a obras en ${periodLabel}.` });
            summary.addRow({ obra: `Sin horas imputadas a obras en ${periodLabel}.` });
        }

        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
        const filename = employeeId
            ? `parte_obras_${year}_${String(month).padStart(2, '0')}_${employeeId.slice(0, 8)}.xlsx`
            : `parte_obras_${year}_${String(month).padStart(2, '0')}.xlsx`;
        return { buffer, filename, employeeCount: byEmployee.size, entryCount: entries.length };
    }
}
