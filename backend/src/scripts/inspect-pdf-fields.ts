
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function inspectFields() {
    const templatePath = path.join(__dirname, '../templates/modelo145.pdf');

    if (!fs.existsSync(templatePath)) {
        console.error('Template not found');
        return;
    }

    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    const lines = fields.map(f => `${f.getName()} (${f.constructor.name})`);
    fs.writeFileSync('fields_utf8.txt', lines.join('\n'), 'utf-8');
    console.log('Wrote fields to fields_utf8.txt');
}

inspectFields().catch(console.error);
