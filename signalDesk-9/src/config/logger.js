import pino from 'pino';
import { env } from './env.js'

export const logger = pino({
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname'
        },
    }
        : undefined, // Pure JSON output in production for high performance
})