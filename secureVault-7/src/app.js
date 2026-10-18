import express from 'express'
import mongoose from 'mongoose'

import { globalErrorHandler } from './middlewares/error.middleware.js'
import { generalApiRateLimiter } from './middlewares/rateLimiter.middleware.js'
import { requestIdMiddleware } from './middlewares/requestId.middleware.js'

import AppError from './utils/appError.js'
import helmet from 'helmet'
import cors from 'cors'

import { redis } from './config/redis.js'
import cookieParser from 'cookie-parser'

import authRouter from './features/auth/auth.route.js'
import userRouter from './features/users/user.route.js'
import documentRouter from './features/documents/document.route.js'
import shareRouter from './features/shares/share.route.js'

const app = express()

//assign unique correlation ID to every request
app.use(requestIdMiddleware)
app.use(helmet())

//Strict CORS configuration for cookie-based auth
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))

// Trust first proxy so req.ip reflects client IP accurately
app.set('trust proxy', 1)

// Limit JSON/URL-encoded payloads to prevent memory exhaustion
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))
app.use(cookieParser())


//Run an active ping on both MongoDB and Redis before returning 200 OK. If any dependency is down, return 503 Service Unavailable.
app.get('/health', async (req, res) => {

    const health = {
        status: 'ok',
        uptime: process.uptime(),
        timeStamp: new Date().toISOString(),
        services: {
            database: 'unknown',
            redis: 'unknown'
        }
    }

    try {
        // ping mongodb
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
        health.services.database = dbStatus

        // ping redis
        const redisPing = await redis.ping()
        health.services.redis = redisPing === 'PONG' ? 'connected' : 'disconnected'

        const isHealthy = health.services.database === 'connected' && health.services.redis === 'connected'

        res.status(isHealthy ? 200 : 503).json({
            health,
            message: 'Server is running'
        })

    } catch (error) {
        health.status = 'error'
        health.error = error.message
        res.status(503).json(health)
    }
})

app.use('/api', generalApiRateLimiter)
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/documents', documentRouter)
app.use('/api/v1/shares', shareRouter)

// 404 Handler for undefined routes
app.all('*path', (req, res, next) => {
    next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404))
})

app.use(globalErrorHandler)

export default app;