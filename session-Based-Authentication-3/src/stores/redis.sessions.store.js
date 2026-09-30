import { redis } from '../config/redis.js'

// 7 days expiration in seconds for Redis
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

/**
 * 1. Create a session in Redis
 * Stores the session data with an automatic expiration TTL (EX),
 * and tracks the sessionId inside the user's Redis Set.
 */
export const createSession = async (sessionId, sessionData) => {
    // Save session string with auto-expiration (EX = seconds)
    await redis.set(
        `session:${sessionId}`,
        JSON.stringify(sessionData),
        'EX',
        SESSION_TTL_SECONDS
    )

    // Add this sessionId to the user's Set of active devices
    await redis.sadd(`user_sessions:${sessionData.userId}`, sessionId)
}

/**
 * 2. Get a session by its sessionId
 * Returns parsed session object or null if not found or expired.
 */
export const getSession = async (sessionId) => {
    const data = await redis.get(`session:${sessionId}`)
    if (!data) return null
    return JSON.parse(data)
}

/**
 * 3. Delete a specific session
 * Removes the session from both Redis and the user's Set.
 */
export const deleteSession = async (sessionId) => {
    // Fetch session first to know which user owns it
    const sessionData = await getSession(sessionId)

    if (sessionData) {
        // Remove sessionId from the user's Set
        await redis.srem(`user_sessions:${sessionData.userId}`, sessionId)
    }

    // Delete the session key from Redis
    await redis.del(`session:${sessionId}`)
}

/**
 * 4. Get all active sessions for a user
 * Returns an array of all active devices logged in for this user.
 */
export const getUserSessions = async (userId) => {
    // Get all session IDs belonging to this user
    const sessionIds = await redis.smembers(`user_sessions:${userId}`)
    if (!sessionIds || sessionIds.length === 0) return []

    const activeSessions = []

    for (const id of sessionIds) {
        const data = await getSession(id)
        if (data) {
            activeSessions.push({ sessionId: id, ...data })
        } else {
            // Self-cleaning: if Redis expired the session key, remove dead ID from the Set
            await redis.srem(`user_sessions:${userId}`, id)
        }
    }

    return activeSessions
}

/**
 * 5. Delete all sessions for a user (Logout from all devices)
 * Erases all device sessions and removes the user's Set.
 */
export const deleteAllUserSessions = async (userId) => {
    const sessionIds = await redis.smembers(`user_sessions:${userId}`)

    if (sessionIds && sessionIds.length > 0) {
        // Delete all session keys at once
        const keysToDelete = sessionIds.map((id) => `session:${id}`)
        await redis.del(...keysToDelete)
    }

    // Delete the user's Set key
    await redis.del(`user_sessions:${userId}`)
}