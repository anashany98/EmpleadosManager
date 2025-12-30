
// import axios from 'axios';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

async function main() {
    // 1. Get Token
    const user = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (!user) {
        console.log('No admin found');
        return;
    }
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
    console.log('Got token');

    // 2. Get Payroll ID
    const payroll = await prisma.payrollRow.findFirst();
    if (!payroll) {
        console.log('No payroll found');
        return;
    }
    console.log('Target Payroll:', payroll.id);

    // 3. Request PDF
    try {
        const url = `http://localhost:3000/api/payroll/${payroll.id}/pdf`;
        console.log('Fetching:', url);

        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Response Status:', response.status);
        console.log('Response Type:', response.headers.get('content-type'));

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log('Data Length:', buffer.length);

        fs.writeFileSync('test_script_output.pdf', buffer);
        console.log('Saved to test_script_output.pdf');

        // Check header
        const header = buffer.slice(0, 5).toString();
        console.log('File Header:', header);

    } catch (error: any) {
        console.error('Error fetching PDF:', error);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
