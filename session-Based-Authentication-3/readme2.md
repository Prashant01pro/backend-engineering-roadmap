# Route-by-Route Blueprint & Making Flow Guide

This document is your **reusable architectural blueprint**. When building session authentication in future projects, use this guide to implement every route, middleware, and service flow without having to guess or reinvent the wheel.

---

## Table of Contents
1. [Route 1: `POST /auth/register` (User Registration)](#1-route-1-post-authregister-user-registration)
2. [Route 2: `POST /auth/login` (Login & Session Creation)](#2-route-2-post-authlogin-login--session-creation)
3. [Core Guard: `authenticate` Middleware (Session Validation & Hijacking Defense)](#3-core-guard-authenticate-middleware)
4. [Route 3: `GET /user/me` (Protected Profile Access)](#4-route-3-get-userme-protected-profile-access)
5. [Route 4: `GET /auth/sessions` (View All Active Devices)](#5-route-4-get-authsessions-view-all-active-devices)
6. [Route 5: `POST /auth/logout` (Single Device Logout)](#6-route-5-post-authlogout-single-device-logout)
7. [Route 6: `DELETE /auth/sessions/:sessionId` (Remote Device Revocation)](#7-route-6-delete-authsessionssessionid-remote-device-revocation)
8. [Route 7: `POST /auth/logout-all` (Mass Revocation - All Devices)](#8-route-7-post-authlogout-all-mass-revocation---all-devices)

---

## 1. Route 1: `POST /auth/register` (User Registration)

### Purpose
Creates a new user record in the primary database with an encrypted password, ensuring unique emails and strong input validation.

### The Making Flow (Step-by-Step)
```
1. Client sends POST request with JSON body { name, email, password }.
2. Router forwards to register controller wrapped in catchAsync.
3. Controller forwards req.body to registerService.
4. Service validates fields:
   - Check if name, email, or password are missing -> throw AppError(400).
   - Check password length (min 10 characters) -> throw AppError(400).
5. Service checks MongoDB: User.findOne({ email }).
   - If user exists -> throw AppError('User already exists', 400).
6. Service hashes password: await bcrypt.hash(password, 12).
7. Service persists record: await User.create({ name, email, password: hashedPassword }).
8. Controller returns HTTP 201 Created with sanitized user object (excluding password).
```

### Code Blueprint
```javascript
// auth.services.js
export const registerService = async (body) => {
    const { name, email, password } = body
    if (!name || !email || !password) throw new AppError('All fields are required', 400)
    if (password.length < 10) throw new AppError('Password must be at least 10 characters', 400)

    const existingUser = await User.findOne({ email })
    if (existingUser) throw new AppError('User already exists', 400)

    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await User.create({ name, email, password: hashedPassword })
    return user
}

// auth.controller.js
export const register = catchAsync(async (req, res) => {
    const user = await registerService(req.body)
    res.status(201).json({
        message: 'User registration successful',
        user: { id: user._id, name: user.name, email: user.email }
    })
})
```

---
#### Topics Used:
* Input validation & sanitization
* Password hashing with salt rounds
* Unique constraints & duplicate key handling
* Operational error throwing
* Asynchronous controller execution

#### Technology & Packages:
* **`express.Router()`** — Route declaration
* **`mongoose`** — Schema definitions & MongoDB queries (`findOne`, `create`)
* **`bcrypt`** — Cryptographic password hashing (`hash`)
* **`AppError` & `catchAsync`** — Centralized async error handling

---

## 2. Route 2: `POST /auth/login` (Login & Session Creation)

### Purpose
Authenticates user credentials, captures device metadata (User-Agent, IP), issues a cryptographically secure session ID, stores session state in Redis with a 7-day TTL, and returns an `httpOnly` cookie.

### The Making Flow (Step-by-Step)
```
1. Client sends POST request with { email, password }.
2. Controller extracts device fingerprint metadata:
   - userAgent: req.headers['user-agent']
   - ip: req.ip || req.socket.remoteAddress
3. Controller calls loginService(req.body, metadata).
4. Service validates fields exist -> queries User.findOne({ email }).select('+password').
   - If user not found -> throw AppError('Invalid email or password', 401).
5. Service compares password: await bcrypt.compare(password, user.password).
   - If match fails -> throw AppError('Invalid email or password', 401).
6. Service calls createSessionService(user._id, metadata):
   - Generates 32-byte hex ID: crypto.randomBytes(32).toString('hex').
   - Constructs session object: { userId, userAgent, ip, createdAt, expiresAt }.
   - Saves to Redis: SET session:<sessionId> <data> EX 604800 (7 days).
   - Adds to User Set: SADD user_sessions:<userId> <sessionId>.
7. Controller sets cookie on response:
   - res.cookie('sessionId', session.sessionId, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7d, path: '/' }).
8. Controller returns HTTP 200 OK with sanitized user info.
```

### Code Blueprint
```javascript
// auth.controller.js
export const login = catchAsync(async (req, res) => {
    const metadata = {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.socket.remoteAddress
    }
    const { user, session } = await loginService(req.body, metadata)

    res.cookie('sessionId', session.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
    })

    res.status(200).json({
        message: 'User login successful',
        user: { id: user._id, name: user.name, email: user.email }
    })
})
```

---
#### Topics Used:
* Credential comparison (`bcrypt.compare`)
* Cryptographic pseudo-random number generators (PRNG)
* Device fingerprinting (User-Agent, IP capture)
* Redis string storage with TTL (`SET ... EX`)
* Redis Set indexing for multi-device tracking (`SADD`)
* HTTP cookie flags (`httpOnly`, `sameSite`, `secure`, `path`, `maxAge`)

#### Technology & Packages:
* **`crypto` (Node.js built-in)** — Cryptographically secure tokens (`randomBytes`)
* **`ioredis`** — Redis communication (`set`, `sadd`)
* **`cookie-parser` & Express `res.cookie()`** — Header formatting

---

## 3. Core Guard: `authenticate` Middleware

### Purpose
Protects private routes by extracting session tokens, querying Redis, verifying expiration timestamps, detecting session hijacking via User-Agent comparison, and attaching `req.session`.

### The Making Flow (Step-by-Step)
```
1. Request arrives at protected endpoint.
2. Middleware reads sessionId from req.cookies?.sessionId || req.headers?.sessionid.
   - If missing -> return next(new AppError('Unauthorized: No session token', 401)).
3. Middleware queries Redis: await getUserSession(sessionId).
4. Validation Step A (Existence & Expiration):
   - If !userSession OR Date.now() > new Date(userSession.expiresAt).getTime():
     - Lazy cleanup: await destroySession(sessionId).
     - Clear cookie: res.clearCookie('sessionId', { path: '/' }).
     - Return next(new AppError('Session expired or invalid, please log in again', 401)).
5. Validation Step B (Device Hijacking Check):
   - Compare userSession.userAgent with req.headers['user-agent'].
   - If mismatched:
     - Destroy compromised session in Redis immediately.
     - Clear cookie on response.
     - Return next(new AppError('Suspicious activity: Session hijacked. Log in again', 401)).
6. Validation passes: attach req.session = userSession and call next().
```

### Code Blueprint
```javascript
// auth.middleware.js
export const authenticate = async (req, res, next) => {
    const sessionId = req.cookies?.sessionId || req.headers?.sessionid
    if (!sessionId) {
        return next(new AppError('Invalid user session and credentials', 401))
    }

    const userSession = await getUserSession(sessionId)

    // 1. Expiration & Null check
    if (!userSession || Date.now() > new Date(userSession.expiresAt).getTime()) {
        if (sessionId) {
            await destroySession(sessionId)
            res.clearCookie('sessionId', { path: '/' })
        }
        return next(new AppError('Session expired or invalid, please log in again', 401))
    }

    // 2. Device Fingerprint (Session Hijacking Prevention)
    const currentUserAgent = req.headers['user-agent']
    if (userSession.userAgent && userSession.userAgent !== currentUserAgent) {
        await destroySession(sessionId)
        res.clearCookie('sessionId', { path: '/' })
        return next(new AppError('Suspicious activity detected: Session hijacked. Please log in again', 401))
    }

    req.session = userSession
    next()
}
```

---
#### Topics Used:
* Express middleware chaining & interception
* Multi-source token extraction (Cookies & Fallback Headers)
* Fast in-memory session lookup (<1ms latency)
* Lazy cache cleanup & cookie purging
* Defense-in-depth: Session hijacking prevention via User-Agent fingerprinting
* Context propagation on Express request object (`req.session`)

#### Technology & Packages:
* **`cookie-parser`** — Cookie parsing
* **`ioredis`** — Session lookup (`get`) & deletion (`del`, `srem`)
* **`AppError`** — Centralized operational error delivery

---

## 4. Route 3: `GET /user/me` (Protected Profile Access)

### Purpose
Allows authenticated users to view their profile information using the identity stored in their session.

### The Making Flow (Step-by-Step)
```
1. Client sends GET /user/me (Cookie automatically sent by browser).
2. authenticate middleware runs, verifies session, sets req.session.
3. Controller extracts userId = req.session.userId.
4. Controller calls getMeService(userId).
5. Service queries MongoDB: await User.findById(userId).
   - If not found -> throw AppError('User not found', 404).
6. Controller responds with HTTP 200 OK and user profile data.
```

### Code Blueprint
```javascript
// user.controller.js
export const me = catchAsync(async (req, res) => {
    const { userId } = req.session
    const user = await getMeService(userId)

    res.status(200).json({
        id: user._id,
        name: user.name,
        email: user.email
    })
})
```

---
#### Topics Used:
* Route protection with custom middleware
* Accessing session context (`req.session`)
* Database lookup by document primary key (`_id`)
* Response shaping

#### Technology & Packages:
* **`express.Router()`**
* **`mongoose`** (`User.findById`)
* **`catchAsync`**

---

## 5. Route 4: `GET /auth/sessions` (View All Active Devices)

### Purpose
Provides the logged-in user with a list of all active sessions/devices currently authorized on their account.

### The Making Flow (Step-by-Step)
```
1. Client sends GET /auth/sessions (with cookie).
2. authenticate middleware validates session, sets req.session.
3. Controller reads userId = req.session.userId.
4. Service queries Redis Set: await redis.smembers(`user_sessions:${userId}`).
5. Service loops through each sessionId in the Set:
   - Calls await redis.get(`session:${id}`).
   - If data exists -> pushes { sessionId: id, ...data } into activeSessions array.
   - If data is null (Redis TTL expired key) -> self-healing cleanup: await redis.srem(user_sessions, id).
6. Controller returns HTTP 200 OK with { sessions: [...] }.
```

### Code Blueprint
```javascript
// redis.sessions.store.js
export const getUserSessions = async (userId) => {
    const sessionIds = await redis.smembers(`user_sessions:${userId}`)
    if (!sessionIds || sessionIds.length === 0) return []

    const activeSessions = []
    for (const id of sessionIds) {
        const data = await getSession(id)
        if (data) {
            activeSessions.push({ sessionId: id, ...data })
        } else {
            // Self-cleaning: remove dead key from Set
            await redis.srem(`user_sessions:${userId}`, id)
        }
    }
    return activeSessions
}

// auth.controller.js
export const getAllSessions = catchAsync(async (req, res) => {
    const userId = req.session.userId
    const sessions = await getAllUserSessionsService(userId)
    res.status(200).json({ sessions })
})
```

---
#### Topics Used:
* Multi-device session aggregation
* Redis Set operations (`SMEMBERS`, `SREM`)
* Self-healing cache patterns (purging orphan set members)
* Device transparency for end-users

#### Technology & Packages:
* **`ioredis`** (`smembers`, `get`, `srem`)
* **`express.Router()`**

---

## 6. Route 5: `POST /auth/logout` (Single Device Logout)

### Purpose
Terminates the session for the current device, removing it from Redis and commanding the browser to delete the cookie.

### The Making Flow (Step-by-Step)
```
1. Client sends POST /auth/logout.
2. Controller reads sessionId from cookie or header.
3. If sessionId exists:
   - Calls logoutService(sessionId).
   - Store fetches session to get userId.
   - Store removes sessionId from Redis Set: SREM user_sessions:<userId> <sessionId>.
   - Store deletes Redis key: DEL session:<sessionId>.
4. Controller sends clearing cookie:
   - res.clearCookie('sessionId', { httpOnly: true, sameSite: 'lax', path: '/' }).
5. Controller returns HTTP 200 OK: { message: 'User logout successfully' }.
```

### Code Blueprint
```javascript
// auth.controller.js
export const logout = catchAsync(async (req, res) => {
    const sessionId = req.cookies?.sessionId || req.headers?.sessionid

    if (sessionId) {
        await logoutService(sessionId)
    }

    res.clearCookie('sessionId', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    })

    res.status(200).json({ message: 'User logout successfully' })
})
```

---
#### Topics Used:
* Idempotent logout handling (works even if session already expired)
* Cache invalidation (`DEL`)
* Set membership cleanup (`SREM`)
* Cookie invalidation via `Max-Age=0`

#### Technology & Packages:
* **`ioredis`** (`del`, `srem`)
* **`cookie-parser` & Express `res.clearCookie()`**

---

## 7. Route 6: `DELETE /auth/sessions/:sessionId` (Remote Device Revocation)

### Purpose
Allows a user on one device (e.g. Laptop) to remotely terminate a session on another device (e.g. a lost phone).

### The Making Flow (Step-by-Step)
```
1. Client sends DELETE /auth/sessions/<TARGET_SESSION_ID>.
2. authenticate middleware verifies requesting user's identity.
3. Controller reads:
   - userId = req.session.userId
   - targetSessionId = req.params.sessionId
4. Service performs Insecure Direct Object Reference (IDOR) check:
   - Fetches targetSession = await getSession(targetSessionId).
   - If !targetSession OR targetSession.userId !== userId:
     -> throw AppError('Session not found or unauthorized', 404).
5. Service deletes targetSessionId from Redis:
   - DEL session:<targetSessionId>
   - SREM user_sessions:<userId> <targetSessionId>
6. Controller responds with HTTP 200 OK: { message: 'Session revoked successfully' }.
```

### Code Blueprint
```javascript
// session.service.js
export const destroySpecificSessionService = async (userId, targetSessionId) => {
    const targetSession = await getSession(targetSessionId)

    // Security: User cannot delete sessions belonging to someone else
    if (!targetSession || targetSession.userId !== userId.toString()) {
        throw new AppError('Session not found or unauthorized', 404)
    }

    await deleteSession(targetSessionId)
}

// auth.controller.js
export const logoutSpecificSession = catchAsync(async (req, res) => {
    const userId = req.session.userId
    const { sessionId } = req.params

    await destroySpecificSessionService(userId, sessionId)

    res.status(200).json({ message: 'Session revoked successfully' })
})
```

---
#### Topics Used:
* RESTful DELETE operations with route parameters (`req.params`)
* Object-level authorization & IDOR defense
* Targeted remote session termination

#### Technology & Packages:
* **`express.Router()`**
* **`ioredis`**
* **`AppError`**

---

## 8. Route 7: `POST /auth/logout-all` (Mass Revocation - All Devices)

### Purpose
Instantly invalidates all active sessions across all devices for the current user (useful during password resets or compromised accounts).

### The Making Flow (Step-by-Step)
```
1. Client sends POST /auth/logout-all.
2. authenticate middleware verifies identity, provides req.session.userId.
3. Service fetches all session IDs from user's Set: await redis.smembers(`user_sessions:${userId}`).
4. If session IDs exist:
   - Generates array of keys: keys = sessionIds.map(id => `session:${id}`).
   - Batch deletes all session keys from Redis in one operation: await redis.del(...keys).
5. Service deletes the user's Set key: await redis.del(`user_sessions:${userId}`).
6. Controller clears the cookie on the calling device: res.clearCookie('sessionId', ...).
7. Controller responds with HTTP 200 OK: { message: 'Logged out from all devices successfully' }.
8. Consequence: All other devices making their next request receive 401 Unauthorized and get their cookies wiped.
```

### Code Blueprint
```javascript
// redis.sessions.store.js
export const deleteAllUserSessions = async (userId) => {
    const sessionIds = await redis.smembers(`user_sessions:${userId}`)

    if (sessionIds && sessionIds.length > 0) {
        // Multi-key batch deletion
        const keysToDelete = sessionIds.map((id) => `session:${id}`)
        await redis.del(...keysToDelete)
    }

    // Delete user's Set key
    await redis.del(`user_sessions:${userId}`)
}

// auth.controller.js
export const logoutAll = catchAsync(async (req, res) => {
    const userId = req.session.userId

    await destroyAllUserSessionsService(userId)

    res.clearCookie('sessionId', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    })

    res.status(200).json({ message: 'Logged out from all devices successfully' })
})
```

---
#### Topics Used:
* Mass session invalidation (Global Logout)
* Redis multi-key batch deletion (`DEL key1 key2 ...`)
* Asynchronous state synchronization across distributed clients
* Comprehensive credential revocation patterns

#### Technology & Packages:
* **`ioredis`** (`smembers`, `del`)
* **`cookie-parser` & Express `res.clearCookie()`**
* **`catchAsync`**

