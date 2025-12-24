import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date() });
});


import employeeRoutes from './routes/employeeRoutes';
import payrollRoutes from './routes/payrollRoutes';
import mappingProfileRoutes from './routes/mappingProfileRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import vacationRoutes from './routes/vacationRoutes';
import companyRoutes from './routes/companyRoutes';
import auditRoutes from './routes/auditRoutes';
import overtimeRoutes from './routes/overtimeRoutes';
import timeEntryRoutes from './routes/timeEntryRoutes';
import employeeDashboardRoutes from './routes/employeeDashboardRoutes';
import alertRoutes from './routes/alertRoutes';
import reportRoutes from './routes/reportRoutes';
import documentRoutes from './routes/documentRoutes';
import expenseRoutes from './routes/expenseRoutes';

// Rutas API
app.use('/api/dashboard/v2', employeeDashboardRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/mappings', mappingProfileRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/vacations', vacationRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/overtime', overtimeRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/expenses', expenseRoutes);


app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});