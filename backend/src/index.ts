import dotenv from 'dotenv';
dotenv.config();

import 'express-async-errors';
import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { prisma } from './lib/prisma';
import { errorMiddleware } from './middlewares/errorMiddleware';
import { protect, restrictTo, checkPermission } from './middlewares/authMiddleware';
import { csrfProtection } from './middlewares/csrfMiddleware';


import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
app.disable('x-powered-by');

const PORT = process.env.PORT || 3000;

// Trust proxy for secure cookies behind reverse proxies
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "same-site" }
}));

// Intranet Rate Limiting (Lenient)
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // High limit for Intranet usage (many users behind same NAT)
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 1 minute'
});
app.use(limiter);

const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production';
const devAllowedOriginSuffixes = (process.env.CORS_DEV_ALLOWED_SUFFIXES || '.lhr.life,.loca.lt,.trycloudflare.com,.tunnelmole.net')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

if (isProduction && allowedOrigins.length === 0) {
    throw new Error('FATAL: CORS_ORIGIN must be set in production.');
}

const isAllowedOrigin = (origin: string) => {
    if (allowedOrigins.includes(origin)) return true;
    if (isProduction) return false;

    try {
        const hostname = new URL(origin).hostname.toLowerCase();
        return devAllowedOriginSuffixes.some((suffix) => {
            const normalized = suffix.startsWith('.') ? suffix : `.${suffix}`;
            return hostname.endsWith(normalized) || hostname === normalized.slice(1);
        });
    } catch {
        return false;
    }
};

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (!isProduction && allowedOrigins.length === 0) {
            return callback(null, true);
        }
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(csrfProtection);

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
import onboardingRoutes from './routes/onboardingRoutes';
import anomalyRoutes from './routes/anomalyRoutes';
import kioskRoutes from './routes/kioskRoutes';
import offboardingRoutes from './routes/offboardingRoutes';
import vehicleRoutes from './routes/vehicleRoutes';
import cardRoutes from './routes/cardRoutes';
import calendarRoutes from './routes/calendarRoutes';

app.use('/api/kiosk', kioskRoutes);
app.use('/api/onboarding', protect, onboardingRoutes);

// Rutas API

// ... other imports

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/permission-profiles', permissionProfileRoutes);
app.use('/api/document-templates', documentTemplateRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/config', configRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/anomalies', anomalyRoutes);

// Static folders
// app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'))); // REMOVED FOR SECURITY
// app.use('/inbox', express.static(path.join(process.cwd(), 'data/inbox'))); // REMOVED FOR SECURITY
app.use('/assets', express.static(path.join(process.cwd(), 'assets')));

// Protected Routes
app.use('/api/dashboard/v2', protect, employeeDashboardRoutes);
app.use('/api/employees', protect, employeeRoutes);
app.use('/api/payroll', protect, payrollRoutes);
app.use('/api/mappings', protect, checkPermission('payroll', 'write'), mappingProfileRoutes);
app.use('/api/dashboard', protect, dashboardRoutes);
app.use('/api/vacations', protect, vacationRoutes);
app.use('/api/companies', protect, checkPermission('companies', 'read'), companyRoutes);
app.use('/api/audit', protect, restrictTo('admin'), auditRoutes);
app.use('/api/overtime', protect, checkPermission('employees', 'read'), overtimeRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/alerts', protect, alertRoutes);
app.use('/api/reports', protect, checkPermission('reports', 'read'), reportRoutes);
app.use('/api/documents', protect, documentRoutes);
app.use('/api/expenses', protect, expenseRoutes);
app.use('/api/assets', protect, checkPermission('assets', 'read'), assetRoutes);
app.use('/api/checklists', protect, checkPermission('employees', 'read'), checklistRoutes);
app.use('/api/projects', protect, checkPermission('projects', 'read'), projectRoutes);
app.use('/api/employee-project-work', protect, checkPermission('projects', 'read'), employeeProjectWorkRoutes);
app.use('/api/inventory', protect, checkPermission('assets', 'read'), inventoryRoutes);
app.use('/api/onboarding', protect, onboardingRoutes);
app.use('/api/offboarding', offboardingRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/calendar', calendarRoutes);

app.use(errorMiddleware);


import { inboxService } from './services/InboxService';
import { schedulerService } from './services/SchedulerService';
import { queueService } from './services/QueueService';
import { initWorkers } from './workers';
import { loggers } from './services/LoggerService';
import { EncryptionService } from './services/EncryptionService';

const log = loggers.api;

// Validate critical configuration
EncryptionService.validateKey();

// Database Connection Check
async function startServer() {
    try {
        log.info('Checking database connection...');
        await prisma.$connect();
        log.info('Database connected successfully');

        // Start Inbox Service (Watcher + Polling)
        inboxService.start();

        // Start Scheduler Service (Cron jobs)
        schedulerService.start();

        // Initialize Workers
        initWorkers();

        app.listen(Number(PORT), '0.0.0.0', () => {
            log.info({ port: PORT, host: '0.0.0.0' }, 'Backend running');
        });
    } catch (error) {
        log.fatal({ error }, 'Failed to connect to database');
        process.exit(1);
    }
}

const gracefulShutdown = () => {
    log.info('Received kill signal, shutting down gracefully');
    schedulerService.stop();
    schedulerService.stop();
    inboxService.stop();
    queueService.close().then(() => log.info('QueueService closed'));
    prisma.$disconnect().then(() => {
        log.info('Database disconnected');
        process.exit(0);
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

startServer();
