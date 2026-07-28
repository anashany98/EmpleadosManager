import PDFDocument from 'pdfkit';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { AuditService } from './AuditService';
import { OBRA_TYPE_LABELS, type ObraExpenseType } from '../../../shared/obras';
import { CompanyDocumentTemplateService } from './documents/DocumentTemplateService';

type ReceiptExpense = Awaited<ReturnType<typeof loadExpenses>>[number];

const formatDate = (value: Date) => new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
}).format(value);

const safeFilename = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'empleado';

const employeeName = (expense: ReceiptExpense) =>
    expense.employee?.name
    || `${expense.employee?.firstName || ''} ${expense.employee?.lastName || ''}`.trim()
    || 'Empleado';

const loadExpenses = async (expenseIds: string[]) => prisma.obraExpense.findMany({
    where: { id: { in: expenseIds } },
    include: {
        obra: { select: { id: true, code: true, name: true, destination: true } },
        employee: {
            select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                dni: true,
                company: { select: { id: true, name: true } }
            }
        }
    }
});

const buildReceiptPdf = (expense: ReceiptExpense, issuedAt: Date): Promise<Buffer> => new Promise((resolve, reject) => {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 78, right: 72, bottom: 72, left: 72 },
        info: {
            Title: `Recibí - ${employeeName(expense)}`,
            Subject: 'Justificante de gasto de obra',
            Author: expense.employee?.company?.name || 'EmpleadosManager'
        }
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const companyName = expense.employee?.company?.name || 'la empresa';
    const category = OBRA_TYPE_LABELS[expense.type as ObraExpenseType] || expense.type;
    const startDate = expense.date;
    const endDate = expense.endDate || expense.date;
    const amount = Number(expense.amount).toLocaleString('es-ES', {
        style: 'currency',
        currency: expense.currency || 'EUR'
    });

    doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text('RECIBÍ');
    doc.moveDown(0.55);
    doc.font('Helvetica').fontSize(12).fillColor('#334155')
        .text(`Emitido en ${formatDate(issuedAt)}`);

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(13).fillColor('#0f172a')
        .text(`Yo, ${employeeName(expense)}, con DNI/NIE ${expense.employee?.dni || 'no informado'}, declaro haber recibido de ${companyName} la cantidad de ${amount}.`, {
            lineGap: 5,
            align: 'justify'
        });

    doc.moveDown(1.4);
    const rows: Array<[string, string]> = [
        ['Concepto', category],
        ['Periodo', startDate.toDateString() === endDate.toDateString()
            ? formatDate(startDate)
            : `${formatDate(startDate)} - ${formatDate(endDate)}`],
        ['Obra', `${expense.obra.code} - ${expense.obra.name}`],
        ['Destino', expense.obra.destination || expense.destination || 'No indicado'],
        ['Importe', amount]
    ];
    if (expense.type === 'PER_DIEM' && expense.unitAmount) {
        rows.splice(4, 0,
            ['Importe diario', Number(expense.unitAmount).toLocaleString('es-ES', {
                style: 'currency',
                currency: expense.currency || 'EUR'
            })],
            ['Número de días', String(expense.unitCount || 1)]
        );
    }
    if (expense.description) rows.push(['Detalle', expense.description]);

    const tableTop = doc.y;
    rows.forEach(([label, value], index) => {
        const y = tableTop + index * 34;
        doc.roundedRect(72, y, 451, 28, 4)
            .fill(index % 2 === 0 ? '#f8fafc' : '#ffffff');
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#475569').text(label.toUpperCase(), 84, y + 9, { width: 105 });
        doc.font('Helvetica').fontSize(11).fillColor('#0f172a').text(value, 190, y + 8, { width: 320 });
    });

    doc.y = tableTop + rows.length * 34 + 52;
    doc.font('Helvetica').fontSize(11).fillColor('#475569').text('Firma del trabajador:');
    doc.moveDown(3.6);
    doc.strokeColor('#94a3b8').lineWidth(0.8).moveTo(72, doc.y).lineTo(300, doc.y).stroke();
    doc.moveDown(0.6);
    doc.fontSize(9).fillColor('#64748b').text(employeeName(expense));
    doc.text(`DNI/NIE: ${expense.employee?.dni || 'No informado'}`);

    doc.fontSize(8).fillColor('#94a3b8')
        .text(`Documento generado por EmpleadosManager el ${formatDate(issuedAt)} · Gasto ${expense.id}`, 72, 785, {
            width: 451,
            align: 'center'
        });
    doc.end();
});

const buildConfiguredReceiptPdf = async (expense: ReceiptExpense, issuedAt: Date): Promise<Buffer> => {
    const companyId = expense.employee?.company?.id || null;
    const configuredTemplate = await CompanyDocumentTemplateService.getStoredTemplate('OBRA_EXPENSE_RECEIPT', companyId);
    if (!configuredTemplate) return buildReceiptPdf(expense, issuedAt);

    const currency = expense.currency || 'EUR';
    const money = (value: unknown) => Number(value || 0).toLocaleString('es-ES', { style: 'currency', currency });
    const endDate = expense.endDate || expense.date;
    const context = {
        empresa: { nombre: expense.employee?.company?.name || '' },
        empleado: {
            nombreCompleto: employeeName(expense),
            dni: expense.employee?.dni || ''
        },
        obra: {
            codigo: expense.obra.code,
            nombre: expense.obra.name,
            destino: expense.destination || expense.obra.destination || ''
        },
        gasto: {
            concepto: OBRA_TYPE_LABELS[expense.type as ObraExpenseType] || expense.type,
            fechaInicio: formatDate(expense.date),
            fechaFin: formatDate(endDate),
            importeDiario: expense.unitAmount ? money(expense.unitAmount) : '',
            dias: expense.unitCount || 1,
            importeTotal: money(expense.amount),
            detalle: expense.description || ''
        },
        firma: { fecha: formatDate(issuedAt) }
    };
    const rendered = await CompanyDocumentTemplateService.renderPdfFromTemplate({
        type: 'OBRA_EXPENSE_RECEIPT',
        companyId,
        employeeId: expense.employee?.id || expense.employeeId || expense.id,
        context
    });
    return rendered.buffer;
};

const zipDocuments = async (documents: Array<{ filename: string; buffer: Buffer }>): Promise<Buffer> => {
    const output = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    output.on('data', (chunk: Buffer) => chunks.push(chunk));

    const completed = new Promise<Buffer>((resolve, reject) => {
        output.on('end', () => resolve(Buffer.concat(chunks)));
        output.on('error', reject);
        archive.on('error', reject);
    });

    archive.pipe(output);
    documents.forEach((document) => archive.append(document.buffer, { name: document.filename }));
    await archive.finalize();
    return completed;
};

export const ObraExpenseReceiptService = {
    async generate(expenseIds: string[], userId: string) {
        const uniqueIds = Array.from(new Set(expenseIds));
        const expenses = await loadExpenses(uniqueIds);
        if (expenses.length !== uniqueIds.length) {
            throw new AppError('Uno o varios gastos no existen', 404);
        }
        if (expenses.some((expense) => !expense.employee)) {
            throw new AppError('Todos los gastos seleccionados deben tener un empleado asignado', 400);
        }

        const issuedAt = new Date();
        const documents = await Promise.all(expenses.map(async (expense, index) => ({
            filename: `recibi-${safeFilename(employeeName(expense))}-${expense.obra.code}-${index + 1}.pdf`,
            buffer: await buildConfiguredReceiptPdf(expense, issuedAt)
        })));

        await Promise.all(expenses.map((expense) => AuditService.log(
            'GENERATE_DOCUMENT',
            'OBRA_EXPENSE',
            expense.id,
            {
                documentType: 'OBRA_EXPENSE_RECEIPT',
                employeeId: expense.employeeId,
                obraId: expense.obraId,
                amount: Number(expense.amount),
                issuedAt: issuedAt.toISOString()
            },
            userId,
            expense.employeeId || undefined
        )));

        if (documents.length === 1) {
            return {
                buffer: documents[0].buffer,
                contentType: 'application/pdf',
                filename: documents[0].filename
            };
        }

        return {
            buffer: await zipDocuments(documents),
            contentType: 'application/zip',
            filename: `recibis-gastos-${issuedAt.toISOString().slice(0, 10)}.zip`
        };
    }
};

export { buildReceiptPdf };
