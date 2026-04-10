import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { errorMiddleware } from '../middlewares/errorMiddleware';
import { csrfProtection } from '../middlewares/csrfMiddleware';
import { registerRoutes } from './registerRoutes';

const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production';
const devAllowedOriginSuffixes = (process.env.CORS_DEV_ALLOWED_SUFFIXES || '.lhr.life,.loca.lt,.trycloudflare.com,.tunnelmole.net')
    .split(',')
    .map((suffix) => suffix.trim().toLowerCase())
    .filter(Boolean);

if (isProduction && allowedOrigins.length === 0) {
    throw new Error('FATAL: CORS_ORIGIN must be set in production.');
}

function isAllowedOrigin(origin: string): boolean {
    if (allowedOrigins.includes(origin)) {
        return true;
    }

    if (isProduction) {
        return false;
    }

    try {
        const hostname = new URL(origin).hostname.toLowerCase();
        return devAllowedOriginSuffixes.some((suffix) => {
            const normalized = suffix.startsWith('.') ? suffix : `.${suffix}`;
            return hostname.endsWith(normalized) || hostname === normalized.slice(1);
        });
    } catch {
        return false;
    }
}

function configureSecurity(app: Express): void {
    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN?.split(',')[0] || '';
    
    app.use(helmet({
        crossOriginResourcePolicy: { policy: 'same-site' },
        hsts: isProduction ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        } : false,
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'blob:', frontendUrl],
                fontSrc: ["'self'", 'data:'],
                connectSrc: ["'self'", frontendUrl],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                upgradeInsecureRequests: isProduction ? [] : null
            }
        },
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin'
        }
    }));

    const intranetLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false,
        message: 'Too many requests from this IP, please try again after 1 minute'
    });

    const employeeLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: 'Too many employee requests, please try again after 1 minute'
    });

    const payrollLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 50,
        standardHeaders: true,
        legacyHeaders: false,
        message: 'Too many payroll requests, please try again after 1 minute'
    });

    app.use(intranetLimiter);

    app.locals.employeeLimiter = employeeLimiter;
    app.locals.payrollLimiter = payrollLimiter;
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin) {
                return callback(null, true);
            }

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
}

function configureBaseMiddleware(app: Express): void {
    app.use(cookieParser());
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(csrfProtection);
    app.use('/assets', express.static(path.join(process.cwd(), 'assets')));
}

function registerHealthRoutes(app: Express): void {
    app.get('/api/health', (_req: Request, res: Response) => {
        res.json({ status: 'ok', timestamp: new Date() });
    });

    app.get('/', (_req: Request, res: Response) => {
        res.send('Welcome to the Empleados Manager APP API. Use /api prefix for access.');
    });
}

export function createApp(): Express {
    const app = express();

    configureSecurity(app);
    configureBaseMiddleware(app);
    registerHealthRoutes(app);
    registerRoutes(app);
    app.use(errorMiddleware);

    return app;
}
