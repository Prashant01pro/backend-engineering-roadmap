#  SecureVault — Complete Route-by-Route Making Flow & Architecture Blueprint

> This reference manual documents the **exact architecture, execution lifecycle, database queries, security considerations, topics, and packages** for every route in SecureVault. Use this blueprint as a master template whenever constructing production-ready, security-hardened REST APIs in future projects.

---

##  Table of Contents
1. [The 7-Tier Request Lifecycle Pipeline](#the-7-tier-request-lifecycle-pipeline)
2. [Module 1: Authentication & Multi-Device Sessions (`/api/v1/auth`)](#1-authentication--multi-device-sessions-apiv1auth)
3. [Module 2: User Profile & Media Avatar (`/api/v1/users`)](#2-user-profile--media-avatar-apiv1users)
4. [Module 3: Private Document Management System (`/api/v1/documents`)](#3-private-document-management-system-apiv1documents)
5. [Module 4: Secure File Sharing & Access Grants (`/api/v1/shares`)](#4-secure-file-sharing--access-grants-apiv1shares)
6. [Module 5: Infrastructure & Observability (`/health`)](#5-infrastructure--observability-health)

---

##  The 7-Tier Request Lifecycle Pipeline

Every route in SecureVault follows an isolated, predictable 7-tier pipeline:

```
[HTTP Request]
     │
     ▼
1. Correlation Guard    (requestIdMiddleware attaches unique X-Request-ID for distributed tracing)
     │
     ▼
2. Rate-Limiting Guard  (createRedisRateLimiter increments atomic Redis counter; blocks with 429)
     │
     ▼
3. Security Headers     (Helmet nosniff, CORS origin validation, JSON 10kb body parser)
     │
     ▼
4. Auth & Session Guard (authenticate verifies JWT + verifies active Redis device session)
     │
     ▼
5. Validation Guard     (validate(schema) validates Zod rules, magic-bytes, or file boundaries)
     │
     ▼
6. Controller Layer     (catchAsync wrapper; translates HTTP parameters; delegates to service)
     │
     ▼
7. Service & Storage    (Business logic, ownership verification, MongoDB, Redis, and Cloudinary)
```

---

## 1. Authentication & Multi-Device Sessions (`/api/v1/auth`)

---

### Route 1.1: Register User
- **Method & Path**: `POST /api/v1/auth/register`
- **Access**: Public
- **Rate Limit**: `registerRateLimiter` (Max 5 accounts per hour per IP)
- **Description**: Registers a new user, enforces strong password policy, creates an initial multi-device session in Redis, and issues dual tokens.

####  Step-by-Step Making Flow:
1. **Correlation & Rate Limiting**: `requestIdMiddleware` generates `X-Request-ID`. `registerRateLimiter` increments `ratelimit:auth_register:ip:<ip>` in Redis. If count $> 5$, aborts with `429 Too Many Requests`.
2. **Schema Validation**: `validate(registerSchema)` parses `req.body` using Zod:
   - `name`: String, 2–50 chars.
   - `email`: Normalized lowercase email string.
   - `password`: Enforces $\ge 10$ chars, uppercase, lowercase, digit, and special character.
3. **Duplicate Prevention**: Service runs `User.findOne({ email })`. If user exists, throws `409 Conflict`.
4. **Password Hashing**: Salts and hashes plaintext password with `bcrypt.hash(password, 12)`.
5. **Database Creation**: Creates user record in MongoDB via `User.create()`.
6. **Device Fingerprinting & Redis Session**:
   - Generates `sessionId` via `crypto.randomUUID()`.
   - Generates raw 40-byte refresh token via `crypto.randomBytes(40).toString('hex')`.
   - Hashes refresh token with SHA-256 for storage: `crypto.createHash('sha256').update(rawToken).digest('hex')`.
   - Extracts device info (`User-Agent` and `req.ip`).
   - Persists session in Redis at `session:<sessionId>` with 7-day TTL (`EX: 604800`) and adds to user's set `user_sessions:<userId>`.
7. **Token Issuance & Cookies**:
   - Signs 15-minute JWT Access Token containing `{ userId, email, sessionId }`.
   - Attaches `accessToken`, `refreshToken`, and `sessionId` as `httpOnly`, `sameSite: 'lax'`, `secure` cookies.
   - Responds with `201 Created` and public user DTO.

####  Topics Used:
* Password Hashing & Salt Rounds
* Zod Runtime Type Validation & Password Policies
* Dual-Token Authentication Architecture
* Device Fingerprinting & Fingerprint Parsing
* High-Entropy Token Generation (`crypto.randomBytes`)
* Atomic Distributed Rate Limiting

####  Technology & Packages Used:
* `express`
* `bcrypt`
* `zod`
* `ioredis`
* Node native `crypto`
* `jsonwebtoken`
* `cookie-parser`

---

### Route 1.2: Login User
- **Method & Path**: `POST /api/v1/auth/login`
- **Access**: Public
- **Rate Limit**: `loginRateLimiter` (Max 5 attempts per 15 min per IP + Email)
- **Description**: Verifies credentials, prevents NoSQL injection, generates a new device session in Redis, and issues tokens.

####  Step-by-Step Making Flow:
1. **Brute-Force Rate Limiting**: `loginRateLimiter` keys on `ratelimit:auth_login:ip:<ip>:email:<email>`. Stops targeted credential stuffing.
2. **Schema Validation**: `validate(loginSchema)` verifies `email` format and guarantees `password` is a primitive string (mitigating NoSQL `$ne` injection).
3. **User Retrieval**: Queries MongoDB `User.findOne({ email }).select('+password')`. If user does not exist, throws `401 Invalid credentials`.
4. **Password Verification**: Calls `bcrypt.compare(password, user.password)`. If false, throws `401 Invalid credentials`.
5. **New Device Session Generation**:
   - Generates new `sessionId` and raw 40-byte `refreshToken`.
   - Hashes refresh token with SHA-256.
   - Creates new device session object in Redis with 7-day expiration.
   - Adds `sessionId` to `user_sessions:<userId>` in Redis.
6. **Token Issuance**: Signs 15-minute JWT Access Token with `sessionId`. Sets secure HTTP-only cookies.
7. **Response**: Responds with `200 OK` and user summary.

####  Topics Used:
* Defense Against NoSQL Operator Injection
* Brute-Force Rate Limiting (IP + Normalized Email Identity)
* Generic Error Messages (Preventing Username/Email Enumeration)
* Bcrypt Constant-Time Comparison
* Multi-Device Session Indexing

####  Technology & Packages Used:
* `express`, `bcrypt`, `zod`, `ioredis`, `crypto`, `jsonwebtoken`, `cookie-parser`

---

### Route 1.3: Refresh Access Token (Token Rotation)
- **Method & Path**: `POST /api/v1/auth/refresh`
- **Access**: Public (Cookie/Body Token Bearer)
- **Rate Limit**: `generalApiRateLimiter`
- **Description**: Implements Refresh Token Rotation (RTR) with Token-Reuse Breach Detection.

####  Step-by-Step Making Flow:
1. **Token Ingestion**: Extracts `refreshToken` and `sessionId` from HTTP-only cookies or request body. If missing, throws `401 Unauthorized`.
2. **Redis Session Lookup**: Retrieves session data from Redis: `redis.get('session:<sessionId>')`. If missing/expired, throws `401 Session expired`.
3. **Cryptographic Hash Verification**: Hashes incoming refresh token with SHA-256 and compares against `session.refreshTokenHash`.
4. **Token Reuse Detection (Kill-Switch)**:
   - If incoming hash does NOT match stored hash, **a replay attack or token theft is underway**.
   - Instantly deletes the entire device session from Redis: `deleteSession(sessionId)`.
   - Throws `403 Security violation: Token reuse detected. Session terminated`.
5. **Refresh Token Rotation (RTR)**:
   - Generates brand new raw 40-byte refresh token and computes its SHA-256 hash.
   - Updates Redis session with new hash and refreshed `lastActive` timestamp.
   - Crucial: Uses Redis `KEEPTTL` command to maintain the remaining session lifespan without resetting the countdown clock.
6. **New Access Token Generation**: Fetches user from MongoDB; signs new 15-minute JWT access token.
7. **Response**: Updates `accessToken` and `refreshToken` cookies; returns `200 OK`.

####  Topics Used:
* Refresh Token Rotation (RTR)
* Automatic Breach & Token Reuse Detection
* Atomic Redis Updates with `KEEPTTL`
* SHA-256 Microsecond Token Hashing

####  Technology & Packages Used:
* `express`, `ioredis`, `crypto`, `jsonwebtoken`, `cookie-parser`

---

### Route 1.4: Logout Current Device
- **Method & Path**: `POST /api/v1/auth/logout`
- **Access**: Protected (`authenticate`)
- **Description**: Revokes the active device session from Redis and clears browser cookies.

####  Step-by-Step Making Flow:
1. **Authentication**: `authenticate` middleware verifies JWT access token and confirms `sessionId` is currently valid in Redis. Attaches `req.sessionId` and `req.user`.
2. **Redis Session Purge**: Calls `deleteSession(req.sessionId)`:
   - Removes `sessionId` from user's set in Redis: `redis.srem('user_sessions:<userId>', sessionId)`.
   - Deletes session key: `redis.del('session:<sessionId>')`.
3. **Cookie Destruction**: Clears `accessToken`, `refreshToken`, and `sessionId` cookies with matching path and flags.
4. **Response**: Returns `200 OK` with `{ message: 'Logout Successful' }`.

####  Topics Used:
* Explicit State Invalidation
* Redis Set Removal (`SREM`)
* Cookie Eviction Hygiene

####  Technology & Packages Used:
* `express`, `ioredis`, `cookie-parser`

---

### Route 1.5: Forgot Password
- **Method & Path**: `POST /api/v1/auth/forgot-password`
- **Access**: Public
- **Rate Limit**: `passwordResetRateLimiter` (Max 3 attempts per 15 min per IP)
- **Description**: Generates a temporary reset token and emails a reset link without leaking whether the account exists.

####  Step-by-Step Making Flow:
1. **Rate Limiting**: `passwordResetRateLimiter` prevents email spamming / denial-of-wallet attacks.
2. **User Lookup**: Queries MongoDB `User.findOne({ email })`.
3. **Anti-Enumeration Guard**: If user is not found, **returns immediately without throwing an error**.
4. **Token Generation**: Generates 32-byte crypto token (`crypto.randomBytes(32).toString('hex')`).
5. **Database Storage**: Hashes token with SHA-256 and saves to user:
   - `user.resetPasswordToken = hashedToken`
   - `user.resetPasswordExpires = Date.now() + 15 * 60 * 1000` (15-minute validity).
   - Saves user with `{ validateBeforeSave: false }`.
6. **Email Dispatch**: Sends HTML email with reset link (`/reset-password/<rawToken>`) via Nodemailer SMTP.
7. **Response**: Returns `200 OK` with identical generic message: `"If an account exists with this email, a password reset link has been sent."`

####  Topics Used:
* Email Enumeration Prevention (Blind Responses)
* Time-Limited Single-Use Reset Tokens
* SHA-256 Pre-Storage Hashing
* SMTP Email Delivery

####  Technology & Packages Used:
* `express`, `crypto`, `nodemailer`, `ioredis`

---

### Route 1.6: Reset Password
- **Method & Path**: `POST /api/v1/auth/reset-password/:token`
- **Access**: Public
- **Rate Limit**: `passwordResetRateLimiter`
- **Description**: Validates reset token, updates password, and purges all active login sessions globally across all devices.

####  Step-by-Step Making Flow:
1. **Validation**: `validate(resetPasswordSchema)` checks `newPassword` against strong password policy.
2. **Token Verification**: Computes SHA-256 hash of `:token`. Queries MongoDB:
   `User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: Date.now() } })`.
   If expired or invalid, throws `400 Invalid or expired reset token`.
3. **Password Update**: Hashes new password with `bcrypt.hash(newPassword, 12)`.
4. **Token Invalidation**: Sets `resetPasswordToken` and `resetPasswordExpires` to `undefined`. Saves user.
5. **Global Session Eviction**: Calls `deleteAllUserSessions(userId)`:
   - Retrieves all active device session IDs from Redis set `user_sessions:<userId>`.
   - Atomically deletes all session keys from Redis.
   - Deletes the set itself.
6. **Response**: Returns `200 OK` instructing user to log in with new password.

####  Topics Used:
* Global Session Eviction on Credential Change
* Cryptographic Token Expiration
* Safe Invalidation of One-Time Secrets

####  Technology & Packages Used:
* `express`, `bcrypt`, `crypto`, `ioredis`, `zod`

---

### Route 1.7: Change Password
- **Method & Path**: `PATCH /api/v1/auth/change-password`
- **Access**: Protected (`authenticate`)
- **Description**: Changes password for an authenticated user, prevents reusing the same password, and kicks out all other devices.

####  Step-by-Step Making Flow:
1. **Validation**: `validate(changePasswordSchema)` checks `currentPassword` and `newPassword`.
2. **Current Password Verification**: Fetches user with `+password`. Runs `bcrypt.compare(currentPassword, user.password)`. If wrong, throws `401 Incorrect current password`.
3. **Same Password Prevention**: Runs `bcrypt.compare(newPassword, user.password)`. If identical, throws `400 New password cannot be the same as old password`.
4. **Hash & Save**: Hashes new password with `bcrypt.hash(newPassword, 12)` and saves user.
5. **Session Revocation**: Calls `deleteAllUserSessions(userId)` to invalidate all device sessions in Redis.
6. **Cookie Cleanup & Response**: Clears authentication cookies; returns `200 OK`.

####  Topics Used:
* Password Rotation Hygiene
* Anti-Replay of Previous Passwords
* Global Multi-Device Invalidation

####  Technology & Packages Used:
* `express`, `bcrypt`, `zod`, `ioredis`

---

### Route 1.8: Get Profile & Active Device Sessions
- **Methods & Paths**:
  - `GET /api/v1/auth/profile` $\rightarrow$ Returns current user document.
  - `GET /api/v1/auth/sessions` $\rightarrow$ Lists all active devices with `isCurrentDevice` indicator.
  - `DELETE /api/v1/auth/sessions/:sessionId` $\rightarrow$ Remotely revokes a specific device.
  - `DELETE /api/v1/auth/sessions` $\rightarrow$ Revokes all sessions everywhere.
- **Access**: Protected (`authenticate`)

####  Step-by-Step Making Flow:
1. **Listing Sessions (`GET /sessions`)**:
   - Queries `redis.smembers('user_sessions:<userId>')`.
   - Iterates through session IDs and fetches `session:<id>`.
   - **Self-Healing Cleanup**: If a session key expired naturally via TTL, lazily removes the dead ID from the set using `redis.srem()`.
   - Maps sessions into DTO with `sessionId`, `deviceInfo` (Browser, OS, IP), `createdAt`, and `isCurrentDevice: session.id === req.sessionId`.
2. **Targeted Revocation (`DELETE /sessions/:sessionId`)**:
   - Retrieves session from Redis; verifies `session.userId === req.user._id`.
   - Removes ID from set and deletes key.
3. **Mass Revocation (`DELETE /sessions`)**:
   - Retrieves all session keys for user, deletes them in single Redis multi-key `del`, and clears cookies.

####  Topics Used:
* Active Device Management Dashboard
* Redis Set Indexing & Self-Healing Pattern
* Remote Session Killing

####  Technology & Packages Used:
* `express`, `ioredis`

---

## 2. User Profile & Media Avatar (`/api/v1/users`)

---

### Route 2.1: Get Current User
- **Method & Path**: `GET /api/v1/users/me`
- **Access**: Protected (`authenticate`)
- **Description**: Returns authenticated user profile, bio, and avatar metadata.

####  Step-by-Step Making Flow:
1. Verifies token and Redis session via `authenticate`.
2. Fetches user from MongoDB excluding password.
3. Returns `200 OK` with `{ user }`.

####  Technology & Packages Used: `express`, `mongoose`

---

### Route 2.2: Upload / Replace Avatar
- **Method & Path**: `POST /api/v1/users/me/avatar`
- **Access**: Protected (`authenticate`)
- **Rate Limit**: `fileUploadRateLimiter` (Max 10 uploads per 10 min)
- **Description**: Ingests image into memory, verifies genuine binary magic bytes, strips EXIF metadata, resizes with Sharp, uploads to Cloudinary/Disk, and safely replaces old avatar.

####  Step-by-Step Making Flow:
1. **Rate Limiting**: `fileUploadRateLimiter` enforces user-scoped upload quotas.
2. **Multipart Ingestion**: `uploadAvatarMemory` (`multer.memoryStorage()`) loads file buffer into `req.file` with a 2MB limit.
3. **Binary Magic-Byte Sniffing**: `validateImageMagicBytes` inspects binary headers via `fileTypeFromBuffer(req.file.buffer)`.
   - Accepts only genuine `image/jpeg`, `image/png`, or `image/webp`.
   - Rejects disguised executables or text files with `400 Invalid file format`.
4. **Sharp Image Sanitization**:
   - Parses pixel buffer with Sharp.
   - Resizes image to standard `250x250` with `{ fit: 'cover', position: 'center' }`.
   - Strips all EXIF metadata (removing GPS location, camera serial numbers, and embedded script payloads).
   - Re-encodes into standardized WebP buffer (`quality: 85`).
5. **Storage Ingestion**: Calls `storage.save(storageKey, processedBuffer, 'image/webp')`:
   - If Cloudinary: Uploads as `resource_type: 'image'`, `type: 'upload'` (public avatar).
   - If Local: Writes to `uploads/avatars/`.
6. **Safe Replacement Pattern**:
   - Captures `oldAvatarKey = user.avatar?.key`.
   - Updates user in MongoDB with new avatar key, MIME type, size, and timestamp.
   - Only after MongoDB update succeeds, deletes old avatar file from storage: `await storage.delete(oldAvatarKey)`.
7. **Response**: Returns `200 OK` with updated avatar metadata.

####  Topics Used:
* Memory Buffer Multipart Ingestion
* Magic-Byte Header Sniffing (File Signatures)
* Image Sanitization & EXIF Data Stripping
* Server-Side Transcoding & Resizing (WebP)
* Safe Replacement & Orphan Cleanup Pattern

####  Technology & Packages Used:
* `multer`, `file-type`, `sharp`, `cloudinary`, `streamifier`, `mongoose`

---

### Route 2.3: Get Avatar & Delete Avatar
- **Methods & Paths**:
  - `GET /api/v1/users/me/avatar` $\rightarrow$ Streams avatar image or redirects.
  - `DELETE /api/v1/users/me/avatar` $\rightarrow$ Removes avatar from storage and resets DB fields.
- **Access**: Protected (`authenticate`)

####  Step-by-Step Making Flow:
1. **Get Avatar**: Verifies user has an avatar. Sets `Content-Type: image/webp` and streams buffer or returns file.
2. **Delete Avatar**: Sets `user.avatar` subdocument fields to `null` in MongoDB. Calls `storage.delete(avatarKey)` to remove file from storage. Returns `200 OK`.

####  Technology & Packages Used: `express`, `mongoose`, Storage Adapter

---

## 3. Private Document Management System (`/api/v1/documents`)

---

### Route 3.1: Upload Private Document
- **Method & Path**: `POST /api/v1/documents`
- **Access**: Protected (`authenticate`)
- **Rate Limit**: `fileUploadRateLimiter`
- **Description**: Uploads a private PDF/document, sanitizes filename, writes to private cloud/disk, records metadata, and prevents orphaned files.

####  Step-by-Step Making Flow:
1. **Rate Limiting & Auth**: Enforces user-based upload quotas and validates session.
2. **Multer Ingestion**: `uploadDocumentMemory` enforces 10MB file size ceiling.
3. **Magic-Byte Document Validation**: `validatePdfMagicBytes` runs `fileTypeFromBuffer(req.file.buffer)`.
   - Validates that binary header matches `%PDF-` (`0x25 0x50 0x44 0x46`) or authorized document types.
   - Rejects mismatched files with `400 Bad Request`.
4. **Filename Sanitization**:
   - `path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_')`
   - Strips directory traversal sequences (`../`) and HTML/script tags (neutralizing Stored XSS).
5. **Storage Key Generation**: Generates unpredictable key: `documents/doc-<userId>-<uuid>.pdf`.
6. **Storage Ingestion**: Calls `storage.save(storageKey, file.buffer, mimeType)`.
   - In Cloudinary, sets `resource_type: 'raw'`, `type: 'authenticated'` (100% private, zero direct public access).
7. **Database Persistence & Orphan Cleanup**:
   - Attempts `Document.create({ owner: userId, originalName, storageKey, mimeType, size })`.
   - If MongoDB write fails, **catch block immediately executes `await storage.delete(storageKey)`** so dead files do not litter the storage provider.
8. **Response**: Returns `201 Created` with document metadata.

####  Topics Used:
* Insecure File Upload Prevention
* Binary Header Magic Number Validation
* Path Traversal & Stored XSS Sanitization
* Orphan File Cleanup on Database Failures
* Cloud Object Storage Private Delivery Modes

####  Technology & Packages Used:
* `multer`, `file-type`, `cloudinary`, `mongoose`, Node `path`, `crypto`

---

### Route 3.2: List User Documents
- **Method & Path**: `GET /api/v1/documents`
- **Access**: Protected (`authenticate`)
- **Description**: Returns all private documents owned by the authenticated user.

####  Step-by-Step Making Flow:
1. Queries MongoDB with strict ownership scope: `Document.find({ owner: req.user._id }).sort({ createdAt: -1 })`.
2. Fast query execution via compound index: `{ owner: 1, createdAt: -1 }`.
3. Returns `200 OK` with document count and metadata array.

####  Topics Used:
* Multi-Tenant Ownership Scoping
* Compound Database Indexing

####  Technology & Packages Used: `express`, `mongoose`

---

### Route 3.3: Get Document Metadata & Delete Document
- **Methods & Paths**:
  - `GET /api/v1/documents/:documentId` $\rightarrow$ Metadata lookup.
  - `DELETE /api/v1/documents/:documentId` $\rightarrow$ Deletes DB record + deletes from Cloudinary/Disk.
- **Access**: Protected (`authenticate`)

####  Step-by-Step Making Flow:
1. **Metadata Lookup**: Queries `Document.findOne({ _id: documentId, owner: req.user._id })`.
   - **IDOR Defense**: If another user's document ID is passed, returns `404 Not Found` (never leaks existence).
2. **Deletion**: Queries `Document.findOneAndDelete({ _id: documentId, owner: req.user._id })`.
   - Deletes file from Cloudinary/Disk via `storage.delete(document.storageKey)`.
   - Returns `200 OK`.

####  Topics Used:
* Broken Object Level Authorization (BOLA / IDOR)
* Information Leak Prevention (404 vs 403)
* Coordinated Deletion across Database and Storage

####  Technology & Packages Used: `express`, `mongoose`, Storage Adapter

---

### Route 3.4: Download Private Document
- **Method & Path**: `GET /api/v1/documents/:documentId/download`
- **Access**: Protected (`authenticate`)
- **Rate Limit**: `fileDownloadRateLimiter` (Max 30 downloads per min)
- **Description**: Authorizes ownership and either redirects client to a temporary signed Cloudinary URL or streams file with forced download headers.

####  Step-by-Step Making Flow:
1. **Authorization**: Queries `Document.findOne({ _id: documentId, owner: req.user._id })`. If null, throws `404 Document not found`.
2. **Cloud Storage Pre-Signed URL Branch**:
   - Calls `storage.generateSignedUrl(document.storageKey, 900)`.
   - In Cloudinary, generates an HMAC-signed URL with `expires_at` (15 min) and `attachment: true`.
   - If signed URL exists, controller returns **`res.redirect(downloadData.url)`**.
   - Client downloads directly from Cloudinary CDN, bypassing Express CPU and bandwidth.
3. **Local Storage Fallback Stream Branch**:
   - If local driver, opens `fs.createReadStream()`.
   - Sets security headers:
     - `Content-Type: application/pdf`
     - `Content-Disposition: attachment; filename="<originalName>"` (Forces download; prevents browser from running malicious scripts inside PDFs).
     - `X-Content-Type-Options: nosniff` (Stops MIME sniffing).
   - Pipes stream into `res`.

####  Topics Used:
* Pre-Signed URL Architecture (Direct Cloud Downloads)
* Safe File Streaming & Forced Attachment Headers
* Drive-by Malicious Script Execution Defense in PDFs
* Bandwidth Offloading

####  Technology & Packages Used:
* `express`, `cloudinary`, `mongoose`

---

## 4. Secure File Sharing & Access Grants (`/api/v1/shares`)

---

### Route 4.1: Create Temporary Sharing Link
- **Method & Path**: `POST /api/v1/shares/documents/:documentId`
- **Access**: Protected (`authenticate`)
- **Description**: Generates an unpredictable 64-character token, stores its SHA-256 hash in MongoDB with expiration and access limits.

####  Step-by-Step Making Flow:
1. **Ownership Verification**: Verifies requesting user owns the document: `Document.findOne({ _id: documentId, owner: req.user._id })`.
2. **Token Generation**: Generates 32 bytes of pure entropy: `rawToken = crypto.randomBytes(32).toString('hex')`.
3. **Database Hash**: Hashes token with SHA-256 before storage:
   `tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')`.
4. **Expiration Calculation**: Calculates `expiresAt = Date.now() + hours * 3600 * 1000` (max 7 days).
5. **Share Creation**: Saves record in MongoDB with `maxAccessCount`, `accessCount: 0`, and empty `accessLogs[]`.
6. **Response**: Returns `201 Created` with full share URL (`/api/v1/shares/<rawToken>`). The raw token is displayed **only once**.

####  Topics Used:
* Application-Managed Sharing Links
* One-Way Hashing of Access Grants
* Expiring Capabilities & Access Quotas

####  Technology & Packages Used:
* `express`, Node native `crypto`, `mongoose`

---

### Route 4.2: List & Revoke Share Links
- **Methods & Paths**:
  - `GET /api/v1/shares/documents/:documentId` $\rightarrow$ Lists active shares and audit logs.
  - `DELETE /api/v1/shares/:shareId` $\rightarrow$ Manually revokes a sharing link.
- **Access**: Protected (`authenticate`)

####  Step-by-Step Making Flow:
1. **List Shares**: Queries `Share.find({ document: documentId, createdBy: req.user._id }).select('-tokenHash')`. Returns active links and download counts.
2. **Revocation**: Queries `Share.findOne({ _id: shareId, createdBy: req.user._id })`. Sets `share.isRevoked = true` and saves. Instantly blocks future access.

####  Topics Used:
* Access Control Revocation
* Audit Trail Inspection

####  Technology & Packages Used: `express`, `mongoose`

---

### Route 4.3: Access Shared Document (Public Recipient Route)
- **Method & Path**: `GET /api/v1/shares/:shareToken`
- **Access**: Public
- **Rate Limit**: `fileDownloadRateLimiter` (Max 30 downloads per min)
- **Description**: Validates token hash, checks expiration, checks access ceiling, records audit log entry, and delivers file via signed URL redirect or stream.

####  Step-by-Step Making Flow:
1. **Rate Limiting**: `fileDownloadRateLimiter` protects against scraping.
2. **Token Hash Lookup**: Computes SHA-256 hash of `:shareToken`.
3. **Validation Checks**: Queries MongoDB:
   `Share.findOne({ tokenHash, isRevoked: false, expiresAt: { $gt: new Date() } }).populate('document')`.
   - If not found, expired, or revoked $\rightarrow$ throws `404 Share link is invalid, expired, or revoked`.
   - If `maxAccessCount` is reached $\rightarrow$ throws `410 Share link has reached its maximum download limit`.
4. **Audit Trail Logging**:
   - Extracts client IP and `User-Agent`.
   - Atomically increments `share.accessCount += 1`.
   - Appends entry to `share.accessLogs`: `{ accessedAt: new Date(), ip, userAgent }`.
   - Saves share record.
5. **File Delivery**:
   - Generates signed Cloudinary URL via `storage.generateSignedUrl()` and redirects client, OR streams file with `Content-Disposition: attachment`.

####  Topics Used:
* Public Capability-Based Access Control
* Atomic Usage Counters & Quota Ceilings
* Append-Only Audit Logging
* Cloud Signed Redirection

####  Technology & Packages Used:
* `express`, Node `crypto`, `mongoose`, `cloudinary`

---

## 5. Infrastructure & Observability (`/health`)

---

### Route 5.1: Deep Dependency Health Check
- **Method & Path**: `GET /health`
- **Access**: Public
- **Description**: Actively pings MongoDB and Redis to report live cluster health to load balancers.

####  Step-by-Step Making Flow:
1. **Correlation**: Attaches `X-Request-ID` to response.
2. **Active Pings**:
   - Tests MongoDB connection state: `mongoose.connection.readyState === 1`.
   - Pings Redis: `await redis.ping() === 'PONG'`.
3. **Evaluation**: If both services are healthy, returns `200 OK` with uptime and timestamp. If either service is down, returns `503 Service Unavailable`.

####  Topics Used:
* Production Health & Liveness Probes
* Active Dependency Pinging
* Distributed Correlation IDs

####  Technology & Packages Used:
* `express`, `mongoose`, `ioredis`, `crypto`

---

##  Architectural Summary Matrix

| Module | Core Route | Primary Security Defense | Primary Technology |
|---|---|---|---|
| **Auth** | `POST /register`, `POST /login` | Zod Password Policy, Bcrypt 12, Brute-Force Rate Limiting | `bcrypt`, `zod`, `ioredis` |
| **Sessions** | `POST /refresh`, `POST /logout` | Refresh Token Rotation (`KEEPTTL`), Breach Kill-Switch | `ioredis`, `crypto` |
| **Media** | `POST /me/avatar` | Binary Magic-Byte Sniffing, Sharp EXIF Stripping, Safe Swap | `multer`, `file-type`, `sharp` |
| **Vault** | `POST /documents`, `GET /:id` | IDOR Prevention, Filename Sanitization, Orphan Cleanup | `mongoose`, Storage Adapter |
| **Sharing** | `POST /shares`, `GET /:token` | SHA-256 Token Hashes, Expiration Timestamps, Audit Trails | `crypto`, `cloudinary` |
| **Gateway** | Global | Helmet, Strict CORS, JSON 10kb Ceiling, Request IDs | `helmet`, `cors`, `express` |

