import express from 'express'
import { globalErrorHandler } from './middlewares/error.middleware.js'
import { generalApiRateLimiter } from './middlewares/rateLimiter.middleware.js'
import AppError from './utils/appError.js'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRouter from './features/auth/auth.route.js'
import userRouter from './features/users/user.route.js'
import documentRouter from './features/documents/document.route.js'

const app = express()


app.use(helmet())

//Strict CORS configuration for cookie-based auth
app.use(cors({
    origin:process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials:true,
    methods:['GET','POST','PATCH','PUT','DELETE'],
    allowedHeaders:['Content-Type','Authorization']
}))

// Trust first proxy so req.ip reflects client IP accurately
app.set('trust proxy', 1)

// Limit JSON/URL-encoded payloads to prevent memory exhaustion
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))
app.use(cookieParser())


app.get('/health', (req, res) => {
    res.status(200).json({
        message: 'Server is running'
    })
})

app.use('/api', generalApiRateLimiter)
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/documents', documentRouter)

// 404 Handler for undefined routes
app.all('*path', (req, res, next) => {
    next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404))
})

app.use(globalErrorHandler)

export default app;