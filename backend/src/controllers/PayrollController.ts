import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ExcelParser } from '../services/ExcelParser';
import { MappingService } from '../services/MappingService';
import fs from 'fs';


export const PayrollController = {
    // 1. Subir archivo
    upload: async (req: Request, res: Response) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo' });
        }

        try {
            // Leemos buffer para sacar headers de forma asíncrona
            const buffer = await fs.promises.readFile(req.file.path);
            const headers = ExcelParser.getHeaders(buffer);

            // Crear el Batch
            const batch = await prisma.payrollImportBatch.create({
                data: {
                    year: new Date().getFullYear(), // Default, luego se edita
                    month: new Date().getMonth() + 1,
                    sourceFilename: req.file.originalname,
                    createdById: 'temp-user-id', // TODO: Auth
                    status: 'UPLOADED'
                }
            });

            // Guardamos path temporal o contenido si fuera necesario. 
            // Por simplicidad, asumimos que el archivo se queda en uploads/ y lo referenciamos o re-leemos.
            // En prod, mejor guardar en storage seguro.

            res.json({
                batchId: batch.id,
                headers,
                filename: req.file.filename,
                message: 'Archivo subido correctamente. Por favor configura el mapeo.'
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al procesar el archivo Excel' });
        }
    },

    // 2. Aplicar Mapeo y generar rows
    applyMapping: async (req: Request, res: Response) => {
        const { id } = req.params; // Batch ID
        const { mappingRules, filename } = req.body; // Rules { "neto": "Importe Neto" } y el nombre físico temp

        try {
            // Re-leer archivo (Deberíamos guardar el path en BD, aquí lo pasamos por body para simplificar demo)
            // OJO: En app real, buscar path por batchId. Asumimos que está en 'uploads/' + filename
            const filePath = `uploads/${filename}`;

            try {
                await fs.promises.access(filePath);
            } catch {
                return res.status(404).json({ error: 'El archivo original ha caducado o no existe' });
            }

            const buffer = await fs.promises.readFile(filePath);
            const rawData = ExcelParser.parseBuffer(buffer);

            // Transformar
            const rowsData = MappingService.applyMapping(rawData, mappingRules, id);

            // Guardar en BD (Transactions idealmente)
            // Borramos anteriores si re-mapeamos
            await prisma.payrollRow.deleteMany({ where: { batchId: id } });

            const createdRows = await prisma.payrollRow.createMany({
                data: rowsData as any // Typescript mismatch con Decimal a veces, cast any
            });

            await prisma.payrollImportBatch.update({
                where: { id },
                data: { status: 'MAPPED' }
            });

            res.json({
                message: 'Mapeo aplicado correctamente',
                rowsCreated: createdRows.count
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al aplicar el mapeo' });
        }
    },

    // Obtener filas de un lote con paginación
    getRows: async (req: Request, res: Response) => {
        const { id } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;

        try {
            const [rows, total] = await prisma.$transaction([
                prisma.payrollRow.findMany({
                    where: { batchId: id },
                    skip,
                    take: limit,
                    orderBy: { id: 'asc' } // Ensure deterministic ordering
                }),
                prisma.payrollRow.count({ where: { batchId: id } })
            ]);

            res.json({
                data: rows,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error("Error fetching rows:", error);
            res.status(500).json({ error: 'Error al obtener filas' });
        }
    }
};
