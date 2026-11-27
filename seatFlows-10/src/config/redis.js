import { createClient } from 'redis';
import { env } from './env.js'

let redisClient = null;

if (env.redis.url) {
    redisClient = createClient({
        url: env.redis.url,
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 3) {
                    console.warn('Uptash Redis Unavailable. Operating in db')
                    return false // stop retrying
                }
                return Math.min(retries * 200, 1000);
            }
        }
    })

    redisClient.on('error', (err) => {
        console.warn('Redis Warning', err.message);
    })

    redisClient.on('connect', () => {
        console.log('Connected to Redis.');
    });
}

export const connectRedis = async () => {
    if (!redisClient) {
        console.log('REDIS_URI not set. Running without redis');
        return;
    }

    try {
        await redisClient.connect();
    } catch (err) {
        console.warn('Could not connect to Redis on startup. Continuing with DB mode.');
    }
}

export const getCache = async (key) => {
    if (!redisClient?.isReady) return null;

    try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        return null;
    }
}

export const setCache = async (key, value, ttlSeconds = 600) => {
    if (!redisClient?.isReady) return;

    try {
        await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds })
    } catch {
        // Fail silently on cache write error
    }
}

export const deleteCache = async (key) => {
    if (!redisClient?.isReady) return;

    try {
        await redisClient.del(key);
    } catch {
        // Fail silently on cache delete error
    }
};

export const disconnectRedis = async () => {
  if (redisClient?.isReady) {
    await redisClient.quit();
    console.log('Redis connection closed.');
  }
};