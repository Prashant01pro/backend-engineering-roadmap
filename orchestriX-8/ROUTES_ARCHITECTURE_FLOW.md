# OrchestriX-8: Complete Routes Architecture & Making Flow Blueprint

> **Master Architecture & Implementation Guide**: A step-by-step blueprint detailing the internal execution pipeline, data flows, edge-case defenses, and underlying engineering principles for every endpoint in **OrchestriX-8**. Use this blueprint to replicate or architect production-grade distributed backend systems.

---

##  Table of Contents

1. [Global Middleware Pipeline & Request Lifecycle](#1-global-middleware-pipeline--request-lifecycle)
2. [Health & System Readiness Routes](#2-health--system-readiness-routes)
3. [Authentication, Sessions & Identity Routes](#3-authentication-sessions--identity-routes)
4. [Job Orchestration, Telemetry & DLQ Routes](#4-job-orchestration-telemetry--dlq-routes)
5. [In-App Notifications & Real-Time SSE Streaming Routes](#5-in-app-notifications--real-time-sse-streaming-routes)

---

## 1. Global Middleware Pipeline & Request Lifecycle

Every HTTP request traverses an ordered defense-in-depth pipeline before hitting feature routers:

```
[ Incoming Request ]
        │
        ▼
1. requestIdMiddleware          ──> Generates or propagates X-Request-ID (UUID v4)
        │
        ▼
2. pinoHttp                     ──> Injects structured JSON request logger bound to req.id
        │
        ▼
3. helmet()                     ──> Enforces OWASP security headers (CSP, HSTS, frameguard, etc.)
        │
        ▼
4. cors()                       ──> Restricts origins, sets credentials: true for hybrid cookies
        │
        ▼
5. express.json({ limit: '10kb' })──> Guards against body payload denial-of-service (DoS)
        │
        ▼
6. cookieParser()               ──> Parses httpOnly accessToken, refreshToken, and sessionId
        │
        ▼
7. generalApiRateLimiter        ──> Sliding-window Redis ZSET rate limiter (100 req/min/IP)
        │
        ▼
8. Feature Routers (/api/v1/...)──> Authenticate, Validate, Controller, Service, Store
        │
        ▼
9. globalErrorHandler           ──> Central AppError formatting, operational error containment
```

---

## 2. Health & System Readiness Routes

### Route: `GET /health/live`
* **Purpose**: Kubernetes / Docker liveness probe to verify Node process is responsive.
* **Middleware**: None
* **Making Flow**:
  1. Return HTTP 200 immediately with uptime and timestamp.
  2. If the event loop is blocked or process died, the container orchestrator fails this probe and restarts the pod.
* **Topics Used**: Container Liveness, Process Uptime, High Availability.
* **Technologies / Packages**: Express.js, `process.uptime()`.

---

### Route: `GET /health/ready`
* **Purpose**: Readiness probe checking whether all downstream dependencies (MongoDB & Redis) are fully ready to accept traffic.
* **Middleware**: None
* **Making Flow**:
  1. Check `mongoose.connection.readyState === 1` (Connected).
  2. Issue `await redis.ping()`. Verify response is `'PONG'`.
  3. If both pass: return HTTP 200 with `{ status: 'ready', database: 'connected', redis: 'connected' }`.
  4. If either fails: return HTTP 503 Service Unavailable so load balancers stop routing traffic here.
* **Topics Used**: Shallow vs Deep Health Checks, Fail-Stop Routing, Dependency Probing.
* **Technologies / Packages**: Mongoose (`readyState`), `ioredis` (`ping`).

---

## 3. Authentication, Sessions & Identity Routes

---

### Route: `POST /api/v1/auth/register`
* **Purpose**: Register a new user account with hashed password and enqueue asynchronous email verification.
* **Middleware Stack**: `registerRateLimiter` $\rightarrow$ `validate(registerSchema)` $\rightarrow$ `register`
* **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "StrongPassword123!"
  }
  ```
* **Making Flow**:
  1. **Rate Limiting**: `registerRateLimiter` enforces max 5 accounts per hour per IP using sliding-window Redis ZSET.
  2. **Schema Validation**: Zod verifies non-empty name, lowercase email, and minimum 10-char password with complexity.
  3. **Duplicate Check**: Query `User.findOne({ email })`. If found, throw `AppError('Email already registered', 409)`.
  4. **Password Hashing**: Mongoose pre-save hook automatically salts and hashes the password with `bcrypt` (12 rounds).
  5. **Verification Token**: Generate 32 crypto random bytes. Hash with SHA-256 for database storage (`verificationToken`), keeping raw token in memory.
  6. **Decoupled Background Email (BullMQ)**: Instead of blocking HTTP response on slow SMTP delivery, enqueue background job:
     ```javascript
     await addJobToQueue({
       type: JOB_TYPES.EMAIL_VERIFICATION,
       payload: { name: user.name, email: user.email, verificationUrl }
     });
     ```
  7. **Response**: Return HTTP 201 Created in `< 10ms` with safe user projection (excluding password).
* **Topics Used**: Password Salting & Hashing, Nonce Token Hashing, Asynchronous Queue Decoupling, Rate Limiting.
* **Technologies / Packages**: `bcrypt`, `crypto`, `zod`, `bullmq`, `mongoose`.

---

### Route: `POST /api/v1/auth/login`
* **Purpose**: Authenticate credentials, establish a multi-device Redis session, and issue hybrid auth cookies.
* **Middleware Stack**: `loginRateLimiter` $\rightarrow$ `validate(loginSchema)` $\rightarrow$ `login`
* **Request Body**:
  ```json
  {
    "email": "jane@example.com",
    "password": "StrongPassword123!"
  }
  ```
* **Making Flow**:
  1. **Brute-Force Guard**: `loginRateLimiter` throttles bad attempts (max 5 per 15 min per `ip:email` combination).
  2. **User Lookup**: Query `User.findOne({ email }).select('+password')`. Throw generic `401 Invalid credentials` if missing (anti-enumeration).
  3. **Hash Comparison**: Compare plaintext password against hashed password via `bcrypt.compare()`.
  4. **Device Fingerprinting**: Extract `browser`, `os`, and `ip` from `req.headers['user-agent']` and `req.ip`.
  5. **Generate Session & Tokens**:
     * Generate `sessionId = crypto.randomUUID()`.
     * Generate cryptographic `refreshToken` and hash it using SHA-256 (`refreshTokenHash`).
     * Generate short-lived JWT `accessToken` (15 min) embedding `userId` and `sessionId`.
  6. **Persist Session in Redis**:
     * Write to Redis string `session:${sessionId}` with 7-day TTL (`EX 604800`): `{ userId, refreshTokenHash, deviceInfo, lastActive }`.
     * Add `sessionId` to user's device set: `SADD user_sessions:${userId} ${sessionId}`.
  7. **Set HttpOnly Cookies**:
     * `accessToken`: 15 min, `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`.
     * `refreshToken`: 7 days, `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`.
     * `sessionId`: 7 days, `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`.
  8. **Response**: Return HTTP 200 with user profile.
* **Topics Used**: Hybrid Authentication, Brute-Force Prevention, Device Fingerprinting, Multi-Key Redis Indexing.
* **Technologies / Packages**: `jsonwebtoken`, `bcrypt`, `crypto`, `ioredis`, `cookie-parser`.

---

### Route: `POST /api/v1/auth/refresh`
* **Purpose**: Refresh Token Rotation (RTR) to issue a new `accessToken` and rotate the `refreshToken` without user re-login.
* **Middleware Stack**: `refresh`
* **Request**: Passed via cookies (`refreshToken`, `sessionId`).
* **Making Flow**:
  1. Extract `incomingRefreshToken` and `incomingSessionId` from cookies.
  2. Fetch `session = await getSession(sessionId)` from Redis. If missing, throw `401 Session expired`.
  3. Hash incoming refresh token with SHA-256. Compare against `session.refreshTokenHash`.
  4. **Breach Kill-Switch (Reuse Detection)**: If hashes don't match, an old/stolen token was replayed. **Immediately delete the entire session from Redis** and throw `403 Security violation: Token reuse detected`.
  5. If valid, rotate:
     * Generate new `newRefreshToken` and hash it.
     * Update Redis session using `KEEPTTL` (preserves remaining 7-day expiry).
     * Generate new JWT `accessToken`.
  6. Set updated cookies on response.
* **Topics Used**: Refresh Token Rotation, Breach Kill-Switch, Replay Attack Defense, Redis `KEEPTTL`.
* **Technologies / Packages**: `jsonwebtoken`, `crypto`, `ioredis`.

---

### Route: `POST /api/v1/auth/logout`
* **Purpose**: Terminate current device session.
* **Middleware Stack**: `authenticate` $\rightarrow$ `logout`
* **Making Flow**:
  1. Retrieve `req.sessionId` (validated by `authenticate` middleware).
  2. Delete session string: `DEL session:${sessionId}` in Redis.
  3. Remove ID from user set: `SREM user_sessions:${userId} ${sessionId}` in Redis.
  4. Clear cookies: `res.clearCookie('accessToken')`, `res.clearCookie('refreshToken')`, `res.clearCookie('sessionId')`.
  5. Return HTTP 200 with `Logout Successful`.
* **Topics Used**: Session Revocation, Set Cleanup, Cookie Eviction.
* **Technologies / Packages**: `ioredis`, `express`.

---

### Route: `GET /api/v1/auth/profile`
* **Purpose**: Retrieve user profile utilizing Cache-Aside pattern.
* **Middleware Stack**: `authenticate` $\rightarrow$ `myprofile`
* **Making Flow**:
  1. Check Redis cache key: `cache:user:profile:${req.user._id}`.
  2. **Cache Hit**: If key exists, attach `X-Cache: HIT` header and return cached JSON in `< 1ms`.
  3. **Cache Miss**: Query MongoDB `User.findById(userId).select('-password')`.
  4. Store in Redis: `SET cache:user:profile:${userId} <JSON> EX 300` (5-minute TTL).
  5. Attach `X-Cache: MISS` header and return HTTP 200.
* **Topics Used**: Cache-Aside Pattern, Eventual Consistency, Cache Hit/Miss Telemetry.
* **Technologies / Packages**: `ioredis`, Mongoose.

---

### Route: `PATCH /api/v1/auth/update-profile` & `PATCH /api/v1/auth/avatar`
* **Purpose**: Update user profile bio / avatar with explicit cache invalidation.
* **Middleware Stack**: `authenticate` $\rightarrow$ (optional `uploadAvatarMiddleware`) $\rightarrow$ controller
* **Making Flow**:
  1. For avatar: Multer buffers file into memory (`req.file.buffer`). Upload buffer to Cloudinary with `crop: 'thumb'`, `gravity: 'face'`. Delete old Cloudinary public ID if present.
  2. Update MongoDB document.
  3. **Explicit Invalidation**: Invalidate Redis cache key `cache:user:profile:${userId}` (`DEL`).
  4. Return updated user object.
* **Topics Used**: Write-Invalidate Cache Pattern, Memory Buffer Uploads, Cloudinary Face Cropping.
* **Technologies / Packages**: `multer`, `cloudinary`, `streamifier`, `ioredis`.

---

### Route: `GET /api/v1/auth/sessions`
* **Purpose**: View all active devices logged into the user's account with deterministic ordering.
* **Middleware Stack**: `authenticate` $\rightarrow$ `getActiveSessions`
* **Making Flow**:
  1. Fetch all session IDs from Redis Set: `SMEMBERS user_sessions:${userId}`.
  2. For each session ID, get payload from Redis string `session:${id}`.
  3. **Self-Healing (Lazy Cleanup)**: If a session key auto-expired from Redis TTL, purge the orphaned ID from the Set (`SREM`).
  4. Map device details and attach `isCurrentDevice: s.sessionId === req.sessionId`.
  5. **Deterministic Sorting**:
     ```javascript
     sessions.sort((a, b) => {
       if (a.isCurrentDevice) return -1;
       if (b.isCurrentDevice) return 1;
       return new Date(b.createdAt) - new Date(a.createdAt);
     });
     ```
  6. Return HTTP 200 with stable array order and consistent ETag.
* **Topics Used**: Redis Sets, Lazy Set Eviction, Deterministic Array Sorting, Multi-Device Security.
* **Technologies / Packages**: `ioredis`, JavaScript Array Sort.

---

### Route: `DELETE /api/v1/auth/sessions/:sessionId` & `DELETE /api/v1/auth/sessions`
* **Purpose**: Remotely terminate a specific session or purge all sessions globally (logout everywhere).
* **Middleware Stack**: `authenticate` $\rightarrow$ `revokeSession` / `revokeAllSessions`
* **Making Flow**:
  1. Single Session: Check session belongs to user. Delete `session:${targetSessionId}` and `SREM user_sessions:${userId}`.
  2. All Sessions: Fetch all IDs via `SMEMBERS user_sessions:${userId}`. Execute atomic multi-key deletion `DEL session:id1 session:id2 ...` and `DEL user_sessions:${userId}`.
* **Topics Used**: Remote Device Revocation, Atomic Bulk Deletion.
* **Technologies / Packages**: `ioredis`.

---

## 4. Job Orchestration, Telemetry & DLQ Routes

---

### Route: `POST /api/v1/jobs`
* **Purpose**: Submit and enqueue a heavy background job with idempotency locking and quota enforcement.
* **Middleware Stack**: `authenticate` $\rightarrow$ `jobCreationRateLimiter` $\rightarrow$ `validate(createJobSchema)` $\rightarrow$ `createJob`
* **Request Body**:
  ```json
  {
    "type": "REPORT_GENERATION",
    "priority": "HIGH",
    "delaySeconds": 0
  }
  ```
* **Making Flow**:
  1. **Quota Guard**: `jobCreationRateLimiter` enforces max 10 jobs per minute per authenticated user using sliding-window ZSET.
  2. **Idempotency Check**: Check header `Idempotency-Key` or compute hash `${userId}:${type}:${JSON.stringify(payload)}`. Query Redis string `idempotency:job:${key}`. If key exists, return existing job (HTTP 200) without duplicate execution.
  3. **Durable Persistence (MongoDB)**: Create MongoDB document with status `QUEUED`, `ownerId`, `type`, and `payload`.
  4. **Queue Dispatch (BullMQ)**: Push task to BullMQ Redis queue `orchestriX_jobs` with priority routing (`1` for HIGH, `2` for NORMAL) and optional delay (`delayMs`).
  5. **Link BullMQ ID**: Save returned `bullJob.id` back to MongoDB record (`job.bullJobId = bullJob.id`).
  6. **Set Idempotency Lock**: Set Redis key `idempotency:job:${key}` with 60-second TTL (`EX 60`).
  7. **Response**: Return HTTP 202 Accepted with `jobId` and `status: 'accepted'`.
* **Topics Used**: Distributed Idempotency Locks, BullMQ Priority Queues, Two-Phase Job Handshake, Sliding Rate Limiting.
* **Technologies / Packages**: `bullmq`, `ioredis`, `zod`, Mongoose.

---

### Route: `GET /api/v1/jobs/dashboard/stats`
* **Purpose**: Retrieve aggregate job counts (total, queued, processing, completed, failed) with 30-second Redis caching.
* **Middleware Stack**: `authenticate` $\rightarrow$ `getDashboardStats`
* **Making Flow**:
  1. Check Redis key `cache:jobs:stats:${userId}`.
  2. On hit: return cached stats with `X-Cache: HIT`.
  3. On miss: run parallel MongoDB aggregation count queries:
     ```javascript
     const [total, queued, processing, completed, failed] = await Promise.all([
       Job.countDocuments({ ownerId }),
       Job.countDocuments({ ownerId, status: JOB_STATUS.QUEUED }),
       Job.countDocuments({ ownerId, status: JOB_STATUS.PROCESSING }),
       Job.countDocuments({ ownerId, status: JOB_STATUS.COMPLETED }),
       Job.countDocuments({ ownerId, status: JOB_STATUS.FAILED })
     ]);
     ```
  4. Cache in Redis for 30s (`EX 30`) and return with `X-Cache: MISS`.
* **Topics Used**: Aggregation Optimization, Short-Lived Dashboard Caching, Parallel DB Execution.
* **Technologies / Packages**: Mongoose (`countDocuments`), `ioredis`.

---

### Route: `GET /api/v1/jobs/failed` (Dead-Letter Queue Inspection)
* **Purpose**: Inspect all permanently failed jobs that exhausted retries.
* **Middleware Stack**: `authenticate` $\rightarrow$ `getFailedJobs`
* **Query Params**: `?page=1&limit=20`
* **Making Flow**:
  1. Filter MongoDB records with `{ ownerId: req.user._id, status: 'FAILED' }`.
  2. Sort descending by `updatedAt: -1` and apply pagination (`skip`, `limit`).
  3. Return failed jobs containing error message, failure timestamp, and attempt counts.
* **Topics Used**: Dead-Letter Queue (DLQ), Error Diagnostics, Pagination.
* **Technologies / Packages**: Mongoose.

---

### Route: `POST /api/v1/jobs/failed/retry-all` (DLQ Bulk Recovery)
* **Purpose**: One-click re-enqueue of all failed jobs once external dependencies recover.
* **Middleware Stack**: `authenticate` $\rightarrow$ `retryAllFailedJobs`
* **Making Flow**:
  1. Query all jobs where `{ ownerId: req.user._id, status: 'FAILED' }`.
  2. If none, return HTTP 200 with `retriedCount: 0`.
  3. Loop through failed jobs:
     * Re-enqueue each job into BullMQ with reset attempt count (`attempts: 3`).
     * Reset MongoDB state: `status = 'QUEUED'`, `progress = 0`, `currentStage = 'Re-queued via Bulk Retry'`, clear errors.
     * Save updated document.
  4. Return HTTP 200 with total re-enqueued count and list of IDs.
* **Topics Used**: Bulk Failure Recovery, State Machine Reset, Resilience Patterns.
* **Technologies / Packages**: `bullmq`, Mongoose.

---

### Route: `GET /api/v1/jobs/:jobId/result` (Artifact Streaming)
* **Purpose**: Stream or download generated CSV reports directly to the user.
* **Middleware Stack**: `authenticate` $\rightarrow$ `getJobResult`
* **Making Flow**:
  1. Find job by ID. Verify `job.ownerId === req.user._id` (IDOR defense).
  2. If `job.status !== 'COMPLETED'`, throw `400 Job is not completed yet`.
  3. Resolve filesystem path: `path.join(process.cwd(), 'artifacts', job.result.fileName)`.
  4. Set headers:
     * `Content-Type: text/csv`
     * `Content-Disposition: attachment; filename="<filename>"`
  5. Create read stream: `fs.createReadStream(filePath).pipe(res)`.
* **Topics Used**: Node Stream Piping, IDOR Prevention, Content-Disposition Header, Large File Transmission.
* **Technologies / Packages**: Node native `fs` streams, Node `path`.

---

## 5. In-App Notifications & Real-Time SSE Streaming Routes

---

### Route: `GET /api/v1/notifications/stream` (Server-Sent Events)
* **Purpose**: Unidirectional real-time event pipeline pushing live multi-stage job progress (0% $\rightarrow$ 100%) and notification alerts.
* **Middleware Stack**: `authenticate` $\rightarrow$ `streamNotification`
* **Making Flow**:
  1. **Configure SSE Headers**:
     ```javascript
     res.writeHead(200, {
       'Content-Type': 'text/event-stream',
       'Cache-Control': 'no-cache, no-transform',
       'Connection': 'keep-alive',
       'X-Accel-Buffering': 'no' // Prevents Nginx response buffering
     });
     ```
  2. **Safe Writer Helper**: Check `!res.writableEnded && !res.destroyed` before writing to prevent `ERR_STREAM_DESTROYED` crashes.
  3. **Send Handshake**: `safeWrite('data: {"type": "CONNECTED"} \n\n')`.
  4. **Register Pub/Sub Listeners**:
     * Notification Listener: Subscribes to `channel:notifications:user`. Pushes `NOTIFICATION` payload when `targetUserId === userId`.
     * Job Progress Listener: Subscribes to `channel:jobs:events`. Pushes `JOB_PROGRESS` payload with `progress` and `stage`.
  5. **Keep-Alive Heartbeat**: Set 25-second interval writing `: keep-alive\n\n` to prevent firewall/proxy timeouts.
  6. **Clean Socket Disposal (`req.on('close')`)**:
     * Clear heartbeat timer.
     * Unsubscribe and remove callback handlers from EventBus handlers array.
     * Do **not** call `res.end()` (socket is already closed by client).
* **Topics Used**: Server-Sent Events (SSE), Event-Driven Architecture, Pub/Sub Bridging, Memory Leak Prevention.
* **Technologies / Packages**: Native Node HTTP Streams, `ioredis` Pub/Sub, Express.

---

### Route: `GET /api/v1/notifications` & `GET /api/v1/notifications/unread-count`
* **Purpose**: List persistent in-app notifications with read status and fetch unread count for badge counters.
* **Middleware Stack**: `authenticate` $\rightarrow$ controller
* **Making Flow**:
  1. Unread count query utilizes compound index `{ userId: 1, readAt: 1, createdAt: -1 }`:
     ```javascript
     const count = await Notification.countDocuments({ userId, readAt: null });
     ```
  2. List notifications query applies pagination (`skip`, `limit`) and filters unread if `?unreadOnly=true`.
  3. Return notifications sorted with unread/newest first.
* **Topics Used**: Compound Index Utilization, Unread Counter Architecture, Pagination.
* **Technologies / Packages**: Mongoose.

---

### Route: `PATCH /api/v1/notifications/read-all` & `PATCH /api/v1/notifications/:id`
* **Purpose**: Mark all or individual notifications as read.
* **Middleware Stack**: `authenticate` $\rightarrow$ controller
* **Making Flow**:
  1. `read-all`: Atomic bulk update `Notification.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } })`.
  2. Individual: Update `{ _id: id, userId }` setting `readAt: new Date()`.
  3. Return updated records and timestamp.
* **Topics Used**: Atomic Multi-Document Updates, Timestamp-Based Read Auditing.
* **Technologies / Packages**: Mongoose (`updateMany`, `findOneAndUpdate`).

---

## 6. Route Summary Reference Card

| Endpoint | Method | Rate Limit Policy | Primary Tech Used | Core Pattern Demonstrated |
|---|---|---|---|---|
| `/health/live` | `GET` | Unlimited | Express | Liveness Probe |
| `/health/ready` | `GET` | Unlimited | Mongoose, ioredis | Dependency Health Readiness |
| `/api/v1/auth/register` | `POST` | 5 / hr / IP | bcrypt, BullMQ, Zod | Decoupled Background Verification |
| `/api/v1/auth/login` | `POST` | 5 / 15m / IP+Email | bcrypt, ioredis, JWT | Hybrid Auth + Multi-Device Tracking |
| `/api/v1/auth/refresh` | `POST` | Unlimited | crypto, ioredis | Refresh Token Rotation + Kill-Switch |
| `/api/v1/auth/logout` | `POST` | General API | ioredis | Targeted Device Revocation |
| `/api/v1/auth/profile` | `GET` | General API | ioredis, Mongoose | Cache-Aside Read Optimization |
| `/api/v1/auth/update-profile` | `PATCH` | General API | ioredis, Mongoose | Explicit Cache Invalidation |
| `/api/v1/auth/sessions` | `GET` | General API | ioredis Sets | Deterministic Device Sorting |
| `/api/v1/auth/sessions/:id` | `DELETE` | General API | ioredis Sets | Remote Device Logout |
| `/api/v1/auth/sessions` | `DELETE` | General API | ioredis Sets | Global Session Purge |
| `/api/v1/auth/avatar` | `PATCH` | General API | Multer, Cloudinary | In-Memory Buffer Streaming |
| `/api/v1/jobs` | `POST` | 10 / min / User | BullMQ, ioredis, Zod | Idempotent Asynchronous Queueing |
| `/api/v1/jobs/dashboard/stats` | `GET` | General API | Mongoose, ioredis | Cached Analytics Aggregation |
| `/api/v1/jobs/failed` | `GET` | General API | Mongoose | Dead-Letter Queue (DLQ) Audit |
| `/api/v1/jobs/failed/retry-all` | `POST` | General API | BullMQ, Mongoose | Bulk Failure Recovery |
| `/api/v1/jobs/:id/result` | `GET` | General API | Node fs streams | CSV Artifact Stream Piping |
| `/api/v1/notifications/stream` | `GET` | General API | SSE, Redis Pub/Sub | Real-Time Multi-Stage Progress Push |
| `/api/v1/notifications` | `GET` | General API | Mongoose | Compound Index Notification Query |
| `/api/v1/notifications/unread-count`| `GET` | General API | Mongoose | Real-Time Badge Count Tally |
| `/api/v1/notifications/read-all` | `PATCH` | General API | Mongoose | Bulk Timestamp Read Updates |

