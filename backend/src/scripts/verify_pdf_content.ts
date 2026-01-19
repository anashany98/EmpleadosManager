
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

async function verify() {
    try {
        const buffer = fs.readFileSync('reproduction_overflow.pdf');
        const pdfDoc = await PDFDocument.load(buffer);
        const pageCount = pdfDoc.getPageCount();
        console.log(`Page Count: ${pageCount}`);

        if (pageCount > 1) {
            console.log('SUCCESS: PDF has multiple pages.');
        } else {
            console.error('FAILURE: PDF has only 1 page.');
        }

    } catch (error) {
        console.error('Error verifying PDF:', error);
    }
}

verify();
