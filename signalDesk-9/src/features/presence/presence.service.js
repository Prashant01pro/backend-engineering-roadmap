import { redis } from '../../config/redis.js';
import User from '../auth/auth.model.js';
import { logger } from '../../config/logger.js';

const getRedisKey = (userId) => `presence:user_sockets:${userId}`;

// record a new socket connection for a user
export const trackSocketConnect = async (userId, socketId) => {
    const key = getRedisKey(userId);

    // add socketId to the user's set of active sockets 
    await redis.sadd(key, socketId);

    // set a safety TTL of 24h
    await redis.expire(key, 86400);

    const count = await redis.scard(key)

    // if count was 0 before this addition (now 1), this user just came ONLINE
    const isFirstConnection = count === 1;

    return { isFirstConnection, activeConnections: count };
}

// remove socket upon disconnect and checks if user is truly offline
export const trackSocketDisconnect = async (userId, socketId) => {
    const key = getRedisKey(userId)

    await redis.srem(key, socketId)
    const count = await redis.scard(key)

    const isLastConnection = count === 0;

    if (isLastConnection) {
        // remove empty key
        await redis.del(key);

        // update durable lastSeen in MongoDB
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, { lastSeen });

        return { isLastConnection: true, lastSeen };
    }

    return { isLastConnection: false, activeConnections: count }
}

// Check if a specific user is currently online
export const isUserOnline = async (userId) => {
    const count = await redis.scard(getRedisKey(userId));
    return count > 0;
};

// get online status for a list of user IDs {bulk check for UI lists}
export const getUserPresenceStatus = async (userIds) => {
    const pipeline = redis.pipeline();
    userIds.forEach((id) => pipeline.scard(getRedisKey(id)));
    const results = await pipeline.exec();

    const statusMap = {};
    userIds.forEach((id, index) => {
        const count = results[index][1] || 0;
        statusMap[id] = count > 0;
    });

    return statusMap;
}