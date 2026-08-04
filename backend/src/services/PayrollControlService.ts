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

function calculateDailyEntry(entry: DailyEntryPayload, calendarHolidayName?: string) {
    const entryAt = timeOnDate(entry.workDate, entry.entryTime);
    const breakOutAt = timeOnDate(entry.workDate, entry.breakOutTime);
    const breakInAt = timeOnDate(entry.workDate, entry.breakInTime);
    const exitAt = timeOnDate(entry.workDate, entry.exitTime);
    const hasSplitShift = Boolean(breakOutAt || breakInAt);
    const worked = hasSplitShift
        ? intervalHours(entryAt, breakOutAt).plus(intervalHours(breakInAt, exitAt))
        : intervalHours(entryAt, exitAt);
    const workedHours = worked.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const discountHours = decimal(entry.discountHours).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const scheduledHours = decimal(entry.scheduledHours).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const date = utcDate(entry.workDate);
    const day = date.getUTCDay();
    const holidayOrWeekend = entry.isHoliday || Boolean(calendarHolidayName) || day === 0 || day === 6;
    const netWorked = workedHours.minus(discountHours);
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
    static calculateDailyEntryState(entry: DailyEntryPayload, calendarHolidayName?: string) {
        return calculateDailyEntry(entry, calendarHolidayName);
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
        const tgss = decimal(record.tgss);
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

        try {
            return await prisma.$transaction(async (tx) => {
                const created = await tx.payrollControlPeriod.create({
                    data: { companyId, year, month, status: 'DRAFT', formulaVersion: FORMULA_VERSION }
                });
                if (employees.length > 0) {
                    await tx.payrollControlRecord.createMany({
                        data: employees.map((employee) => ({
                            periodId: created.id,
                            employeeId: employee.id,
                            category: employee.category || 'General',
                            department: employee.department || 'Otros',
                            gestoriaCode: employee.payrollAgencyEmployeeCode || null,
                            overtimeRate: 0,
                            holidayOvertimeRate: 0,
                            overtimeHours: 0,
                            holidayOvertimeHours: 0,
                            irpf: 0,
                            tgss: 0
                        }))
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

    static async getEmployeeRecord(employeeId: string, year: number, month: number) {
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, deletedAt: null },
            select: { companyId: true }
        });
        if (!employee?.companyId) throw new AppError('Empleado sin empresa asignada.', 404);
        const period = await this.getPeriod(employee.companyId, year, month);
        if (!period) return { periodStatus: 'NOT_CREATED', periodId: null, record: null };
        return { periodStatus: period.status, periodId: period.id, record: period.records.find((record) => record.employeeId === employeeId) || null };
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
        userId: string
    ) {
        const record = await prisma.payrollControlRecord.findUnique({ where: { id: recordId }, include: { period: true } });
        if (!record) throw new AppError('Registro de control no encontrado.', 404);
        assertEditable(record.period.status);
        if (record.version !== expectedVersion) throw new AppError('El registro cambió en otra sesión. Recarga antes de guardar.', 409);

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

        await prisma.$transaction(async (tx) => {
            for (const entry of entries) {
                const calculated = this.calculateDailyEntryState(entry, calendarHolidays.get(entry.workDate));
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
            const overtimeHours = dailyEntries.reduce(
                (sum, entry) => sum.plus(Decimal.max(entry.overtimeHours, 0)),
                new Decimal(0)
            ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            const holidayOvertimeHours = dailyEntries.reduce(
                (sum, entry) => sum.plus(entry.holidayOvertimeHours),
                new Decimal(0)
            ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            const diets = dailyEntries.reduce(
                (sum, entry) => sum.plus(entry.dietAmount),
                new Decimal(0)
            ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            const calculatedRecord = this.calculateRecordState({
                ...record,
                overtimeHours,
                holidayOvertimeHours,
                diets
            });
            const updated = await tx.payrollControlRecord.updateMany({
                where: { id: recordId, version: expectedVersion },
                data: {
                    overtimeHours,
                    holidayOvertimeHours,
                    diets,
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
        const updateData: Record<string, unknown> = {};
        const overrides: Array<{ fieldName: string; calculatedValue: string; manualValue: string; previousValue: string; newValue: string; userId: string }> = [];

        for (const [field, value] of Object.entries(input)) {
            if (value === undefined) continue;
            if (manualFields.has(field)) {
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
}
