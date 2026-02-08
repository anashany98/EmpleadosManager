import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { createLogger } from '../services/LoggerService';

const log = createLogger('OvertimeController');

function parseHours(value: any): number {
    if (typeof value === 'number') return value * 24; // Excel stores time as fraction of day (0.5 = 12h)
    if (typeof value === 'string') {
        if (value.includes(':')) {
            const parts = value.split(':');
            const h = parseInt(parts[0], 10) || 0;
            const m = parseInt(parts[1], 10) || 0;
            return h + (m / 60);
        }
        return parseFloat(value) || 0;
    }
    return 0;
}

const SPAIN_HOLIDAYS_2025 = [
    '2025-01-01', '2025-01-06', '2025-04-17', '2025-04-18',
    '2025-05-01', '2025-08-15', '2025-10-12', '2025-11-01',
    '2025-12-06', '2025-12-08', '2025-12-25'
];

function isHoliday(date: Date): boolean {
    const day = date.getDay();
    if (day === 0 || day === 6) return true; // Sábado o Domingo

    const dateStr = date.toISOString().split('T')[0];
    return SPAIN_HOLIDAYS_2025.includes(dateStr);
}

export const RateController = {
    getAll: async (req: Request, res: Response) => {
        try {
            const rates = await prisma.categoryRate.findMany({
                orderBy: { category: 'asc' }
            });
            res.json(rates);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener tarifas' });
        }
    },

    update: async (req: Request, res: Response) => {
        const { category, overtimeRate, holidayOvertimeRate } = req.body;
        try {
            const rate = await prisma.categoryRate.upsert({
                where: { category },
                update: { overtimeRate, holidayOvertimeRate },
                create: { category, overtimeRate, holidayOvertimeRate }
            });
            res.json(rate);
        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar tarifa' });
        }
    }
};

export const OvertimeController = {
    getByEmployee: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        try {
            const entries = await prisma.overtimeEntry.findMany({
                where: { employeeId },
                orderBy: { date: 'desc' }
            });
            res.json(entries);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener horas extras' });
        }
    },

    create: async (req: Request, res: Response) => {
        const { employeeId, hours, rate, date } = req.body;
        try {
            const total = hours * rate;
            const entry = await prisma.overtimeEntry.create({
                data: {
                    employeeId,
                    hours,
                    rate,
                    total,
                    date: date ? new Date(date) : new Date()
                }
            });
            res.status(201).json(entry);
        } catch (error) {
            res.status(500).json({ error: 'Error al registrar horas extras' });
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            await prisma.overtimeEntry.delete({ where: { id } });
            return ApiResponse.success(res, null, 'Entrada de horas extras eliminada');
        } catch (error) {
            throw new AppError('Error al eliminar horas extras', 500);
        }
    },

    updateStatus: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { status } = req.body;

        if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
            throw new AppError('Estado no válido', 400);
        }

        try {
            const entry = await prisma.overtimeEntry.update({
                where: { id },
                data: { status }
            });
            return ApiResponse.success(res, entry, 'Estado de horas extras actualizado');
        } catch (error) {
            throw new AppError('Error al actualizar el estado de las horas extras', 500);
        }
    },
    importOvertime: async (req: Request, res: Response) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo' });
        }

        try {
            const XLSX = require('xlsx');
            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(sheet);

            let importedCount = 0;
            const errors: string[] = [];
            const skipped: string[] = [];

            log.info({ count: data.length }, 'Processing Excel rows');

            // Log columnas disponibles para debugging
            if (data.length > 0) {
                const columns = Object.keys(data[0]);
                log.debug({ columns }, 'Excel columns found');
            }

            const rates = await prisma.categoryRate.findMany();
            const ratesMap = new Map<string, { normal: number, holiday: number }>(
                rates.map((r: any) => [r.category, { normal: r.overtimeRate, holiday: r.holidayOvertimeRate }] as [string, any])
            );

            let rowIndex = 0;
            for (const row of data as any[]) {
                rowIndex++;
                const dni = String(row['DNI'] || '').trim();
                const nombreRaw = row['Nombre'];
                const fechaRaw = row['Fecha'];
                const extrRaw = row['Extr'];

                // Saltar filas sin datos relevantes (ni fichaje ni horas extras)
                if (!dni || !fechaRaw) {
                    skipped.push(`Fila ${rowIndex}: Sin datos válidos(DNI: ${dni || 'vacío'})`);
                    continue;
                }

                try {
                    const employee = await prisma.employee.findUnique({
                        where: { dni }
                    });

                    if (!employee) {
                        errors.push(`Fila ${rowIndex}: Empleado ${nombreRaw || dni} no encontrado en BD`);
                        log.warn({ dni, rowIndex }, 'DNI not found');
                        continue;
                    }

                    const hours = parseHours(extrRaw);
                    if (hours <= 0) {
                        skipped.push(`Fila ${rowIndex}: Horas inválidas(${extrRaw})`);
                        continue;
                    }

                    const ratesInfo = ratesMap.get(employee.category || '');
                    const rateNormal = ratesInfo?.normal || 0;
                    const rateHoliday = ratesInfo?.holiday || 0;

                    let date: Date;
                    if (typeof fechaRaw === 'number') {
                        // Excel date (serial number)
                        date = new Date(Math.round(((fechaRaw as number) - 25569) * 86400 * 1000));
                    } else if (typeof fechaRaw === 'string') {
                        const parts = fechaRaw.split('/');
                        if (parts.length === 3) {
                            const [d, m, y] = parts.map(Number);
                            date = new Date(y, m - 1, d);
                        } else {
                            throw new Error(`Formato de fecha inválido: ${fechaRaw} `);
                        }
                    } else {
                        date = new Date(fechaRaw);
                    }

                    if (isNaN(date.getTime())) {
                        errors.push(`Fila ${rowIndex}: Fecha inválida(${fechaRaw})`);
                        continue;
                    }

                    // Normalizar fecha (solo día, sin hora)
                    const normalizedDate = new Date(date);
                    normalizedDate.setHours(0, 0, 0, 0);

                    // Crear TimeEntry con los datos de fichaje
                    const parseTimeToDate = (dateBase: Date, timeStr: any): Date | null => {
                        if (!timeStr) return null;
                        if (typeof timeStr === 'number') {
                            // Excel time (fraction of day)
                            const hours = Math.floor(timeStr * 24);
                            const minutes = Math.floor((timeStr * 24 * 60) % 60);
                            const result = new Date(dateBase);
                            result.setHours(hours, minutes, 0, 0);
                            return result;
                        }
                        if (typeof timeStr === 'string' && timeStr.includes(':')) {
                            const [h, m] = timeStr.split(':').map(Number);
                            const result = new Date(dateBase);
                            result.setHours(h, m, 0, 0);
                            return result;
                        }
                        return null;
                    };

                    // Intentar detectar si hay horario partido o simple (case-insensitive)
                    const getColumn = (name: string) => {
                        const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
                        return key ? row[key] : undefined;
                    };

                    const entrada1Raw = getColumn('Entrada1') || getColumn('Entrada') || getColumn('Entrada_1');
                    const salida1Raw = getColumn('Salida1') || getColumn('Salida') || getColumn('Salida_1');
                    const entrada2Raw = getColumn('Entrada2') || getColumn('Entrada_2');
                    const salida2Raw = getColumn('Salida2') || getColumn('Salida_') || getColumn('Salida_2');
                    const pausaRaw = getColumn('Pausa');
                    const presRaw = getColumn('Pres'); // Horas de presencia ya calculadas en el Excel

                    log.debug({ rowIndex, entrada1Raw, salida1Raw, entrada2Raw, salida2Raw, presRaw, pausaRaw }, 'Raw row data');

                    if (entrada1Raw || salida1Raw || presRaw) {
                        const checkIn = parseTimeToDate(date, entrada1Raw);
                        const checkOut = parseTimeToDate(date, salida2Raw || salida1Raw); // Usar salida2 si existe, sino salida1
                        const lunchStart = parseTimeToDate(date, salida1Raw); // Primera salida = inicio pausa
                        const lunchEnd = parseTimeToDate(date, entrada2Raw); // Segunda entrada = fin pausa

                        // Calcular horas trabajadas
                        let totalHours = 0;
                        let lunchHours = 0;

                        // PRIORIDAD 1: Usar la columna "Pres" si existe (ya está calculado correctamente)
                        if (presRaw) {
                            if (typeof presRaw === 'number') {
                                totalHours = presRaw * 24; // Excel guarda tiempos como fracción de día
                            } else if (typeof presRaw === 'string' && presRaw.includes(':')) {
                                const [h, m] = presRaw.split(':').map(Number);
                                totalHours = h + (m / 60);
                            }
                        } else if (checkIn && checkOut) {
                            // PRIORIDAD 2: Calcular manualmente si no hay Pres
                            const grossHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

                            // Si hay pausa como columna numérica, usarla
                            if (pausaRaw && typeof pausaRaw === 'number') {
                                lunchHours = pausaRaw * 24; // Excel guarda tiempos como fracción de día
                            } else if (pausaRaw && typeof pausaRaw === 'string' && pausaRaw.includes(':')) {
                                const [h, m] = pausaRaw.split(':').map(Number);
                                lunchHours = h + (m / 60);
                            } else if (lunchStart && lunchEnd) {
                                // Calcular pausa desde las horas de entrada/salida
                                lunchHours = (lunchEnd.getTime() - lunchStart.getTime()) / (1000 * 60 * 60);
                            }

                            totalHours = Math.max(0, grossHours - lunchHours);
                        }

                        log.debug({ rowIndex, totalHours: totalHours.toFixed(2), source: presRaw ? 'Pres column' : 'Calculated' }, 'Hours calculated');

                        // Sincronizar con el nuevo sistema de fichajes (TimeEntry)
                        // Primero limpiamos posibles registros previos para este día para evitar duplicados en re-importaciones
                        const startOfDay = new Date(date);
                        startOfDay.setHours(0, 0, 0, 0);
                        const endOfDay = new Date(date);
                        endOfDay.setHours(23, 59, 59, 999);

                        await prisma.timeEntry.deleteMany({
                            where: {
                                employeeId: employee.id,
                                timestamp: {
                                    gte: startOfDay,
                                    lte: endOfDay
                                }
                            }
                        });

                        // Crear registros de fichaje basados en las horas importadas
                        const entriesToCreate = [];

                        if (checkIn) {
                            entriesToCreate.push({
                                employeeId: employee.id,
                                type: 'IN',
                                timestamp: checkIn,
                                location: 'Importado (Excel)',
                                device: 'System Import'
                            });
                        }

                        if (entrada2Raw && lunchStart && lunchEnd) {
                            // Si hubo pausa partida
                            entriesToCreate.push({
                                employeeId: employee.id,
                                type: 'LUNCH_START',
                                timestamp: lunchStart,
                                location: 'Importado (Excel)',
                                device: 'System Import'
                            });
                            entriesToCreate.push({
                                employeeId: employee.id,
                                type: 'LUNCH_END',
                                timestamp: lunchEnd,
                                location: 'Importado (Excel)',
                                device: 'System Import'
                            });
                        }

                        if (checkOut) {
                            entriesToCreate.push({
                                employeeId: employee.id,
                                type: 'OUT',
                                timestamp: checkOut,
                                location: 'Importado (Excel)',
                                device: 'System Import'
                            });
                        }

                        if (entriesToCreate.length > 0) {
                            await prisma.timeEntry.createMany({
                                data: entriesToCreate
                            });
                        }
                    }

                    // Crear OvertimeEntry solo si hay horas extras
                    if (extrRaw && extrRaw !== "0:00" && extrRaw !== 0) {
                        const hours = parseHours(extrRaw);
                        if (hours > 0) {
                            const isHolidayDay = isHoliday(date);
                            const appliedRate = isHolidayDay ? rateHoliday : rateNormal;

                            await prisma.overtimeEntry.create({
                                data: {
                                    employeeId: employee.id,
                                    hours,
                                    rate: appliedRate,
                                    total: Number((hours * appliedRate).toFixed(2)),
                                    date
                                }
                            });
                        }
                    }

                    importedCount++;
                    log.debug({ rowIndex, employeeName: employee.name }, 'Row processed');
                } catch (e: any) {
                    const errorMsg = `Fila ${rowIndex} (DNI ${dni}): ${e.message || e} `;
                    errors.push(errorMsg);
                    log.error({ rowIndex, dni, error: e.message || e }, 'Row processing failed');
                }
            }

            log.info({ imported: importedCount, errors: errors.length, skipped: skipped.length }, 'Import summary');

            res.json({
                message: `Importación completada.${importedCount} registros añadidos.`,
                imported: importedCount,
                errors,
                skipped
            });
        } catch (error: any) {
            log.error({ error }, 'Fatal import error');
            res.status(500).json({ error: `Error procesando el archivo: ${error.message} ` });
        }
    }
};
