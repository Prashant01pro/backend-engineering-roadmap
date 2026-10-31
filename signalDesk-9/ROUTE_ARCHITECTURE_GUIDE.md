# SignalDesk — Complete Route Architecture & Making Flow Guide

This document is a comprehensive engineering guide detailing the **making flow of every single endpoint, service, and real-time event** across SignalDesk. 

If you ever need to recreate these architectural patterns in another backend project, follow the step-by-step flows and pattern checklists below.

---

## Table of Contents
1. [Global Middlewares & App Pipeline](#1-global-middlewares--app-pipeline)
2. [Feature 0: Enterprise Health Check & Infrastructure Probes](#feature-0-enterprise-health-check--infrastructure-probes)
2. [Feature 1: Authentication & Multi-Device Sessions](#feature-1-authentication--multi-device-sessions)
3. [Feature 2: Investigation Teams & Memberships](#feature-2-investigation-teams--memberships)
4. [Feature 3: Incidents & Finite State Machine Lifecycle](#feature-3-incidents--finite-state-machine-lifecycle)
5. [Feature 4: Evidence & In-Memory Sharp Image Pipeline](#feature-4-evidence--in-memory-sharp-image-pipeline)
6. [Feature 5: Real-Time Presence & Socket.IO Gateway](#feature-5-real-time-presence--socketio-gateway)
7. [Feature 6: Incident & Direct Chat Subsystem](#feature-6-incident--direct-chat-subsystem)
8. [Feature 7: Conflict-Free Collaborative Notes (Yjs + Hocuspocus CRDT)](#feature-7-conflict-free-collaborative-notes-yjs--hocuspocus-crdt)
9. [Feature 8: Durable Real-Time Notification Subsystem](#feature-8-durable-real-time-notification-subsystem)
10. [Feature 9: Incident Analytics & Redis Cache-Aside Dashboard](#feature-9-incident-analytics--redis-cache-aside-dashboard)
11. [Feature 10: Big Data Search, Keyset Pagination & Profiling](#feature-10-big-data-search-keyset-pagination--profiling)

---

# 1. Global Middlewares & App Pipeline

Every request flowing into SignalDesk passes through this ordered pipeline in `src/app.js`:

```text
Incoming Request
      │
      ▼
1. requestIdMiddleware          ──► Injects unique UUID into req.id and response header 'X-Request-ID'
      │
      ▼
2. pinoHttp                     ──► Structured HTTP request logging tagged with req.id
      │
      ▼
3. helmet                       ──► Security headers (XSS, Clickjacking, MIME-sniffing protection)
      │
      ▼
4. cors                         ──► Strict CORS policy matching env.FRONTEND_URL with credentials: true
      │
      ▼
5. compression                  ──► Response compression (Gzip / Deflate / Brotli)
      │
      ▼
6. express.json & urlencoded    ──► Parses JSON bodies with 10kb guard against large payload DoS
      │
      ▼
7. cookieParser                 ──► Parses cookie header into req.cookies
      │
      ▼
8. generalApiRateLimiter        ──► Redis-backed API rate limiting on /api/v1
      │
      ▼
9. Mounted Feature Routers      ──► /auth, /teams, /incidents, /chat, /notes, /notifications, etc.
      │
      ▼
10. 404 Unhandled Route Handler ──► Catch-all throwing new AppError(..., 404)
      │
      ▼
11. globalErrorHandler          ──► Centralized error transformer separating operational vs programming bugs
```

---

# Feature 0: Enterprise Health Check & Infrastructure Probes

Mounted at: `/health` and `/api/v1/health` (Exempt from general rate limiter for Load Balancers & Kubernetes probes)

### Route 1: `GET /health` or `GET /health/ready` (Readiness Probe)
* **Purpose**: Full infrastructure gatekeeper for Kubernetes and cloud load balancers. Verifies that MongoDB and Redis are reachable, executes ping queries, checks round-trip latency, and inspects process heap usage.
* **Making Flow**:
  1. Inspect Mongoose connection status (`mongoose.connection.readyState === 1`).
  2. If connected, execute deep ping query (`mongoose.connection.db.admin().ping()`) and record duration via `performance.now()`.
  3. Ping Redis server (`await redis.ping()`) and record round-trip latency.
  4. Collect process RSS and Heap usage (`process.memoryUsage()`).
  5. Check Collaboration WebSocket engine status.
  6. If all dependencies pass, respond with HTTP `200 READY`. If any critical service fails, return HTTP `503 DEGRADED` so traffic is temporarily rerouted away from an unhealthy instance.
* **Topics Used**: Infrastructure Probes, Fail-Fast Load Balancing, Round-Trip Latency Profiling, Process Resource Inspection.
* **Packages**: `mongoose`, `ioredis`, `os`, `process`.

### Route 2: `GET /health/live` (Liveness Probe)
* **Purpose**: Heartbeat endpoint verifying the Node.js event loop and OS process are alive and not blocked.
* **Making Flow**:
  1. Capture `process.uptime()`, PID, Node version, and formatted memory stats.
  2. Return immediate HTTP `200 UP`.
* **Topics Used**: Kubernetes Container Liveness, Process Heartbeat, Deadlock Detection.
* **Packages**: `process`.

### Route 3: `GET /health/database` (Dedicated MongoDB Probe)
* **Purpose**: Inspects MongoDB replica set/cluster state, database name, host, and admin ping latency.
* **Making Flow**:
  1. Map `mongoose.connection.readyState` (0=disconnected, 1=connected, 2=connecting, 3=disconnecting).
  2. Execute `admin().ping()`.
  3. Return HTTP 200 with host, database name, and latency in milliseconds.
* **Topics Used**: Database Lifecycle State, Admin Commands, Replica Set Connectivity.
* **Packages**: `mongoose`.

### Route 4: `GET /health/redis` (Dedicated Redis Probe)
* **Purpose**: Validates Redis command processing capability and socket round-trip time.
* **Making Flow**:
  1. Issue `redis.ping()`.
  2. Measure elapsed milliseconds.
  3. Return HTTP 200 with response `PONG` and latency in ms.
* **Topics Used**: In-Memory Cache Monitoring, Connection Latency.
* **Packages**: `ioredis`.

### Route 5: `GET /health/system` (OS & Host Resources)
* **Purpose**: Diagnostic endpoint reporting host architecture, CPU core count, system load average, total vs free RAM, and process memory distribution.
* **Topics Used**: OS Resource Profiling, System Telemetry, Memory Leak Diagnostics.
* **Packages**: `os`, `process`.

---

# Feature 1: Authentication & Multi-Device Sessions

Mounted at: `/api/v1/auth`

---

### Route: `POST /api/v1/auth/register`
* **Purpose**: Register a new user, issue initial hybrid JWT tokens, hash password, and create an active Redis device session.
* **Request Body**: `{ "name": "John Doe", "email": "john@example.com", "password": "Password123!", "bio": "Backend Lead" }`
* **Response**: `201 Created` + `accessToken`, `refreshToken`, and `sessionId` cookies.
* **Step-by-Step Making Flow**:
  1. `registerRateLimiter` enforces anti-spam bounds.
  2. `validate(registerSchema)` validates name length, email format, and password complexity using Zod.
  3. `register` controller invokes `registerService`.
  4. Service verifies email uniqueness (`User.findOne({ email })`); throws `409 Conflict` if taken.
  5. Hashes password using `bcrypt.hash(password, 12)`.
  6. Creates user record in MongoDB (`isVerified: false`).
  7. Generates a cryptographic session ID via `crypto.randomUUID()`.
  8. Generates short-lived Access Token (15m JWT containing `userId` and `sessionId`).
  9. Generates long-lived Refresh Token (7d random string) and hashes it with SHA-256.
  10. Stores session in Redis: `SET session:<sessionId>` with 7-day TTL + adds to `user_sessions:<userId>` Set.
  11. Controller sets `accessToken`, `refreshToken`, and `sessionId` as `httpOnly`, `sameSite: 'lax'`, `secure` cookies.
* **Topics Used**: Password Hashing, Hybrid Auth (JWT + Session Store), Cookie Security, Anti-Spam Rate Limiting.
* **Technology & Packages**: `bcrypt`, `jsonwebtoken`, `crypto`, `ioredis`, `zod`, `cookie-parser`.

---

### Route: `POST /api/v1/auth/login`
* **Purpose**: Authenticate credentials, record device info, create a new device session in Redis, and issue cookies.
* **Request Body**: `{ "email": "john@example.com", "password": "Password123!" }`
* **Response**: `200 OK` + Session cookies.
* **Step-by-Step Making Flow**:
  1. `loginRateLimiter` prevents brute-force credential stuffing.
  2. `validate(loginSchema)` verifies email and password existence.
  3. Service queries user by email explicitly selecting `+password`.
  4. Compares plain password with database hash using `bcrypt.compare()`; throws `401 Unauthorized` on mismatch.
  5. Extracts `deviceInfo` (User-Agent, IP address).
  6. Generates new `sessionId`, Access Token (JWT), and Refresh Token.
  7. Saves session object in Redis under `session:<sessionId>` and registers `sessionId` in `user_sessions:<userId>`.
  8. Returns updated session cookies.
* **Topics Used**: Brute-force Defense, Device Fingerprinting, Credential Validation.
* **Technology & Packages**: `bcrypt`, `jsonwebtoken`, `ioredis`, `express-rate-limit`.

---

### Route: `POST /api/v1/auth/refresh`
* **Purpose**: Refresh Token Rotation (RTR). Issues a new Access Token and rotates the Refresh Token while preserving session lifespan.
* **Request Cookies**: `refreshToken`, `sessionId`
* **Response**: `200 OK` + Rotated cookies.
* **Step-by-Step Making Flow**:
  1. Reads `sessionId` and `refreshToken` from `req.cookies`.
  2. Fetches session from Redis `session:<sessionId>`. If missing, throws `401 Unauthorized`.
  3. Hashes the incoming refresh token with SHA-256 and compares it against `session.refreshTokenHash`.
  4. **Breach Detection Kill-Switch**: If hashes do not match (reuse detected), the server immediately deletes the entire session from Redis (`REVOKE`) and clears cookies to stop stolen token attacks.
  5. If valid, generates a brand new Refresh Token and updates the Redis session using `'KEEPTTL'` to preserve remaining session lifetime.
  6. Issues a new 15-minute Access Token JWT.
* **Topics Used**: Refresh Token Rotation (RTR), Token Reuse Detection, Session Lifespan Preservation.
* **Technology & Packages**: `crypto`, `ioredis`, `jsonwebtoken`.

---

### Route: `POST /api/v1/auth/logout`
* **Purpose**: Terminate current device session and clear cookies.
* **Guards**: `authenticate` middleware.
* **Step-by-Step Making Flow**:
  1. `authenticate` verifies JWT and confirms active Redis session.
  2. Service deletes `session:<sessionId>` from Redis.
  3. Service removes `sessionId` from `user_sessions:<userId>` Set via `redis.srem()`.
  4. Controller clears `accessToken`, `refreshToken`, and `sessionId` cookies with matching options (`path: '/'`).
  5. Returns `200 OK`.
* **Topics Used**: Session Eviction, Cookie Invalidation.
* **Technology & Packages**: `ioredis`, `cookie-parser`.

---

### Route: `GET /api/v1/auth/sessions`
* **Purpose**: Multi-device management dashboard. Lists all active login sessions for the authenticated user.
* **Guards**: `authenticate` middleware.
* **Step-by-Step Making Flow**:
  1. Service fetches all `sessionIds` from Redis Set: `SMEMBERS user_sessions:<userId>`.
  2. Uses Redis pipeline to fetch `MGET session:<id>` in a single round-trip.
  3. Filters out expired sessions and lazy-cleans orphaned keys via `SREM`.
  4. Marks `isCurrentDevice: (session.sessionId === req.sessionId)`.
  5. Pins the current device to index `0` and sorts remaining devices by `lastActive` timestamp.
  6. Returns array of active sessions.
* **Topics Used**: Multi-Device Tracking, Pipeline Batching, Lazy Cleanup.
* **Technology & Packages**: `ioredis`.

---

### Route: `DELETE /api/v1/auth/sessions/:sessionId`
* **Purpose**: Remotely terminate a specific session (e.g., revoking a lost phone).
* **Guards**: `authenticate` middleware.
* **Step-by-Step Making Flow**:
  1. Verifies the target `sessionId` belongs to `user_sessions:<userId>`.
  2. Deletes `session:<sessionId>` from Redis and pulls ID from the user's active set.
  3. Returns `200 OK`.
* **Topics Used**: Remote Device Revocation, Cross-Device Invalidation.
* **Technology & Packages**: `ioredis`.

---

# Feature 2: Investigation Teams & Memberships

Mounted at: `/api/v1/teams`

---

### Route: `POST /api/v1/teams`
* **Purpose**: Create a new investigation team and register the creator as Lead.
* **Guards**: `authenticate`
* **Request Body**: `{ "name": "Backend Engineering", "description": "Core API war room" }`
* **Step-by-Step Making Flow**:
  1. `validate(createTeamSchema)` ensures name length (2–50 chars).
  2. Service generates URL-safe `slug`: `name.toLowerCase().replace(/[^a-z0-9]+/g, '-')`.
  3. Queries `Team.findOne({ $or: [{ name }, { slug }] })`; throws `409 Conflict` if existing.
  4. Creates `Team` in MongoDB with `createdBy: creatorId` and initial member:
     `members: [{ user: creatorId, role: 'lead', joinedAt: new Date() }]`.
  5. Returns `201 Created` with team document.
* **Topics Used**: Slug Generation, Role Assignment, Uniqueness Constraints.
* **Technology & Packages**: `mongoose`, `zod`.

---

### Route: `GET /api/v1/teams`
* **Purpose**: Retrieve all investigation teams the authenticated user belongs to.
* **Guards**: `authenticate`
* **Step-by-Step Making Flow**:
  1. Executes indexed query: `Team.find({ 'members.user': req.user._id })`.
  2. Uses compound index `{'members.user': 1}` to avoid collection scanning.
  3. Populates `members.user` (`name`, `email`, `avatar`) and `createdBy`.
  4. Returns `200 OK` with array of teams.
* **Topics Used**: Subdocument Array Indexing, Foreign Key Population.
* **Technology & Packages**: `mongoose`.

---

### Route: `POST /api/v1/teams/:id/members`
* **Purpose**: Add an investigator to a team (Lead-only action).
* **Guards**: `authenticate`
* **Request Body**: `{ "userId": "<TARGET_USER_ID>", "role": "investigator" }`
* **Step-by-Step Making Flow**:
  1. `validate(addMemberSchema)` verifies target `userId` is a valid 24-hex ObjectId and `role` is in enum `['lead', 'investigator', 'observer']`.
  2. Service fetches team by ID.
  3. Checks requester's role in `team.members`; throws `403 Forbidden` if not `'lead'`.
  4. Verifies target user exists in database (`User.findById(userId)`).
  5. Checks if target user is already in `team.members`; throws `400 Bad Request` if duplicate.
  6. Pushes `{ user: userId, role }` to `team.members` and saves.
  7. Triggers real-time notification: `sendNotificationService({ type: 'TEAM_INVITE', recipient: userId, ... })`.
  8. Returns `200 OK` with updated team.
* **Topics Used**: Role-Based Access Control (RBAC), Subdocument Modification, Event Triggering.
* **Technology & Packages**: `mongoose`, `zod`.

---

### Route: `DELETE /api/v1/teams/:id/members/:userId`
* **Purpose**: Remove a member from a team or allow a member to leave.
* **Guards**: `authenticate`
* **Step-by-Step Making Flow**:
  1. Checks if requester is removing themselves (`targetUserId === requesterId`) OR has `'lead'` role. If neither, throws `403 Forbidden`.
  2. **Last Lead Guard**: If the target member is a `'lead'`, counts total leads remaining. If `leadCount <= 1`, throws `400 Bad Request` ("Cannot remove the last lead").
  3. Filters member out of `team.members` array and saves.
  4. Returns `200 OK`.
* **Topics Used**: Self-Removal vs Admin Revocation, Deadlock/Orphan Prevention Guards.
* **Technology & Packages**: `mongoose`.

---

# Feature 3: Incidents & Finite State Machine Lifecycle

Mounted at: `/api/v1/incidents`

---

### Route: `POST /api/v1/incidents`
* **Purpose**: Create a new incident, generate human-readable ID, record creation audit log, and invalidate dashboard cache.
* **Guards**: `authenticate`
* **Request Body**: `{ "title": "API returning 500", "description": "...", "severity": "CRITICAL", "assignedTeam": "<TEAM_ID>" }`
* **Step-by-Step Making Flow**:
  1. `validate(createIncidentSchema)` enforces title, description, severity enum (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and valid team ID.
  2. Verifies the assigned team exists and creator belongs to that team (`403 Forbidden` if not).
  3. Generates unique incident number: `INC-YYYYMMDD-XXXX` (random 4-digit suffix).
  4. Creates `Incident` record with `status: 'REPORTED'` and initial timeline entry:
     `timeline: [{ action: 'CREATED', performedBy: creatorId, details: { initialSeverity } }]`.
  5. Deterministically purges analytics cache: `invalidateAnalyticsCache(assignedTeam)`.
  6. Returns `201 Created`.
* **Topics Used**: Sequential/Timestamped Identifiers, Audit Timeline Logging, Cache Invalidation.
* **Technology & Packages**: `mongoose`, `zod`.

---

### Route: `PATCH /api/v1/incidents/:id/status`
* **Purpose**: Progress an incident through its strict Finite State Machine (FSM) lifecycle.
* **Guards**: `authenticate`
* **Request Body**: `{ "status": "ACKNOWLEDGED", "reason": "Investigating logs" }`
* **Step-by-Step Making Flow**:
  1. `validate(updateIncidentStatusSchema)` verifies valid target status enum.
  2. Fetches incident by ID; throws `404` if not found.
  3. **Redundancy Guard**: If `currentStatus === nextStatus`, throws `400 Bad Request`.
  4. **FSM Transition Enforcement**:
     ```javascript
     const VALID_TRANSITIONS = {
         REPORTED: ['ACKNOWLEDGED'],
         ACKNOWLEDGED: ['INVESTIGATING'],
         INVESTIGATING: ['RESOLVED'],
         RESOLVED: ['CLOSED', 'INVESTIGATING'],
         CLOSED: ['INVESTIGATING']
     };
     ```
     If `nextStatus` is not in allowed array, rejects with `400 Bad Request` ("Invalid status transition from X to Y").
  5. **Lead-Only Guard**: If moving to `CLOSED` or reopening from `CLOSED`, verifies user has `'lead'` role in the assigned team.
  6. Sets timestamps: if `RESOLVED`, sets `resolvedAt = new Date()`; if `CLOSED`, sets `closedAt = new Date()`.
  7. Appends audit entry to `incident.timeline` with `{ action: 'STATUS_CHANGED', from, to, reason }`.
  8. Saves incident.
  9. Deterministically purges analytics cache: `invalidateAnalyticsCache(incident.assignedTeam)`.
  10. Returns `200 OK`.
* **Topics Used**: Finite State Machines (FSM), State Transition Auditing, Business Rule Guards.
* **Technology & Packages**: `mongoose`, `zod`.

---

### Route: `PATCH /api/v1/incidents/:id/assign`
* **Purpose**: Assign an on-call investigator as lead handler for an incident.
* **Guards**: `authenticate`
* **Request Body**: `{ "assignedTo": "<USER_ID>" }`
* **Step-by-Step Making Flow**:
  1. `validate(assignIncidentSchema)` ensures valid target user ObjectId.
  2. Verifies requester has `'lead'` or `'investigator'` role in the incident's team.
  3. Verifies assignee is a member of the incident's team.
  4. Updates `incident.assignedTo = assigneeId`.
  5. Records timeline entry: `{ action: 'ASSIGNED', performedBy: requesterId }`.
  6. Dispatches durable notification to assignee: `sendNotificationService({ type: 'INCIDENT_ASSIGNED', recipient: assigneeId, ... })`.
  7. Returns `200 OK` with populated assignee.
* **Topics Used**: Task Assignment RBAC, Real-Time Push Notification Integration.
* **Technology & Packages**: `mongoose`.

---

### Route: `POST /api/v1/incidents/:id/comments`
* **Purpose**: Post an investigation comment / finding to an incident.
* **Guards**: `authenticate`
* **Request Body**: `{ "content": "Database pool saturated at 100%" }`
* **Step-by-Step Making Flow**:
  1. `validate(addCommentSchema)` verifies content is non-empty and under 1,000 characters.
  2. Pushes comment into `incident.comments` subdocument array with `user: req.user._id`.
  3. Appends timeline entry: `{ action: 'COMMENT_ADDED', details: { preview } }`.
  4. Saves incident and returns `201 Created` with populated comment author.
* **Topics Used**: Nested Subdocument Mutation, Micro-Auditing.
* **Technology & Packages**: `mongoose`, `zod`.

---

# Feature 4: Evidence & In-Memory Sharp Image Pipeline

Mounted at: `/api/v1`

---

### Route: `POST /api/v1/incidents/:incidentId/evidence`
* **Purpose**: Ingest error screenshots, validate magic bytes, generate WebP thumbnails & display variants with Sharp, and stream to Cloudinary CDN.
* **Guards**: `authenticate`, `uploadEvidenceMiddleware` (Multer RAM storage, 10MB limit), `validateImageMagicBytes`.
* **Request Form-Data**: `evidence` (File), `caption` (Text).
* **Response**: `201 Created` with evidence metadata.
* **Step-by-Step Making Flow**:
  1. `uploadEvidenceMiddleware` buffers the incoming file in RAM (`multer.memoryStorage()`).
  2. `validateImageMagicBytes` reads the binary header bytes using `fileTypeFromBuffer(req.file.buffer)`. If detected MIME is not `image/jpeg`, `image/png`, or `image/webp`, rejects with `400 Bad Request` regardless of client filename extension.
  3. Controller passes `fileBuffer` to `uploadEvidenceService`.
  4. Service verifies user belongs to the incident's team.
  5. **Sharp Pipeline A (Display Variant)**:
     - `sharp(fileBuffer).rotate()` (auto-orients based on EXIF before stripping)
     - `.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })`
     - `.webp({ quality: 80 })` (converts to modern, compressed WebP)
     - `.toBuffer()` (strips GPS/camera metadata)
  6. **Sharp Pipeline B (Thumbnail Variant)**:
     - `sharp(fileBuffer).rotate().resize({ width: 200, height: 200, fit: 'cover' }).webp({ quality: 80 }).toBuffer()`
  7. **Concurrent Cloudinary Upload**:
     - `Promise.all([ uploadBufferToCloudinary(displayBuffer), uploadBufferToCloudinary(thumbnailBuffer) ])`
     - Streams buffers to Cloudinary via `streamifier.createReadStream().pipe(uploadStream)`.
  8. Saves metadata document in MongoDB (`Evidence` model) with dimensions, URLs, and public IDs.
  9. Records upload entry in `incident.timeline`.
  10. Returns `201 Created`.
* **Topics Used**: In-Memory Media Buffering, Binary Magic-Byte Sniffing, EXIF Sanitization, Dual-Variant Image Processing, Stream Uploads.
* **Technology & Packages**: `multer`, `file-type`, `sharp`, `cloudinary`, `streamifier`.

---

### Route: `DELETE /api/v1/evidence/:evidenceId`
* **Purpose**: Delete evidence record and purge assets from Cloudinary CDN.
* **Guards**: `authenticate`
* **Step-by-Step Making Flow**:
  1. Fetches evidence by ID; throws `404` if not found.
  2. Verifies requester is the uploader OR a team lead (`403 Forbidden` otherwise).
  3. Calls `cloudinary.uploader.destroy()` concurrently for both `displayPublicId` and `thumbnailPublicId`.
  4. Deletes `Evidence` record from MongoDB.
  5. Returns `200 OK`.
* **Topics Used**: Cascading Cloud Storage Purge, Asset Ownership Verification.
* **Technology & Packages**: `cloudinary`, `mongoose`.

---

# Feature 5: Real-Time Presence & Socket.IO Gateway

Gateway: `ws://localhost:3000`

---

### Handshake Authentication: `socketAuthMiddleware`
* **Purpose**: Authenticate WebSocket connections before allowing connection establishment.
* **Step-by-Step Making Flow**:
  1. Extracts token from `socket.handshake.auth.token` OR parsed `socket.handshake.headers.cookie`.
  2. Verifies JWT signature using `jwt.verify(token, ACCESS_TOKEN_SECRET)`.
  3. Verifies active session in Redis: `getSession(decoded.sessionId)`.
  4. Fetches user from MongoDB (`select('name email role avatar')`).
  5. Attaches `socket.user` and `socket.sessionId` directly to socket instance.
  6. Calls `next()`.
* **Topics Used**: WebSocket Handshake Authentication, Multi-Transport Token Extraction.
* **Technology & Packages**: `socket.io`, `jsonwebtoken`, `ioredis`.

---

### Lifecycle: Multi-Tab Connection & Disconnect
* **Purpose**: Track user presence accurately across multiple browser tabs using Redis Sets.
* **Step-by-Step Making Flow**:
  1. On connection, user joins private room `user:<userId>`.
  2. `trackSocketConnect(userId, socket.id)` executes:
     - `SADD presence:user_sockets:<userId> <socket.id>`
     - Checks `SCARD presence:user_sockets:<userId>`. If count === 1 (first tab opened), user just came **ONLINE**.
     - Broadcasts `presence:status` (`{ userId, status: 'online' }`) to all clients.
  3. On disconnect:
     - `SREM presence:user_sockets:<userId> <socket.id>`.
     - Checks remaining count via `SCARD`.
     - **Multi-Tab Check**: If count > 0, user still has other tabs open ➔ do nothing.
     - If count === 0 (last tab closed), user is **OFFLINE**:
       * Updates durable `lastSeen: new Date()` in MongoDB `User` model.
       * Broadcasts `presence:status` (`{ userId, status: 'offline', lastSeen }`).
* **Topics Used**: Multi-Tab Presence Accounting, Atomic Set Tracking, Durable Last-Seen Persistence.
* **Technology & Packages**: `ioredis`, `socket.io`, `mongoose`.

---

### Ephemeral Events: `typing:start` & `typing:stop`
* **Purpose**: Real-time typing awareness scoped to an incident room without database overhead.
* **Step-by-Step Making Flow**:
  1. Client emits `typing:start` with `{ incidentId }`.
  2. Clears any existing timeout for `${incidentId}:${userId}` in `typingTimers` Map.
  3. Broadcasts to other users in room: `socket.to('incident:' + incidentId).emit('typing:status', { isTyping: true })`.
  4. Starts 4-second safety `setTimeout`: if client disconnects or ceases typing without sending stop, automatically broadcasts `isTyping: false` and purges timer key.
  5. `typing:stop` explicitly clears timer and broadcasts `isTyping: false`.
* **Topics Used**: Ephemeral State Broadcasting, Server-Side Leaky Timer Protection.
* **Technology & Packages**: `socket.io`, native `Map` & `setTimeout`.

---

# Feature 6: Incident & Direct Chat Subsystem

Mounted at: `/api/v1/chat` and Socket.IO on Port 3000

---

### Event: `message:send` (with Acknowledgement)
* **Purpose**: Persist-then-broadcast message delivery with idempotency retry protection.
* **Payload**: `{ conversationId, content, messageType, evidenceId, clientTempId }`
* **Step-by-Step Making Flow**:
  1. Handler verifies sender is a participant of the conversation.
  2. **Idempotency Guard**: Checks if `clientTempId` from this sender already exists in the conversation. If so, returns existing message to safely prevent duplicate submissions on network retries.
  3. Creates `Message` document in MongoDB with initial `readBy: [{ user: senderId, readAt: new Date() }]`.
  4. Updates parent conversation's `lastMessage` and `lastMessageAt`.
  5. **Acknowledgement**: Invokes client's callback: `ackCallback({ status: 'ok', data: message })`.
  6. **Broadcast**: Emits `message:new` to the conversation room: `io.to('conversation:' + conversationId).emit(...)`.
* **Topics Used**: Persist-Then-Broadcast Pattern, Network Retry Idempotency, Socket Acknowledgements.
* **Technology & Packages**: `socket.io`, `mongoose`.

---

### Route: `GET /api/v1/chat/conversations/:conversationId/messages`
* **Purpose**: Keyset / Cursor-paginated message history retrieval.
* **Query Params**: `before` (ISO date cursor), `limit` (default: 30).
* **Step-by-Step Making Flow**:
  1. Verifies requesting user is an authorized participant in the conversation (`403 Forbidden` if not).
  2. Builds query: `{ conversation: conversationId }`.
  3. If `before` cursor is present: adds `{ createdAt: { $lt: new Date(before) } }`.
  4. Executes `Message.find(query).sort({ createdAt: -1 }).limit(limit).populate(...)`.
  5. Returns array in chronological order (`messages.reverse()`).
* **Topics Used**: Keyset / Cursor Pagination, Reverse Chronological Fetching.
* **Technology & Packages**: `mongoose`.

---

# Feature 7: Conflict-Free Collaborative Notes (Yjs + Hocuspocus CRDT)

Gateway: `ws://localhost:1234` | Metadata REST: `/api/v1`

---

### Route: `GET /api/v1/incidents/:incidentId/notes`
* **Purpose**: Fetch or initialize the incident investigation note metadata and obtain Hocuspocus WebSocket connection credentials.
* **Guards**: `authenticate`
* **Response**: `200 OK` with `note` metadata and `collaboration: { serverUrl, documentName }`.
* **Step-by-Step Making Flow**:
  1. Verifies user belongs to incident's assigned team.
  2. Searches for existing `Note.findOne({ incident: incidentId })`.
  3. If not found, generates deterministic document key: `incident:<incidentId>:notes:<noteId>`.
  4. Creates `Note` metadata record in MongoDB.
  5. Returns metadata and connection parameters:
     ```json
     {
       "serverUrl": "ws://localhost:1234",
       "documentName": "incident:6ae...:notes:672..."
     }
     ```
* **Topics Used**: Document Initialization, Gateway Credential Distribution.
* **Technology & Packages**: `mongoose`.

---

### Hocuspocus Hook: `onAuthenticate`
* **Purpose**: Authenticate collaborative WebSocket connections on Port 1234.
* **Step-by-Step Making Flow**:
  1. Hocuspocus intercepts incoming WebSocket handshake.
  2. Extracts token and `documentName`.
  3. Verifies JWT with `ACCESS_TOKEN_SECRET` and checks active session in Redis.
  4. Parses `documentName` format: `incident:<incidentId>:notes:<noteId>`.
  5. Verifies incident exists and user belongs to incident's team.
  6. Returns authenticated user context attached to the connection.
* **Topics Used**: Binary WebSocket Authentication, Context Injection.
* **Technology & Packages**: `@hocuspocus/server`, `jsonwebtoken`, `ioredis`.

---

### Hocuspocus Hook: `onLoadDocument` & `onStoreDocument`
* **Purpose**: Load initial CRDT state vector from MongoDB and debounced auto-save compiled binary state.
* **Step-by-Step Making Flow**:
  1. **On Load**:
     - Hocuspocus executes `onLoadDocument({ documentName, document })`.
     - Queries `CollaborativeDocument.findOne({ documentName })`.
     - If binary `state` exists, calls `Y.applyUpdate(document, new Uint8Array(doc.state))`.
     - If brand new, initializes default markdown template: `# Incident Investigation Document...`.
  2. **On Store**:
     - When users edit, Yjs emits updates. Hocuspocus debounces saves (3s inactivity, max 10s under continuous typing).
     - Compiles full Yjs state into binary buffer: `Buffer.from(Y.encodeStateAsUpdate(document))`.
     - Upserts into MongoDB `collaborativedocuments` collection:
       `findOneAndUpdate({ documentName }, { $set: { state }, $inc: { snapshotVersion: 1 } })`.
     - Updates parent `Note` metadata (`lastUpdatedBy: context.user._id`).
* **Topics Used**: CRDT Binary State Vectors, Debounced Persistence, Non-Locking Concurrent Merges.
* **Technology & Packages**: `yjs`, `@hocuspocus/server`, `mongoose`.

---

# Feature 8: Durable Real-Time Notification Subsystem

Mounted at: `/api/v1/notifications`

---

### Internal Service: `sendNotificationService`
* **Purpose**: Persist notification to MongoDB first, then push to the user's private socket room.
* **Step-by-Step Making Flow**:
  1. Prevents self-notifications (`if (recipient === actor) return`).
  2. Creates `Notification` in MongoDB with `isRead: false`.
  3. Populates actor details (`name`, `email`, `avatar`).
  4. Retrieves Socket.IO instance via singleton `getIO()`.
  5. Emits `notification:new` directly to private room: `io.to('user:' + recipient).emit(...)`.
  6. If recipient is offline, the notification safely remains in MongoDB.
* **Topics Used**: Decoupled Event-Driven Notifications, Persist-First Durability, Private Socket Rooms.
* **Technology & Packages**: `mongoose`, `socket.io`.

---

### Route: `GET /api/v1/notifications`
* **Purpose**: Retrieve paginated notification history with unread filtering.
* **Query Params**: `page`, `limit`, `unreadOnly`.
* **Step-by-Step Making Flow**:
  1. Constructs filter: `{ recipient: req.user._id }`. If `unreadOnly=true`, adds `isRead: false`.
  2. Executes `find()`, `countDocuments(filter)`, and `countDocuments({ recipient, isRead: false })` concurrently using `Promise.all`.
  3. Uses compound index `{ recipient: 1, isRead: 1, createdAt: -1 }` for index-only resolution.
  4. Returns `200 OK` with notifications array, unread badge count, and pagination info.
* **Topics Used**: Compound Index Optimization, Concurrent Database Counting.
* **Technology & Packages**: `mongoose`.

---

### Route: `PATCH /api/v1/notifications/:id/read` & `PATCH /api/v1/notifications/mark-all-read`
* **Purpose**: Mark individual or all notifications as read.
* **Step-by-Step Making Flow**:
  1. For single: updates `isRead: true, readAt: new Date()` matching `{ _id: id, recipient: userId }`.
  2. For all: executes `Notification.updateMany({ recipient: userId, isRead: false }, { $set: { isRead: true, readAt: new Date() } })`.
  3. Returns `200 OK`.
* **Topics Used**: Atomic Batch Updates, Ownership Scoping.
* **Technology & Packages**: `mongoose`.

---

# Feature 9: Incident Analytics & Redis Cache-Aside Dashboard

Mounted at: `/api/v1/analytics`

---

### Route: `GET /api/v1/analytics/incidents`
* **Purpose**: High-performance operational dashboard metrics computed via a single-pass MongoDB `$facet` aggregation and cached in Redis.
* **Query Params**: `teamId` (optional).
* **Headers Returned**: `X-Cache-Source: cache` OR `X-Cache-Source: database`.
* **Step-by-Step Making Flow**:
  1. Generates cache key: `analytics:stats:team:<teamId || 'global'>`.
  2. **Cache Check**: Queries Redis `redis.get(cacheKey)`.
     - If HIT: logs debug, sets `X-Cache-Source: cache`, and returns JSON instantly (~2ms).
  3. **Cache Miss**: Logs debug and executes single-pass `$facet` aggregation in MongoDB:
     - **overview facet**: groups total, open (`$cond` status in `REPORTED`, `ACKNOWLEDGED`, `INVESTIGATING`), critical, and resolved counts.
     - **bySeverity facet**: `$group` count by `$severity`.
     - **byStatus facet**: `$group` count by `$status`.
     - **resolutionMetrics facet**: filters `resolvedAt != null`, calculates duration `resolvedAt - createdAt` in milliseconds, and calculates `$avg`, `$min`, `$max`.
  4. Formats MTTR into minutes: `Math.round(avgResolutionMs / (1000 * 60))`.
  5. Saves formatted output in Redis with 15-minute TTL (`EX 900`).
  6. Sets header `X-Cache-Source: database` and returns `200 OK`.
* **Topics Used**: Cache-Aside Pattern, Single-Pass Multi-Faceted Aggregations (`$facet`), Arithmetic Date Differencing.
* **Technology & Packages**: `ioredis`, `mongoose`.

---

### Helper: `invalidateAnalyticsCache(teamId)`
* **Purpose**: Deterministic cache invalidation triggered on incident mutations.
* **Step-by-Step Making Flow**:
  1. Triggered inside `createIncidentService` and `updateIncidentStatusService`.
  2. Executes atomic Redis pipeline:
     - `pipeline.del('analytics:stats:team:global')`
     - `pipeline.del('analytics:stats:team:' + teamId)`
  3. Guarantees dashboards never display stale counts after status transitions.
* **Topics Used**: Write-Through / Event-Driven Cache Invalidation, Pipeline Atomicity.
* **Technology & Packages**: `ioredis`.

---

# Feature 10: Big Data Search, Keyset Pagination & Profiling

Mounted at: `/api/v1/search`

---

### CLI Script: `src/features/search/seeds/seedIncidents.js`
* **Purpose**: High-volume deterministic seeder generating 1,000 to 100,000+ realistic incidents.
* **Execution**: `SEED_COUNT=10000 node src/features/search/seeds/seedIncidents.js`
* **Step-by-Step Making Flow**:
  1. Connects directly to MongoDB.
  2. Fetches existing team and user IDs.
  3. Generates synthetic records with realistic status distributions, randomized dates between 2026-01-01 and present, and resolution timestamps for resolved items.
  4. Batches inserts into chunks of 1,000 records (`Incident.insertMany(batch)`) to prevent Node.js heap memory exhaustion.
  5. Disconnects and exits.
* **Topics Used**: High-Volume Data Seeding, Batched Bulk Inserts, Memory Heap Management.
* **Technology & Packages**: `mongoose`.

---

### Route: `GET /api/v1/search/cursor` (Keyset / Cursor Pagination)
* **Purpose**: $O(1)$ constant-time search pagination using Base64 encoded `(createdAt, _id)` range queries.
* **Query Params**: `cursor`, `limit` (max 100), `q` (title search), `status`, `severity`, `teamId`, `from`, `to`.
* **Headers Returned**: `X-Response-Time-Ms`.
* **Step-by-Step Making Flow**:
  1. Constructs filter from query parameters (regex title search, dates, status, severity).
  2. If `cursor` is provided:
     - Decodes Base64 string into `{ createdAt, id }`.
     - Adds compound boundary condition:
       ```javascript
       query.$or = [
           { createdAt: { $lt: new Date(decoded.createdAt) } },
           { createdAt: new Date(decoded.createdAt), _id: { $lt: new ObjectId(decoded.id) } }
       ];
       ```
  3. Queries `Incident.find(query).sort({ createdAt: -1, _id: -1 }).limit(limit + 1)`.
  4. Checks if `incidents.length > limit` to determine `hasNextPage`.
  5. If `hasNextPage` is true, encodes cursor for the 20th item:
     `nextCursor = Buffer.from(JSON.stringify({ createdAt: doc.createdAt, id: doc._id })).toString('base64')`.
  6. Measures execution duration via `performance.now()` and returns response.
* **Topics Used**: Keyset / Cursor Pagination, Stable Tie-Breaker Ordering, Opaque Base64 Cursors.
* **Technology & Packages**: `mongoose`.

---

### Route: `GET /api/v1/search/offset` (Traditional Pagination for Benchmarks)
* **Purpose**: Classic `skip` / `limit` pagination used to demonstrate performance degradation at high offsets.
* **Query Params**: `page`, `limit`, filters.
* **Step-by-Step Making Flow**:
  1. Computes `skip = (page - 1) * limit`.
  2. Executes `Incident.find().skip(skip).limit(limit)` and `countDocuments()` via `Promise.all`.
  3. Measures time via `performance.now()` and returns total pages and data.
* **Topics Used**: Offset Pagination, Performance Degradation Demonstrations.
* **Technology & Packages**: `mongoose`.

---

### Route: `GET /api/v1/search/explain` (Execution Plan Profiler)
* **Purpose**: Inspect MongoDB query planner and execution statistics.
* **Query Params**: Same filters as search (`status`, `severity`, `q`).
* **Step-by-Step Making Flow**:
  1. Builds query filter.
  2. Executes `Incident.find(query).limit(20).explain('executionStats')`.
  3. Extracts `winningPlan.stage`, `isIndexScan` (`stage === 'IXSCAN'`), `isCollectionScan` (`stage === 'COLLSCAN'`), `totalDocsExamined`, `nReturned`, and `executionTimeMillis`.
  4. Returns metrics JSON verifying compound index utilization.
* **Topics Used**: Database Index Profiling, Execution Plan Analysis (`explain`), Index Scan Verification.
* **Technology & Packages**: `mongoose`.

---

# Summary Checklist for Future Projects

| Feature | Key Pattern | Primary Packages |
| :--- | :--- | :--- |
| **Auth** | Hybrid Access Token (JWT) + Stateful Redis Device Sessions | `jsonwebtoken`, `bcrypt`, `ioredis` |
| **Teams** | Subdocument Array Roles (`lead`, `investigator`, `observer`) | `mongoose`, `zod` |
| **Incidents** | Strict Finite State Machine (FSM) + Append-only Audit Timeline | `mongoose`, `zod` |
| **Evidence** | In-Memory Buffer + Magic Bytes + Dual-Variant WebP Conversion | `multer`, `file-type`, `sharp`, `cloudinary` |
| **Presence** | Multi-Tab Redis Sets + Leaky Timeout Typing Indicators | `socket.io`, `ioredis` |
| **Chat** | Persist-Then-Broadcast + Keyset Cursor Pagination + ACK | `socket.io`, `mongoose` |
| **Notes** | Real-Time Conflict-Free CRDTs + Debounced Binary BSON Saves | `yjs`, `@hocuspocus/server`, `mongoose` |
| **Alerts** | Durable Persist-First Engine + Private Socket Rooms (`user:<id>`) | `mongoose`, `socket.io` |
| **Analytics** | Cache-Aside + Single-Pass `$facet` MTTR Aggregation + Event Invalidation | `ioredis`, `mongoose` |
| **Search** | Big Data Batched Seeder + Cursor Keyset Pagination + `.explain()` Profiling | `mongoose` |

