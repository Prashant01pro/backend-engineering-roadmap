import { redis } from '../config/redis.js'

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

// 1. Create a Device Session

// {string} sessionId - Unique identifier (UUID) for this device session
// {Object} sessionData - Must contain userId, refreshTokenHash, deviceInfo, etc.

export const createSession = async (sessionId, sessionData) => {
    // Stringify because Redis strings only hold text or buffers
    const payload = JSON.stringify(sessionData)

    await redis.set(
        `session:${sessionId}`,
        payload,
        'EX',
        SESSION_TTL_SECONDS
    )

    // SADD adds sessionId into the user's Set of active devices.
    await redis.sadd(`user_sessions:${sessionData.userId}`, sessionId)
}

//   2. Get a Session by its sessionId
//   Fetches and parses the session data from Redis.returns {Promise<Object|null>}
 
export const getSession = async (sessionId) => {
    const rawData = await redis.get(`session:${sessionId}`)
    if (!rawData) return null

    try {
        return JSON.parse(rawData)
    } catch {
        return null
    }
}

//  * 3. Update Session Token (Refresh Token Rotation)
//  * Updates the stored refreshTokenHash and lastActive timestamp.
//  * Crucial: Uses 'KEEPTTL' so the remaining lifespan of the session is NOT reset to 0 or removed.

export const updateSessionToken = async (sessionId, newRefreshTokenHash) => {
    const session = await getSession(sessionId)
    if (!session) return null

    // Update session properties
    session.refreshTokenHash = newRefreshTokenHash
    session.lastActive = new Date().toISOString()

    // 'KEEPTTL' (available in Redis 6+) retains the original TTL remaining on this key
    await redis.set(
        `session:${sessionId}`,
        JSON.stringify(session),
        'KEEPTTL'
    )

    return session
}

//  * 4. Delete a Specific Session (Single Device Logout / Revoke)
//  * Removes the session key and removes the sessionId from the user's Set.


export const deleteSession = async (sessionId) => {
    // 1. Fetch first to know which user this session belongs to
    const session = await getSession(sessionId)

    if (session?.userId) {
        // SREM: Set Remove - removes this single sessionId from the user's set
        await redis.srem(`user_sessions:${session.userId}`, sessionId)
    }

    // DEL: Deletes the session string key
    await redis.del(`session:${sessionId}`)
}

/**
 * 5. Get All Active Sessions for a User (View Active Devices)
 * Fetches all session IDs belonging to this user from Redis Set.
 * Includes "Self-Healing": If Redis already auto-expired a session key,
 * it cleans up the orphaned sessionId from the Set.
 *
 * @param {string} userId
 * @returns {Promise<Array<Object>>}
 */
export const getUserSessions = async (userId) => {
    // SMEMBERS returns all members (session IDs) in this user's Set
    const sessionIds = await redis.smembers(`user_sessions:${userId}`)
    if (!sessionIds || sessionIds.length === 0) return []

    const activeSessions = []

    for (const id of sessionIds) {
        const session = await getSession(id)

        if (session) {
            activeSessions.push({ sessionId: id, ...session })
        } else {
            // Lazy Cleanup (Self-Healing):
            // The session key expired via TTL, but the ID was still in the Set. Clean it up!
            await redis.srem(`user_sessions:${userId}`, id)
        }
    }

    return activeSessions
}

/**
 * 6. Delete All Sessions for a User (Logout All Devices)
 * Erases all device sessions and deletes the user's Set.
 *
 * @param {string} userId
 */
export const deleteAllUserSessions = async (userId) => {
    // 1. Get all active session IDs for this user
    const sessionIds = await redis.smembers(`user_sessions:${userId}`)

    if (sessionIds && sessionIds.length > 0) {
        // Build the list of Redis keys: ['session:id1', 'session:id2', ...]
        const keysToDelete = sessionIds.map((id) => `session:${id}`)

        // Delete all session keys in a single atomic Redis command
        await redis.del(...keysToDelete)
    }

    // 2. Delete the user's Set key itself
    await redis.del(`user_sessions:${userId}`)
}




// • 'EX' (Short for EXpire): This is a strict keyword built into Redis. It signals to Redis: "Hey, don't keep this data forever. Look at the next argument to see when to delete it."
// • SESSION_TTL_SECONDS (Time-To-Live): This is a variable you define (e.g., 86400 for 24 hours) that sets the exact countdown timer.
