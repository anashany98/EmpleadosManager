const PDFDocument = require('pdfkit');
import { Response } from 'express';
import path from 'path';

interface PayrollData {
    id: string;
    month: number;
    year: number;
    bruto: number;
    neto: number;
    baseIrpf?: number;
    irpf: number;
    ssEmpresa: number;
    ssTrabajador: number;
    company: {
        name: string;
        cif: string;
        address: string;
        city: string;
        postalCode: string;
    };
    employee: {
        name: string;
        dni: string;
        socialSecurityNumber: string;
        jobTitle: string;
        category?: string;
        seniorityDate?: Date;
    };
    items: {
        concept: string;
        amount: number;
        type: 'EARNING' | 'DEDUCTION';
        units?: number;
        rate?: number;
    }[];
}

export const PayrollPdfService = {
    generate: async (res: Response, data: PayrollData): Promise<Buffer> => {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const buffers: any[] = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            doc.on('error', (err: any) => {
                reject(err);
            });

            // --- Header ---
            // Company Info (Left)
            doc.fontSize(12).font('Helvetica-Bold').text(data.company.name, 50, 50);
            doc.fontSize(10).font('Helvetica').text(`CIF: ${data.company.cif}`, 50, 65);
            doc.text(data.company.address, 50, 80);
            doc.text(`${data.company.postalCode} ${data.company.city}`, 50, 95);

            // Employee Info (Right)
            doc.fontSize(10).font('Helvetica-Bold').text('Datos del Trabajador', 350, 50);
            doc.font('Helvetica').text(`Nombre: ${data.employee.name}`, 350, 65);
            doc.text(`DNI: ${data.employee.dni}`, 350, 80);
            doc.text(`NSS: ${data.employee.socialSecurityNumber}`, 350, 95);
            doc.text(`Categoría: ${data.employee.category || 'N/A'}`, 350, 110);
            if (data.employee.seniorityDate) {
                const seniority = new Date(data.employee.seniorityDate).toLocaleDateString();
                doc.text(`Antigüedad: ${seniority}`, 350, 125);
            }

            // Period Info (Centered Box)
            doc.rect(50, 150, 500, 30).stroke();
            doc.fontSize(12).font('Helvetica-Bold');
            const periodText = `Nómina: ${new Date(2000, data.month - 1).toLocaleString('es-ES', { month: 'long' }).toUpperCase()} ${data.year}`;
            doc.text(periodText, 50, 160, { align: 'center', width: 500 });

            // --- Body: Earnings and Deductions ---
            let currentY = 210;
            const PAGE_BOTTOM_LIMIT = 700;
            const MARGIN_TOP = 50;

            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Concepto', 50, currentY);
            doc.text('Devengos', 350, currentY, { align: 'right', width: 60 });
            doc.text('Deducciones', 450, currentY, { align: 'right', width: 60 });

            // Line
            currentY += 15;
            doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
            currentY += 10;

            doc.font('Helvetica');
            let totalDevengos = 0;
            let totalDeducciones = 0;

            // If no items, simulate standard structure based on Bruto/Neto
            const itemsToRender: PayrollData['items'] = data.items.length > 0 ? data.items : [
                { concept: 'Salario Base', amount: data.bruto * 0.7, type: 'EARNING' },
                { concept: 'Plus Convenio', amount: data.bruto * 0.2, type: 'EARNING' },
                { concept: 'Prorrata Pagas', amount: data.bruto * 0.1, type: 'EARNING' },
                { concept: 'Cotización SS', amount: data.ssTrabajador, type: 'DEDUCTION' },
                { concept: 'Retención IRPF', amount: data.irpf, type: 'DEDUCTION' }
            ];

            const checkPageBreak = () => {
                if (currentY > PAGE_BOTTOM_LIMIT) {
                    doc.addPage();
                    currentY = MARGIN_TOP;
                    // Re-draw headers for continuity
                    doc.fontSize(10).font('Helvetica-Bold');
                    doc.text('Concepto', 50, currentY);
                    doc.text('Devengos', 350, currentY, { align: 'right', width: 60 });
                    doc.text('Deducciones', 450, currentY, { align: 'right', width: 60 });
                    currentY += 15;
                    doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
                    currentY += 10;
                    doc.font('Helvetica');
                }
            };

            itemsToRender.forEach((item: any) => {
                checkPageBreak();

                doc.text(item.concept, 50, currentY);

                if (item.type === 'EARNING') {
                    doc.text(item.amount.toFixed(2) + ' €', 350, currentY, { align: 'right', width: 60 });
                    totalDevengos += item.amount;
                } else {
                    doc.text(item.amount.toFixed(2) + ' €', 450, currentY, { align: 'right', width: 60 });
                    totalDeducciones += item.amount;
                }
                currentY += 15;
            });

            // Ensure space for totals (approx 100px needed)
            if (currentY + 100 > PAGE_BOTTOM_LIMIT) {
                doc.addPage();
                currentY = MARGIN_TOP;
            }

            // --- Footer: Totals ---
            currentY += 20;
            doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
            currentY += 10;

            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('TOTALES', 50, currentY);
            doc.text(Math.abs(totalDevengos).toFixed(2) + ' €', 350, currentY, { align: 'right', width: 60 });
            doc.text(Math.abs(totalDeducciones).toFixed(2) + ' €', 450, currentY, { align: 'right', width: 60 });

            // Net to Pay
            currentY += 30;
            doc.rect(350, currentY, 180, 30).fillAndStroke('#f0f0f0', '#000000');
            doc.fillColor('black');
            doc.fontSize(12).text('LÍQUIDO A PERCIBIR', 360, currentY + 8);
            doc.fontSize(12).text(data.neto.toFixed(2) + ' €', 480, currentY + 8, { align: 'right', width: 40 });

            // Footer signature (on every page? or just the last? Currently hardcoded to 750)
            // Ideally, we put it at the bottom of the current page if it fits, or fixed at bottom
            // But since we are paginating, let's put it at the bottom of the *current* page relative to the margin,
            // or fixed 750 if likely A4.
            // Let's just keep it simple: Add it to the page where totals ended.
            // If currentY is deep down, we might be close to 750.

            const footerY = 750;
            if (currentY > footerY - 20) {
                // if we are past the footer area, add page
                doc.addPage();
            }
            doc.fontSize(8).text('Documento generado automáticamente por NominasApp', 50, footerY, { align: 'center', color: 'grey' });

            doc.end();
        });
    }
};

function formatMoney(amount: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}
