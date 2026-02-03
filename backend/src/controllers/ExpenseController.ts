import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createWorker } from 'tesseract.js';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';

export const ExpenseController = {
    // Procesar OCR para sugerir datos
    processOCR: async (req: Request, res: Response) => {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No se ha subido ningún archivo' });

        try {
            const worker = await createWorker('spa');
            const { data: { text } } = await worker.recognize(file.path);
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
            console.error('Error OCR Gastos:', error);
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
            const expense = await prisma.expense.create({
                data: {
                    employeeId,
                    category,
                    amount: parseFloat(amount),
                    description,
                    date: date ? new Date(date) : new Date(),
                    paymentMethod: paymentMethod || 'CASH',
                    receiptUrl: file ? `/uploads/expenses/${file.filename}` : null,
                    status: 'PENDING'
                }
            });

            res.status(201).json(expense);
        } catch (error) {
            console.error('Error al subir gasto:', error);
            res.status(500).json({ error: 'Error al registrar el gasto' });
        }
    },

    // Obtener gastos de un empleado
    getByEmployee: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        try {
            const expenses = await prisma.expense.findMany({
                where: { employeeId },
                orderBy: { date: 'desc' }
            });
            res.json(expenses);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener gastos' });
        }
    },

    // Obtener todos los gastos (Admin view)
    getAll: async (req: Request, res: Response) => {
        try {
            const expenses = await prisma.expense.findMany({
                include: {
                    employee: {
                        select: { name: true, firstName: true, lastName: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
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
            const expense = await prisma.expense.findUnique({ where: { id } });
            if (!expense) return res.status(404).json({ error: 'Gasto no encontrado' });

            // Eliminar archivo físico si existe
            if (expense.receiptUrl) {
                const filePath = path.join(__dirname, '../../', expense.receiptUrl);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            await prisma.expense.delete({ where: { id } });
            res.json({ message: 'Gasto eliminado' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar gasto' });
        }
    }
};
