import express, { type Express, type Request, type Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis';
import path from 'path';
import { Server } from 'socket.io';
import { errorMiddleware } from '../middlewares/errorMiddleware';
import { requestIdMiddleware } from '../middlewares/requestId';
import { csrfProtection } from '../middlewares/csrfMiddleware';
import { sanitizeBodyMiddleware } from '../middlewares/sanitizeMiddleware';
import { registerRoutes } from './registerRoutes';
import { initializeHealthChecker, healthController } from './health.controller';
import { initSocketHandlers } from '../websocket/handler';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

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
    // Trust proxy: nginx reverse proxy (1 hop)
    // If behind a load balancer, increase to 2
    app.set('trust proxy', 1);

    const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN?.split(',')[0] || '';

    app.use(helmet({
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: { policy: 'same-origin' },
        crossOriginResourcePolicy: { policy: 'same-site' },
        permittedCrossDomainPolicies: { permittedPolicies: 'none' },
        dnsPrefetchControl: { allow: false },
        xssFilter: true,
        hsts: isProduction ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        } : false,
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: isProduction
                    ? ["'self'", "'strict-dynamic'"]
                    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                styleSrc: isProduction
                    ? ["'self'", "'unsafe-inline'"]
                    : ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
                fontSrc: ["'self'", 'data:'],
                connectSrc: ["'self'", frontendUrl, 'ws:', 'wss:'],
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

    // Shared Redis store for all rate limiters (fail-open if Redis unavailable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redisStoreOpts = { sendCommand: (...args: any[]) => (redis as any).call(...args) };

    // A normal dashboard session fans out into many API calls (calendar,
    // notifications, counters and filters). Keep the test threshold low enough
    // to exercise the limiter, while allowing sustained real SPA use. Sensitive
    // routes retain their stricter dedicated limiters below.
    const intranetLimit = process.env.NODE_ENV === 'test'
        ? 200
        : Number(process.env.INTRANET_RATE_LIMIT_PER_MINUTE || 1000);

    const intranetLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: Number.isFinite(intranetLimit) && intranetLimit > 0 ? intranetLimit : 1000,
        standardHeaders: true,
        legacyHeaders: false,
        message: 'Too many requests from this IP, please try again after 1 minute',
        store: new RedisStore(redisStoreOpts)
    });

    const employeeLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: 'Too many employee requests, please try again after 1 minute',
        store: new RedisStore(redisStoreOpts)
    });

    const payrollLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 50,
        standardHeaders: true,
        legacyHeaders: false,
        message: 'Too many payroll requests, please try again after 1 minute',
        store: new RedisStore(redisStoreOpts)
    });

    const importLimiter = rateLimit({
        windowMs: 5 * 60 * 1000,
        max: 3,
        standardHeaders: true,
        legacyHeaders: false,
        message: 'Too many import requests. Please wait before trying again.',
        store: new RedisStore(redisStoreOpts)
    });

    const exportLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 5,
        standardHeaders: true,
        legacyHeaders: false,
        message: 'Too many export requests. Please wait before trying again.',
        store: new RedisStore(redisStoreOpts)
    });

    app.use(intranetLimiter);

    app.locals.employeeLimiter = employeeLimiter;
    app.locals.payrollLimiter = payrollLimiter;
    app.locals.importLimiter = importLimiter;
    app.locals.exportLimiter = exportLimiter;
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin) {
                return callback(null, true);
            }

            if (allowedOrigins.length === 0) {
                return callback(new AppError('CORS no está configurado', 503));
            }

            if (isAllowedOrigin(origin)) {
                return callback(null, true);
            }

            return callback(new AppError('Origen no permitido', 403));
        },
        credentials: true
    }));
}

function configureBaseMiddleware(app: Express): void {
    app.use(requestIdMiddleware);
    app.use(cookieParser());
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(sanitizeBodyMiddleware);
    app.use(csrfProtection);
    app.use('/assets', express.static(path.join(process.cwd(), 'assets')));
}

function registerHealthRoutes(app: Express): void {
    // Liveness probe - quick check if app is alive
    app.get('/api/health/liveness', healthController.getLiveness);
    // Readiness probe - check if app is ready to serve traffic
    app.get('/api/health/readiness', healthController.getReadiness);
    // Comprehensive health check with all service details
    app.get('/api/health', healthController.getHealth);

    app.get('/', (_req: Request, res: Response) => {
        res.send('Welcome to the Empleados Manager APP API. Use /api prefix for access.');
    });
}

export function createApp(): { app: Express; server: ReturnType<Express['listen']>; io: Server } {
    const app = express();
    const httpServer = createServer(app);

    const io = new Server(httpServer, {
        cors: {
            origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
                if (!origin || isAllowedOrigin(origin)) {
                    callback(null, true);
                } else {
                    callback(new AppError('Origen no permitido', 403));
                }
            },
            credentials: true
        }
    });

    initializeHealthChecker(prisma);

    configureSecurity(app);
    configureBaseMiddleware(app);
    registerHealthRoutes(app);
    registerRoutes(app);

    initSocketHandlers(io);

    // Add Sentry error handler (v8 API) - must be BEFORE our custom error middleware
    if (process.env.SENTRY_DSN) {
        import('@sentry/node').then((Sentry) => {
            Sentry.setupExpressErrorHandler(app);
        });
    }

    // Our custom error middleware - must come AFTER Sentry handler
    app.use(errorMiddleware);

    return { app, server: httpServer, io };
}
