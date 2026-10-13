import { redis } from "../config/redis.js";
import AppError from "../utils/appError.js";

export const createRedisRateLimiter = ({
    prefix = 'global',
    windowSeconds = 60,
    maxRequests = 100,
    keyStrategy = 'ip',
    message = 'Too many requests, please try again later.'
}) => {
    return async (req, res, next) => {
        try {

        } catch (error) {
            // Fail-open vs Fail-closed:
            // Log the Redis error, but allow the request or pass error depending on security policy
            console.error('Rate limiter Redis error:', error.message)
            next()
        }
    }
}