import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

const redisURI = process.env.REDIS_URI || 'redis://127.0.0.1:6379'

//creates a Redis client and immediately opens a network connection to your Redis database using the provided address.

export const redis = new Redis(redisURI, {
    maxRetriesPerRequest: null, // Required by BullMQ in future phases
    enabledReadyCheck: true,
    lazyConnect: true,  // Don't connect on import; connect explicitly in server.js
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        logger.warn({ attempt: times, delayMs: delay }, 'Reconnecting to Redis...');
        return delay
    }
})

//Connection Success Event Listener
redis.on('connect', () => {
    logger.info('Redis socket connected');
})

redis.on('ready', () => {
    logger.info('Redis ready to accept commands');
});

//Error Handler Event Listener
redis.on('error', (err) => {
    logger.error({ err: err.message }, 'Redis error');
});

redis.on('close', () => {
    logger.warn('Redis connection closed');
});

export const connectRedis = async () => {
    try {
        await redis.connect();
    } catch (error) {
        logger.fatal({ err: error.message }, 'Failed to connect to Redis during startup')
        throw error;
    }
}

export const disconnectRedis = async () => {
    try {
        // quit waits for pending commands to finish before closing
        // await redis.quit();
        await Promise.allSettled([
            redis.quit(),
            bullRedisConnection.quit(),
            redisPublisher.quit(),
            redisSubscriber.quit(),
        ]);
        logger.info('All Redis connection closed gracefully')
    } catch (error) {
        logger.error({ err: error.message }, "Error closing Redis connections")
        redis.disconnect(); // force kill if quit fails
        bullRedisConnection.disconnect();
        redisPublisher.disconnect();
        redisSubscriber.disconnect();
    }
}

// Add this export at the bottom of src/config/redis.js:

//  Clean connection options for BullMQ Queues and Workers.
//  BullMQ requires separate connection instances with maxRetriesPerRequest: null.
export const bullRedisConnection=new Redis(env.REDIS_URI,{
    maxRetriesPerRequest:null,
    enableReadyCheck:false,
    lazyConnect:false, // BullMQ needs immediate connection
})



// ioredis npm library for a Node.js application.
// It is a highly robust, production-ready way to manage Redis connections.

// Compared to the standard redis library, ioredis is heavily favored in production
// because it has built-in support for advanced features like Redis Cluster, Sentinels, and automatically handles complex pipeline/stream structures.


// lazyConnect: true prevents ioredis from immediately attempting a network connection the moment the file is imported. This makes unit testing and orderly application boot predictable.
// redis.quit() sends the Redis QUIT command and waits for in-flight commands to settle. redis.disconnect() brutally tears down the TCP socket, dropping commands mid-flight.

// Dedicated Redis client for Publishing events.
export const redisPublisher=new Redis(env.REDIS_URI,{
    maxRetriesPerRequest:3,
    enableReadyCheck:true,
    lazyConnect:false,
})

//Dedicated Redis client for Subscribing to channels.
//Note: A client in subscription mode cannot issue regular Redis commands.

export const redisSubscriber = new Redis(env.REDIS_URI, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
});

redisPublisher.on('error',(err)=>logger.error({err},"Redis Publisher Error"))
redisSubscriber.on('error',(err)=>logger.error({err},"Redis Subscriber Error"))