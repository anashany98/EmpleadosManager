import { Request, Response } from 'express';
import { createWorker } from 'tesseract.js';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { StorageService } from '../services/StorageService';
import { AnomalyService } from '../services/AnomalyService';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';

const log = createLogger('ExpenseController');

export const ExpenseController = {
    // Procesar OCR para sugerir datos
    processOCR: async (req: Request, res: Response) => {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No se ha subido ningún archivo' });

        try {
            const worker = await createWorker('spa');
            const { data: { text } } = await worker.recognize(file.buffer);
            await worker.terminate();

            // Limpieza básica del texto OCR para mejorar la detección
            const cleanText = text.replace(/\s+/g, ' ').toLowerCase();

            // 1. Buscar importes Mejorado
            // Busca números que sigan a palabras clave, manejando puntos y comas
            const amountRegex = /(?:total|importe|eur|€|sum|pagar)\s*[:=]?\s*(\d+(?:[.,]\d{2})?)/gi;
            const amounts: number[] = [];
            let match;
            while ((match = amountRegex.exec(cleanText)) !== null) {
                let val = match[1].replace(',', '.');
                amounts.push(parseFloat(val));
            }

            // Si no hay totales claros, buscar cualquier número que parezca un precio al final del texto
            if (amounts.length === 0) {
                const priceRegex = /(\d+[.,]\d{2})(?!\d)/g;
                const allPrices = cleanText.match(priceRegex);
                if (allPrices) {
                    allPrices.forEach((p: string) => amounts.push(parseFloat(p.replace(',', '.'))));
                }
            }

            const suggestedAmount = amounts.length > 0 ? Math.max(...amounts) : null;

            // 2. Buscar fechas Mejorado
            // Soporta dd/mm/yyyy, dd-mm-yyyy, y formatos con espacios o puntos
            const dateRegex = /(\d{1,2})[\/\-\. ](\d{1,2})[\/\-\. ](\d{4}|\d{2})/;
            const dateMatch = cleanText.match(dateRegex);
            let suggestedDate = null;
            if (dateMatch) {
                const day = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]);
                let year = parseInt(dateMatch[3]);

                if (year < 100) year += 2000;

                // Validar que sea una fecha razonable
                if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                    suggestedDate = new Date(year, month - 1, day).toISOString().split('T')[0];
                }
            }

            return ApiResponse.success(res, {
                text: text.substring(0, 500),
                suggestedAmount,
                suggestedDate
            }, 'OCR de recibo completado');
        } catch (error) {
            log.error({ error }, 'Error OCR Gastos');
            throw new AppError('Error al procesar el recibo mediante OCR', 500);
        }
    },

    // Subir un gasto con recibo
    upload: async (req: Request, res: Response) => {
        const { employeeId, category, amount, description, date, paymentMethod } = req.body;
        const file = req.file;

        if (!employeeId || !category || !amount) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

        try {
            const { user } = req as AuthenticatedRequest;
            if (user.role !== 'admin' && user.employeeId !== employeeId) {
                return res.status(403).json({ error: 'No autorizado' });
            }
            const safeEmployeeId = String(employeeId).replace(/[^a-zA-Z0-9-]/g, '');
            if (safeEmployeeId !== employeeId) {
                return res.status(400).json({ error: 'employeeId inválido' });
            }

            let receiptKey: string | null = null;
            if (file) {
                const { key } = await StorageService.saveBuffer({
                    folder: `expenses/EXP_${safeEmployeeId}`,
                    originalName: file.originalname,
                    buffer: file.buffer,
                    contentType: file.mimetype
                });
                receiptKey = key;
            }
            const parsedAmount = parseFloat(amount);
            if (Number.isNaN(parsedAmount)) {
                return res.status(400).json({ error: 'Importe inválido' });
            }

            // Verify employee belongs to company
            if (user.companyId && user.role === 'admin') {
                const targetEmployee = await prisma.employee.findUnique({
                    where: { id: employeeId },
                    select: { companyId: true }
                });
                if (!targetEmployee || targetEmployee.companyId !== user.companyId) {
                    return res.status(403).json({ error: 'No autorizado para añadir gastos a este empleado' });
                }
            }

            const expense = await prisma.expense.create({
                data: {
                    employeeId,
                    category,
                    amount: parsedAmount,
                    description,
                    date: date ? new Date(date) : new Date(),
                    paymentMethod: paymentMethod || 'CASH',
                    receiptUrl: receiptKey,
                    status: 'PENDING'
                }
            });

            AnomalyService.detectExpense(expense).catch(err => log.error({ err }, 'Anomaly expense detection failed'));

            res.status(201).json(expense);
        } catch (error) {
            log.error({ error }, 'Error al subir gasto');
            res.status(500).json({ error: 'Error al registrar el gasto' });
        }
    },

    // Obtener gastos de un empleado
    getByEmployee: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const isPaginationRequested = req.query.page !== undefined;
            const skip = (page - 1) * limit;
            const take = isPaginationRequested ? limit : 500;

            const expenses = await prisma.expense.findMany({
                where: { employeeId },
                orderBy: { date: 'desc' },
                skip: isPaginationRequested ? skip : undefined,
                take
            });
            res.json(expenses);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener gastos' });
        }
    },

    // Obtener todos los gastos (Admin view)
    getAll: async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const isPaginationRequested = req.query.page !== undefined;
            const skip = (page - 1) * limit;
            const take = isPaginationRequested ? limit : 500;

            const { user } = req as AuthenticatedRequest;
            const where: any = {};
            if (user.companyId) {
                where.employee = { companyId: user.companyId };
            }

            const expenses = await prisma.expense.findMany({
                where,
                include: {
                    employee: {
                        select: { name: true, firstName: true, lastName: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: isPaginationRequested ? skip : undefined,
                take
            });
            res.json(expenses);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener todos los gastos' });
        }
    },

    // Actualizar estado (Aprobar/Rechazar)
    updateStatus: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { status } = req.body;

        if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ error: 'Estado no válido' });
        }

        try {
            const expense = await prisma.expense.update({
                where: { id },
                data: { status }
            });
            res.json(expense);
        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar el estado' });
        }
    },

    // Eliminar un gasto
    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const { user } = req as AuthenticatedRequest;
            const expense = await prisma.expense.findUnique({ where: { id } });
            if (!expense) return res.status(404).json({ error: 'Gasto no encontrado' });
            if (user.role !== 'admin' && user.employeeId !== expense.employeeId) {
                return res.status(403).json({ error: 'No autorizado' });
            }

            // Eliminar archivo físico / S3 si existe
            if (expense.receiptUrl) {
                await StorageService.deleteFile(expense.receiptUrl);
            }

            await prisma.expense.delete({ where: { id } });
            res.json({ message: 'Gasto eliminado' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar gasto' });
        }
    },

    // Descargar recibo
    getReceipt: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const expense = await prisma.expense.findUnique({ where: { id } });
            if (!expense || !expense.receiptUrl) return res.status(404).json({ error: 'Recibo no encontrado' });

            if (user.role !== 'admin' && user.employeeId !== expense.employeeId) {
                return res.status(403).json({ error: 'No autorizado' });
            }

            if (StorageService.provider === 'local') {
                const fs = require('fs');
                const path = require('path');
                const filePath = path.join(process.cwd(), 'uploads', expense.receiptUrl);
                if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });
                return res.download(filePath);
            }

            const signedUrl = await StorageService.getSignedDownloadUrl(expense.receiptUrl);
            if (!signedUrl) return res.status(500).json({ error: 'No se pudo generar URL' });
            return res.redirect(signedUrl);
        } catch (error) {
            return res.status(500).json({ error: 'Error al obtener recibo' });
        }
    }
};
