// Fail-Fast Environment Validation

import { z } from 'zod'
import 'dotenv/config'

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    // Database & Cache
    MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
    REDIS_URI: z.string().min(1, 'REDIS_URI is required'),

    // Auth Secrets
    ACCESS_TOKEN_SECRET: z.string().min(16, 'ACCESS_TOKEN_SECRET must be at least 16 chars'),
    REFRESH_TOKEN_SECRET: z.string().min(16, 'REFRESH_TOKEN_SECRET must be at least 16 chars'),
    ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

    // cloudinary (profile image store)
    CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
    CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
    CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),

    //email infrastructure secrets
    EMAIL_USER: z.string().email('EMAIL_USER must be a valid email'),
    EMAIL_PASSWORD: z.string().min(1, 'EMAIL_PASSWORD is required'),
    EMAIL_FROM: z.string().default('OrchestriX <no-reply@orchestrix.dev>'),

    // Client
    FRONTEND_URL: z.string().default('http://localhost:5173'),
})

const parseEnv = () => {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
        console.error('Invalid or missing environment variables')
        console.error(JSON.stringify(parsed.error.format(), null, 2));
        process.exit(1)   // Fail immediately before app boots
    }
    return parsed.data
}

export const env = parseEnv()