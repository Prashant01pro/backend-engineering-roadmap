import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import compression from 'compression';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestIdMiddleware } from './middlewares/requestId.middleware.js';
import { globalErrorHandler } from './middlewares/error.middleware.js';
import { generalApiRateLimiter } from './middlewares/rateLimiter.middleware.js';

import AppError from './utils/appError.js';

import authRouter from './features/auth/auth.route.js';
import teamRouter from './features/teams/team.route.js';
import incidentRouter from './features/incidents/incident.route.js';
import evidenceRouter from './features/evidence/evidence.route.js';
import chatRouter from './features/chat/chat.route.js';
import noteRouter from './features/notes/note.route.js';
import notificationRouter from './features/notifications/notification.route.js';
import analyticsRouter from './features/analytics/analytics.route.js';
import searchRouter from './features/search/search.route.js';
import healthRouter from './features/health/health.route.js';

const app = express();

// Request ID Middleware (must be first so all loggers and downstream handlers have req.id)
app.use(requestIdMiddleware);
app.use(compression());

// Structured HTTP Request Logging
app.use(
    pinoHttp({
        logger,
        genReqId: (req) => req.id,
        customLogLevel: (req, res, err) => {
            if (res.statusCode >= 500 || err) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
        },
    })
);

app.use(helmet());

app.use(cors({
    origin: env.FRONTEND_URL,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true, // Required for hybrid auth cookies
}));

app.use(express.json({ limit: '10kb' })); // Guard against large payload DoS
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Health Check probes (exempt from general rate limiter for Load Balancers & K8s)
app.use('/health', healthRouter);
app.use('/api/v1/health', healthRouter);

// Apply global rate limiter to all API endpoints
app.use('/api/v1', generalApiRateLimiter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/teams', teamRouter);
app.use('/api/v1/incidents', incidentRouter);
app.use('/api/v1', evidenceRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1', noteRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/search', searchRouter);

// 404 Unhandled Route Handler
app.use((req, res, next) => {
    next(new AppError(`Cannot find ${req.method} ${req.originalUrl} on this server`, 404));
});

// Global Centralized Error Handler
app.use(globalErrorHandler);

export default app;
