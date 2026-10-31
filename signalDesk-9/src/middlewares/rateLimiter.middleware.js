import { pipe } from "zod";
import { redis } from "../config/redis.js";
import AppError from "../utils/appError.js";


/*
  Sliding Window Log Rate Limiter using Redis Sorted Sets (ZSET)
  Mechanics:
  1. ZREMRANGEBYSCORE: Evict request timestamps older than (now - windowSeconds)
  2. ZADD: Add current request timestamp (now) as both score and unique member
  3. ZCARD: Count total requests inside the current sliding window
  4. EXPIRE: Keep the ZSET alive only as long as the window duration
 */


export const createRedisRateLimiter = ({
    prefix = 'global',
    windowSeconds = 60,
    maxRequests = 100,
    keyStrategy = 'ip',
    message = 'Too many requests, please try again later.'
}) => {
    return async (req, res, next) => {
        try {
            // determine the rate-limit identify
            let identifier = req.ip || req.socket.remoteAddress || 'unknown_ip'
            if (keyStrategy === 'user' && req.user?._id) {
                identifier = `user:${req.user._id.toString()}`
            } else if (keyStrategy === 'ip_and_email') {
                // brute force login protection: combine ip + normailzation email if needed
                const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : 'no_email'
                identifier = `ip:${identifier}:email:${email}`
            }

            const redisKey = `ratelimit:sliding:${prefix}:${identifier}`
            const now = Date.now();
            const windowStart = now - (windowSeconds * 1000);

            // Atomic sliding-window pipeline
            // Atomic increment +TTL check using redis pipeline
            const pipeline = redis.multi();

            // pipeline.incr(redisKey)
            // pipeline.ttl(redisKey)

            pipeline.zremrangebyscore(redisKey, 0, windowStart); // Purge stale entries
            pipeline.zadd(redisKey, now, `${now}:${Math.random().toString(36).substring(2, 7)}`); // Add current hit
            pipeline.zcard(redisKey);           // Count hits in window
            pipeline.expire(redisKey,windowSeconds +2);  // Refresh TTL with small safety margin


            const results = await pipeline.exec()

            // results format from ioredis multi(): [[err, currentCount], [err, currentTtl]]
            // results structure: [[null, removedCount], [null, addedCount], [null, currentCount], [null, expireSuccess]]
            const currentCount = results[2][1]
            // let currentTtl = results[1][1]

            // If this is the first request in the window (or key had no TTL), set expiration
            // if (currentCount === 1 || currentTtl === -1) {
            //     await redis.expire(redisKey, windowSeconds)
            //     currentTtl = windowSeconds
            // }

            // Set standard HTTP RateLimit headers on every response
            const remaining = Math.max(0, maxRequests - currentCount)
            res.set('X-RateLimit-Limit', String(maxRequests))
            res.set('X-RateLimit-Remaining', String(remaining))
            res.set('X-RateLimit-Reset',String(windowSeconds))
            // res.set('X-RateLimit-Reset', String(currentTtl > 0 ? currentTtl : windowSeconds))

            // Reject if limit exceeded (HTTP 429 Too Many Requests)
            // threshold check
            if (currentCount > maxRequests) {
                // const retryAfter = currentTtl > 0 ? currentTtl : windowSeconds
                // res.set('Retry-After', String(retryAfter))

                res.set('Retry-After', String(windowSeconds));
                return next(
                    new AppError(
                        `${message} Please retry after ${windowSeconds} seconds.`,
                        429
                    )
                )
            }
            next()

        } catch (error) {
            // Fail-open vs Fail-closed:
            // Log the Redis error, but allow the request or pass error depending on security policy

            // Fail-open strategy: log Redis errors without blocking legitimate traffic
            console.error('Rate limiter Redis error:', error.message)
            next()
        }
    }
}

//Specialized Rate Limiters

// strict login brute force limiter (5 attempts per 15 minutes per IP +email)
export const loginRateLimiter = createRedisRateLimiter({
    prefix: 'auth_login',
    windowSeconds: 15 * 60,
    maxRequests: 5,
    keyStrategy: 'ip_and_email',
    message: 'Too many login attempts.'
})

// Strict Registration Limiter (5 accounts per hour per IP)
export const registerRateLimiter = createRedisRateLimiter({
    prefix: 'auth_register',
    windowSeconds: 60 * 60,
    maxRequests: 5,
    keyStrategy: 'ip',
    message: 'Too many accounts created from this IP.'
})

// Strict Password Reset Limiter (3 requests per 15 minutes per IP)
export const passwordResetRateLimiter = createRedisRateLimiter({
    prefix: 'auth_password_reset',
    windowSeconds: 15 * 60,
    maxRequests: 3,
    keyStrategy: 'ip',
    message: 'Too many password reset requests.'
})

// Job Creation Limiter (10 background jobs per minute per Authenticated User)
export const jobCreationRateLimiter = createRedisRateLimiter({
    prefix: 'job_create',
    windowSeconds: 60,
    maxRequests: 10,
    keyStrategy: 'user',
    message: 'Job creation rate limit exceeded. Queue capacity protected.'
});

// Global API Limiter (100 requests per minute per IP)
export const generalApiRateLimiter = createRedisRateLimiter({
    prefix: 'general_api',
    windowSeconds: 60,
    maxRequests: 100,
    keyStrategy: 'ip',
    message: 'API rate limit exceeded.'
});