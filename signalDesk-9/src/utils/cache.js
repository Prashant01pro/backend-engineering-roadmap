import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';


// Standardized TTL (Time-To-Live) configurations
export const CACHE_TTL = {
    USER_PROFILE: 120, // 2 minutes
    DASHBOARD_STATS: 30, // 30 seconds
    JOB_STATUS: 15,     // 15 seconds
};

//  Retrieves and parses JSON data from Redis cache
//   @param {string} key
//   @returns {Promise<any|null>}

export const getCache = async (key) => {
    try {
        const cached = await redis.get(key);
        if (cached) {
            logger.debug({ key }, 'CACHE HIT');
            return JSON.parse(cached)
        }

        logger.debug({ key }, 'CACHE MISS');
        return null;

    } catch (error) {
        logger.warn({ err: error.message, key }, 'Redis getCache failed; falling back to DB');
        return null; // Fail-open: continue to MongoDB without throwing
    }
}

// Stores serialized JSON data in Redis with a TTL
//  * @param {string} key 
//  * @param {any} data 
//  * @param {number} ttlSeconds 

export const setCache = async (key, data, ttlSeconds = 60) => {
    try {
        await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds)
    } catch (error) {
        logger.warn({ err: error.message, key }, 'Redis setCache failed');
    }
}

// Explicitly invalidates (deletes) a cache key on DB updates
// @param {string} key 

export const invalidateCache = async (key) => {
    try {
        await redis.del(key);
        logger.debug({ key }, 'CACHE INVALIDATED');
    } catch (error) {
        logger.warn({ err: error.message, key }, 'Redis invalidateCache failed');
    }
};