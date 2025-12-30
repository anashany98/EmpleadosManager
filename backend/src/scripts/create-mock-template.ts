
import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function createMockTemplate() {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);

    const form = pdfDoc.getForm();

    page.drawText('MODELO 145 OFFICIAL MOCK', { x: 50, y: 750, size: 24, color: rgb(0, 0, 0) });

    page.drawText('DNI:', { x: 50, y: 700 });
    const dniField = form.createTextField('txtNIF');
    dniField.setText('PLACEHOLDER');
    dniField.addToPage(page, { x: 100, y: 700, width: 150, height: 20 });

    page.drawText('Nombre:', { x: 50, y: 650 });
    const nameField = form.createTextField('txtNombre');
    nameField.setText('');
    nameField.addToPage(page, { x: 100, y: 650, width: 300, height: 20 });

    page.drawText('Año:', { x: 50, y: 600 });
    const yearField = form.createTextField('txtAno');
    yearField.setText('');
    yearField.addToPage(page, { x: 100, y: 600, width: 50, height: 20 });

    const templatesDir = path.join(__dirname, '../templates');
    if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir);
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(path.join(templatesDir, 'modelo145.pdf'), pdfBytes);
    console.log('Mock template created at:', path.join(templatesDir, 'modelo145.pdf'));
}

createMockTemplate().catch(console.error);
