import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import { prisma } from './lib/prisma';
import { errorMiddleware } from './middlewares/errorMiddleware';
import { protect, restrictTo, checkPermission } from './middlewares/authMiddleware';


const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/', (req: Request, res: Response) => {
    res.send('Welcome to the Empleados Manager APP API. Use /api prefix for access.');
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
import assetRoutes from './routes/assetRoutes';
import checklistRoutes from './routes/checklistRoutes';
import projectRoutes from './routes/projectRoutes';
import employeeProjectWorkRoutes from './routes/employeeProjectWorkRoutes';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import permissionProfileRoutes from './routes/permissionProfileRoutes';
import documentTemplateRoutes from './routes/documentTemplateRoutes';
import inboxRoutes from './routes/inboxRoutes';
import configRoutes from './routes/configRoutes';
import { inventoryRoutes } from './routes/inventoryRoutes';
import notificationRoutes from './routes/notificationRoutes';

// Rutas API
import fileRoutes from './routes/fileRoutes';

// ... other imports

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/permission-profiles', permissionProfileRoutes);
app.use('/api/document-templates', documentTemplateRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/config', configRoutes);
app.use('/api/notifications', notificationRoutes);
// Secure Files
app.use('/api/files', fileRoutes);

// Static folders
// app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'))); // REMOVED FOR SECURITY
app.use('/inbox', express.static(path.join(process.cwd(), 'data/inbox')));
app.use('/assets', express.static(path.join(process.cwd(), 'assets')));

// Protected Routes
app.use('/api/dashboard/v2', protect, employeeDashboardRoutes);
app.use('/api/employees', protect, checkPermission('employees', 'read'), employeeRoutes);
app.use('/api/payroll', protect, checkPermission('payroll', 'read'), payrollRoutes);
app.use('/api/mappings', protect, checkPermission('payroll', 'write'), mappingProfileRoutes);
app.use('/api/dashboard', protect, dashboardRoutes);
app.use('/api/vacations', protect, checkPermission('employees', 'read'), vacationRoutes);
app.use('/api/companies', protect, checkPermission('companies', 'read'), companyRoutes);
app.use('/api/audit', protect, restrictTo('admin'), auditRoutes);
app.use('/api/overtime', protect, checkPermission('employees', 'read'), overtimeRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/alerts', protect, alertRoutes);
app.use('/api/reports', protect, checkPermission('reports', 'read'), reportRoutes);
app.use('/api/documents', protect, checkPermission('employees', 'read'), documentRoutes);
app.use('/api/expenses', protect, checkPermission('employees', 'read'), expenseRoutes);
app.use('/api/assets', protect, checkPermission('assets', 'read'), assetRoutes);
app.use('/api/checklists', protect, checkPermission('employees', 'read'), checklistRoutes);
app.use('/api/projects', protect, checkPermission('projects', 'read'), projectRoutes);
app.use('/api/employee-project-work', protect, checkPermission('projects', 'read'), employeeProjectWorkRoutes);
app.use('/api/inventory', protect, checkPermission('assets', 'read'), inventoryRoutes);

app.use(errorMiddleware);


app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Backend running on http://0.0.0.0:${PORT}`);
});
// Trigger restart 2

// Trigger restart 3

// Trigger restart 4

// Trigger restart 5

// Trigger restart 6

// Trigger restart 7

// Trigger restart 8
