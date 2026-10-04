# WorkFlowX — Complete Route-by-Route Making Flow & Architecture Blueprint

This document is a comprehensive engineering blueprint for **every single route** in the WorkFlowX backend. Use this guide to understand the complete end-to-end lifecycle of every endpoint or to replicate these exact production patterns in any future project.

---

## Table of Contents
1. [Architectural Layer Pattern (How Every Route is Built)](#architectural-layer-pattern)
2. [Authentication & Session Routes (`/api/v1/auth`)](#1-authentication--session-routes)
3. [User Routes (`/api/v1/users`)](#2-user-routes)
4. [Project Routes (`/api/v1/projects`)](#3-project-routes)
5. [Task Routes (`/api/v1/tasks`)](#4-task-routes)
6. [Note Routes (`/api/v1/notes`)](#5-note-routes)
7. [Transaction Routes (`/api/v1/transactions`)](#6-transaction-routes)
8. [Dashboard Analytics Route (`/api/v1/dashboard`)](#7-dashboard-analytics-route)
9. [Admin RBAC Routes (`/api/v1/admin`)](#8-admin-rbac-routes)

---

## Architectural Layer Pattern

Every route in WorkFlowX follows an isolated, predictable 6-layer pipeline:

```
[HTTP Request]
     │
     ▼
1. Route Definition       (Defines HTTP Verb, path, and attaches middleware chain)
     │
     ▼
2. Auth & RBAC Guard     (authenticate verifies token; authorize checks roles)
     │
     ▼
3. Zod Validation        (validateBody / validateParams sanitizes & validates inputs)
     │
     ▼
4. Controller            (catchAsync wrapper; unwraps req; delegates to service; sends HTTP status)
     │
     ▼
5. Service Layer         (Pure business logic, database queries, ownership checks, aggregations)
     │
     ▼
6. Mongoose Model / DB   (Schema rules, indexes, cascade cleanups)
     │
     ▼
[HTTP Response]
```

---

## 1. Authentication & Session Routes

---

### `POST /api/v1/auth/register` — Register User & Initial Device Session
* **Purpose:** Registers a user in MongoDB, hashes their password, generates a high-entropy Redis device session, and issues initial access/refresh cookies.
* **Making Flow:**
  1. **Route (`auth.route.js`):** Mount `router.post('/register', register)`.
  2. **Controller (`auth.controller.js`):** Wrap with `catchAsync`. Pass `req.body` and `req` (for User-Agent & IP) to `registerService`.
  3. **Service (`auth.services.js`):**
     * Check uniqueness: `User.findOne({ email })`. Throw `409 Conflict` if taken.
     * Hash password using `bcrypt.hash(password, 12)`.
     * Save user in MongoDB.
     * Generate `sessionId = crypto.randomUUID()` and 320-bit raw refresh token: `crypto.randomBytes(40).toString('hex')`.
     * Hash refresh token via SHA-256: `crypto.createHash('sha256').update(rawToken).digest('hex')`.
     * Store session in Redis (`session:${sessionId}`, 7-day TTL) and index in Set `user_sessions:${userId}`.
     * Issue JWT Access Token (15-min expiry) containing `{ userId, sessionId }`.
  4. **Response:** Send `accessToken`, `refreshToken`, and `sessionId` as `HttpOnly`, `SameSite=Lax` cookies; return HTTP `201 Created` with sanitized user.
* **Topics Used:** Cryptographic Password Hashing, High-Entropy Random Tokens, SHA-256 vs Bcrypt, Multi-Device Tracking, Two-Key Redis Indexing, HttpOnly Cookie Security.
* **Technology / Packages Used:** `express`, `mongoose`, `bcrypt`, `jsonwebtoken`, `ioredis`, Node.js native `crypto`.

---

### `POST /api/v1/auth/login` — Device Login & Session Creation
* **Purpose:** Authenticates email and password, creates an independent device session in Redis, and issues tokens.
* **Making Flow:**
  1. **Route (`auth.route.js`):** `router.post('/login', login)`.
  2. **Controller (`auth.controller.js`):** Calls `loginServices(req.body, req)`.
  3. **Service (`auth.services.js`):**
     * Find user by email: `User.findOne({ email }).select('+password')`.
     * Verify credentials: `await bcrypt.compare(password, user.password)`. Throw `401 Unauthorized` if invalid.
     * Create independent Redis session with parsed device info (Browser, OS, IP).
     * Issue signed Access Token and hashed Refresh Token.
  4. **Response:** Set cookies; return `200 OK` with user details and tokens.
* **Topics Used:** Credential Authentication, Timing Attack Mitigation (generic error messages), Device Fingerprinting, Session State Storage.
* **Technology / Packages Used:** `express`, `mongoose`, `bcrypt`, `jsonwebtoken`, `ioredis`, `deviceInfo.js`.

---

### `POST /api/v1/auth/refresh` — Refresh Token Rotation (RTR) & Breach Detection
* **Purpose:** Rotates refresh token, issues a fresh 15-minute access token, and triggers a kill-switch if token reuse is detected.
* **Making Flow:**
  1. **Route (`auth.route.js`):** `router.post('/refresh', refresh)`.
  2. **Controller (`auth.controller.js`):** Extracts `refreshToken` and `sessionId` from cookies or body. Calls `refreshServices`.
  3. **Service (`auth.services.js`):**
     * Fetch session from Redis: `getSession(sessionId)`. If missing, throw `401`.
     * Compare `SHA256(incomingToken)` against stored `refreshTokenHash`.
     * **Kill Switch:** If hash does NOT match, token reuse is detected (theft). Immediately delete `session:${sessionId}` from Redis and throw `403 Forbidden`.
     * If matched: generate new refresh token, hash it, update Redis keeping TTL (`KEEPTTL`), issue new access token.
  4. **Response:** Set updated cookies; return `200 OK`.
* **Topics Used:** Refresh Token Rotation (RTR), Breach Detection Kill-Switch, Replay Attack Mitigation, In-Memory Cryptographic Hash Validation.
* **Technology / Packages Used:** `express`, `ioredis`, `jsonwebtoken`, Node.js native `crypto`.

---

### `POST /api/v1/auth/logout` — Logout Current Device
* **Purpose:** Logs out the calling device by destroying its specific Redis session, leaving other logged-in devices intact.
* **Making Flow:**
  1. **Route (`auth.route.js`):** `router.post('/logout', authenticate, logout)`.
  2. **Service (`auth.services.js`):** Delete `session:${req.sessionId}` and remove from `user_sessions:${req.user._id}`.
  3. **Response:** Clear client cookies (`res.clearCookie`); return `200 OK`.
* **Topics Used:** Session Invalidation, Isolated Device Logout, Cookie Cleanup.
* **Technology / Packages Used:** `express`, `ioredis`, `cookie-parser`.

---

### `GET /api/v1/auth/sessions` — List All Active Devices
* **Purpose:** Returns all logged-in devices for the user and flags which device is making the request.
* **Making Flow:**
  1. **Route (`auth.route.js`):** `router.get('/sessions', authenticate, getActiveSessions)`.
  2. **Service (`auth.services.js`):**
     * Fetch all session IDs from user's Redis Set: `SMEMBERS user_sessions:${userId}`.
     * Multi-fetch session payloads. Self-heal by removing expired IDs (`SREM`).
     * Compare each `sessionId` to `req.sessionId` to set `isCurrentDevice: true | false`.
  3. **Response:** Return `200 OK` with device array.
* **Topics Used:** Redis Sets (`SMEMBERS`, `SREM`), Lazy Cleanup (Self-Healing Cache), Device Auditing.
* **Technology / Packages Used:** `express`, `ioredis`.

---

### `DELETE /api/v1/auth/sessions/:sessionId` — Revoke Specific Remote Device
* **Purpose:** Remotely log out a lost or untrusted device.
* **Making Flow:**
  1. **Service (`auth.services.js`):** Verify targeted `sessionId` belongs to `req.user._id`. Delete from Redis.
  2. **Response:** Return `200 OK`.
* **Topics Used:** Remote Session Revocation, Multi-Tenant Session Ownership Verification.
* **Technology / Packages Used:** `express`, `ioredis`.

---

### `DELETE /api/v1/auth/sessions` — Revoke All Devices (Logout Everywhere)
* **Purpose:** Security panic button: logs out all devices simultaneously.
* **Making Flow:**
  1. **Service (`auth.services.js`):** Fetch all session IDs from `user_sessions:${userId}`, `DEL` each key, and delete the parent set.
  2. **Response:** Clear cookies; return `200 OK`.
* **Topics Used:** Bulk Invalidation, Global Session Eviction.
* **Technology / Packages Used:** `express`, `ioredis`.

---

### `POST /api/v1/auth/forgot-password` & `POST /api/v1/auth/reset-password/:token`
* **Purpose:** Secure password reset via unguessable hex tokens, with automatic global session revocation on password change.
* **Making Flow:**
  1. Generate random 20-byte token, hash with SHA-256, store in `resetPasswordToken` with 10-minute expiry.
  2. On reset: match hash, update password with `bcrypt.hash`, and **purge all Redis sessions** so all active logins must re-authenticate.
* **Topics Used:** Opaque Password Reset Tokens, Expiry Timestamps, Post-Reset Session Invalidation.
* **Technology / Packages Used:** `mongoose`, `bcrypt`, `crypto`, `nodemailer`, `ioredis`.

---

## 2. User Routes

---

### `GET /api/v1/users/me` — Fetch Current User Profile
* **Purpose:** Returns currently authenticated user details.
* **Making Flow:**
  1. **Route (`user.route.js`):** `router.get('/me', authenticate, me)`.
  2. **Controller (`user.controller.js`):** Calls `getMeService(req.user._id)`.
  3. **Service (`user.service.js`):** `User.findById(id).select('-password')`.
  4. **Response:** Return `200 OK` with user profile.
* **Topics Used:** Identity Verification, Field Exclusion (`.select('-password')`).
* **Technology / Packages Used:** `express`, `mongoose`.

---

## 3. Project Routes

---

### `POST /api/v1/projects` — Create Project
* **Purpose:** Creates a new project owned by the logged-in user with validated tech stacks and mandatory deadline.
* **Making Flow:**
  1. **Validation (`project.validation.js`):**
     * `createProjectSchema`: `title` (min 2, max 150), `description` (required, max 500), `techStack` (array of strings), `nonTechStack`, `status` (enum), `deadline` (coerced required date).
  2. **Middleware (`project.middlewares.js`):** `validateBody(createProjectSchema)`. Sanitizes inputs and formats errors.
  3. **Controller (`project.controller.js`):** Extracts `userId = req.user._id` and `req.body`. Calls `createProjectService`.
  4. **Service (`project.service.js`):** `Projects.create({ ...projectData, user: userId })`.
  5. **Response:** Return `201 Created` with created project.
* **Topics Used:** Zod Date Coercion, Data Isolation (Server-enforced User Attachment), Document Creation.
* **Technology / Packages Used:** `express`, `mongoose`, `zod`.

---

### `GET /api/v1/projects` — List Projects (Search, Filter, Sort, Pagination)
* **Purpose:** Retrieves user projects supporting search, status filtering, sorting, and pagination.
* **Making Flow:**
  1. **Service (`project.service.js`):**
     * Base filter: `const filter = { user: userId }`.
     * Status filter: `if (query.status) filter.status = query.status`.
     * Search filter: `if (query.search) filter.$or = [{ title: regex }, { description: regex }]`.
     * Sorting: `query.sort ? query.sort.split(',').join(' ') : '-createdAt'`.
     * Pagination: `skip = (page - 1) * limit`.
     * Concurrent execution: `Promise.all([Projects.find(filter)..., Projects.countDocuments(filter)])`.
  2. **Response:** Return `200 OK` with `projects` and `pagination` metadata.
* **Topics Used:** Case-Insensitive Regex Search, Dynamic Query Building, Pagination Math, Parallel Database Queries (`Promise.all`).
* **Technology / Packages Used:** `express`, `mongoose`.

---

### `GET /api/v1/projects/:id` — Get Project by ID
* **Purpose:** Retrieves a single project ensuring multi-tenant ownership.
* **Making Flow:**
  1. **Middleware:** `validateParams(projectIdParamSchema)` (validates 24-hex ObjectId).
  2. **Service:** `Projects.findOne({ _id: projectId, user: userId })`. If null, throw `404 Not Found`.
  3. **Response:** Return `200 OK` with project.
* **Topics Used:** Param Validation, Multi-Tenant Security (Tenant Scoping via `{ _id, user }`).
* **Technology / Packages Used:** `express`, `mongoose`, `zod`.

---

### `PATCH /api/v1/projects/:id` — Update Project
* **Purpose:** Partially updates project fields while preserving schema rules.
* **Making Flow:**
  1. **Validation:** `updateProjectSchema = createProjectSchema.partial().refine(data => Object.keys(data).length > 0)`.
  2. **Service:** `Projects.findOneAndUpdate({ _id: projectId, user: userId }, updateData, { returnDocument: 'after', runValidators: true })`.
  3. **Response:** Return `200 OK` with updated document.
* **Topics Used:** Partial Validation, Zod Custom Refinements, Atomic Updates, Schema Validator Enforcement (`runValidators: true`).
* **Technology / Packages Used:** `express`, `mongoose`, `zod`.

---

### `DELETE /api/v1/projects/:id` — Delete Project
* **Purpose:** Deletes project owned by user.
* **Making Flow:**
  1. **Service:** `Projects.findOneAndDelete({ _id: projectId, user: userId })`. If null, throw `404`.
  2. **Response:** Return `200 OK`.
* **Topics Used:** Hard Deletion, Ownership Guard.
* **Technology / Packages Used:** `express`, `mongoose`.

---

## 4. Task Routes

---

### `POST /api/v1/tasks` — Create Task (Cross-Collection Authorization)
* **Purpose:** Creates a task, verifying that any referenced `project` belongs to the authenticated user.
* **Making Flow:**
  1. **Validation (`task.validation.js`):** `title`, optional `description`, `status` (`todo`, `in_progress`, `completed`), `priority` (`low`, `medium`, `high`), optional `dueDate`, optional `project` (ObjectId or null).
  2. **Service (`task.service.js`):**
     * **Cross-Collection Verification:** If `taskData.project` is provided, query `Project.findOne({ _id: taskData.project, user: userId })`. If not found, throw `404` ("Referenced project not found or does not belong to you").
     * Create task with `user: userId`.
  3. **Response:** Return `201 Created`.
* **Topics Used:** Cross-Collection Authorization, Relational Integrity in NoSQL, Optional Foreign Keys.
* **Technology / Packages Used:** `express`, `mongoose`, `zod`.

---

### `GET /api/v1/tasks` — List Tasks (Project Filter & Standalone Querying)
* **Purpose:** List user tasks with filtering by project (including standalone tasks without project), status, and priority.
* **Making Flow:**
  1. **Service:**
     * Project filter: if `query.project === 'none' || query.project === 'null'`, match `{ project: null }`. Else if `query.project`, match `{ project: query.project }`.
     * Status & Priority filters.
     * Populate: `.populate('project', 'title status')`.
  2. **Response:** Return `200 OK` with populated task objects and pagination.
* **Topics Used:** Mongoose `.populate()`, Standalone / Null-Value Querying, Filtering Compound States.
* **Technology / Packages Used:** `express`, `mongoose`.

---

### `GET /api/v1/tasks/:id`, `PATCH /:id`, `DELETE /:id`
* **Purpose:** Manage individual tasks with project ownership checks on update and populated responses.
* **Topics Used:** Safe Updates, Relationship Verification, Object Id Validation.
* **Technology / Packages Used:** `express`, `mongoose`, `zod`.

---

## 5. Note Routes

---

### `POST /api/v1/notes` — Create Note with Lowercase Tag Normalization
* **Purpose:** Saves notes with automatic lowercase transformation on tags.
* **Making Flow:**
  1. **Validation (`note.validation.js`):** `tags: z.array(z.string().trim().toLowerCase().max(30)).optional()`.
  2. **Service (`note.service.js`):** Checks project ownership if provided, creates note attached to `userId`.
  3. **Response:** Return `201 Created`.
* **Topics Used:** Array Schema Validation, Zod String Transformation (`.toLowerCase()`), Tag Normalization.
* **Technology / Packages Used:** `express`, `mongoose`, `zod`.

---

### `GET /api/v1/notes` — List Notes (Pinned Sorting via Compound Index)
* **Purpose:** Lists notes, prioritizing pinned notes at the top with zero in-memory sort performance penalty.
* **Making Flow:**
  1. **Database Compound Index:** In `note.model.js`: `notesSchema.index({ user: 1, isPinned: -1, updatedAt: -1 })`.
  2. **Service (`note.service.js`):**
     * Multi-tag filtering: if `query.tags`, split by comma and match `{ tags: { $in: tagList } }`.
     * Search: regex across both `title` and `content`.
     * Sort: default `'-isPinned -updatedAt'` perfectly fulfills query directly inside MongoDB RAM index.
  3. **Response:** Return `200 OK`.
* **Topics Used:** Compound Index Architecture, MongoDB In-RAM Index Sorting, Array `$in` Filtering, Multi-Field Search.
* **Technology / Packages Used:** `express`, `mongoose`.

---

### `GET /api/v1/notes/:id`, `PATCH /:id`, `DELETE /:id`
* **Purpose:** CRUD on notes. `PATCH` allows toggling `{ "isPinned": true / false }`.
* **Topics Used:** Document Updates, Boolean Flag Management.
* **Technology / Packages Used:** `express`, `mongoose`, `zod`.

---

## 6. Transaction Routes

---

### `POST /api/v1/transactions` — Create Financial Transaction
* **Purpose:** Records income or expense using positive number modeling.
* **Making Flow:**
  1. **Validation (`transaction.validation.js`):** `type: z.enum(['income', 'expense'])`, `amount: z.number().positive()`, `category: z.string().toLowerCase()`, `date: z.coerce.date().default(() => new Date())`.
  2. **Service (`transaction.service.js`):** Attaches `user: userId`, checks optional project ownership, creates record.
  3. **Response:** Return `201 Created`.
* **Topics Used:** Financial Data Modeling (Positive Amounts + Enum), Strict Field Types, Date Default Fallback.
* **Technology / Packages Used:** `express`, `mongoose`, `zod`.

---

### `GET /api/v1/transactions` — List Transactions with Date Range Filters
* **Purpose:** Retrieves transactions within time boundaries (e.g. this month).
* **Making Flow:**
  1. **Service (`transaction.service.js`):**
     * Date filtering: `if (query.startDate) filter.date.$gte = new Date(query.startDate)`. `if (query.endDate) filter.date.$lte = new Date(query.endDate)`.
     * Default sort: by occurrence date: `'-date -createdAt'`.
  2. **Response:** Return `200 OK` with transactions and pagination.
* **Topics Used:** Date Comparison Operators (`$gte`, `$lte`), Financial Chronological Sorting.
* **Technology / Packages Used:** `express`, `mongoose`.

---

### `GET /api/v1/transactions/summary` — Financial Aggregation Pipeline
* **Purpose:** Computes overall income, expenses, net balance, and categorized spending in a single call.
* **Making Flow:**
  1. **Route Ordering (`transaction.route.js`):** Static route `/summary` **must be placed before** `/:id` so Express doesn't match `"summary"` as an ID.
  2. **Service (`transaction.service.js`):**
     * Pipeline 1: `{ $match: { user: userObjectId } }` $\rightarrow$ `{ $group: { _id: '$type', totalAmount: { $sum: '$amount' } } }`.
     * Pipeline 2 (Spending Breakdown): `{ $match: { user: userObjectId, type: 'expense' } }` $\rightarrow$ `{ $group: { _id: '$category', totalSpent: { $sum: '$amount' } } }` $\rightarrow$ `{ $sort: { totalSpent: -1 } }`.
     * Calculates `netBalance = totalIncome - totalExpense`.
  3. **Response:** Return `200 OK` with totals and sorted category breakdown.
* **Topics Used:** Express Route Precedence, MongoDB Aggregation Pipeline (`$match`, `$group`, `$sum`, `$sort`), Financial Analytics.
* **Technology / Packages Used:** `express`, `mongoose`.

---

### `GET /api/v1/transactions/:id`, `PATCH /:id`, `DELETE /:id`
* **Purpose:** Fetch, modify, or remove transaction documents.
* **Topics Used:** Atomic Updates, Resource Integrity.
* **Technology / Packages Used:** `express`, `mongoose`, `zod`.

---

## 7. Dashboard Analytics Route

---

### `GET /api/v1/dashboard` — Master Analytics Engine
* **Purpose:** Computes a full platform health summary for the user across all 4 data collections in a single sub-second call.
* **Making Flow:**
  1. **Controller (`dashboard.controller.js`):** Calls `getDashboardStatsService(req.user._id)`.
  2. **Service (`dashboard.service.js`):** Runs 6 concurrent database operations using `Promise.all`:
     * Aggregation 1: `Project.aggregate` grouped by status.
     * Aggregation 2: `Task.aggregate` grouped by status.
     * Count 3: `Task.countDocuments({ dueDate: { $lt: now }, status: { $ne: 'completed' } })` (Overdue tasks).
     * Aggregation 4: `Note.aggregate` calculating total notes and pinned tally using `$cond`.
     * Aggregation 5: `Transaction.aggregate` summing income and expense totals.
     * Query 6: `Task.find` fetching top 5 upcoming urgent tasks (`dueDate: 1`).
  3. **Response:** Return `200 OK` with unified dashboard payload.
* **Topics Used:** Analytical Aggregations Without a Dedicated Model, Multi-Collection Parallelism (`Promise.all`), Overdue Date Filtering, Conditional Aggregation (`$cond`).
* **Technology / Packages Used:** `express`, `mongoose`.

---

## 8. Admin RBAC Routes

---

### `GET /api/v1/admin/stats` — Platform-Wide Metrics
* **Purpose:** Calculates total system users, projects, tasks, notes, transactions, and aggregate platform financial volume.
* **Making Flow:**
  1. **Route (`admin.route.js`):** Protected by `router.use(authenticate)` and `router.use(authorize('admin'))`.
  2. **Service (`admin.service.js`):** Uses `Promise.all` across all models with `countDocuments` and aggregates the sum of all transaction amounts across the entire database.
  3. **Response:** Return `200 OK`.
* **Topics Used:** Role-Based Access Control (RBAC), Global Aggregations, System Auditing.
* **Technology / Packages Used:** `express`, `mongoose`.

---

### `GET /api/v1/admin/users` — User Directory with Role Filter
* **Purpose:** Lists all registered users with search, role filtering, and pagination.
* **Making Flow:**
  1. **Service (`admin.service.js`):** Queries `User.find(filter).select('-password -resetPasswordToken -resetPasswordExpires')`.
  2. **Response:** Return `200 OK` with user list and pagination metadata.
* **Topics Used:** User Management, Password Sanitization, Admin Directory Search.
* **Technology / Packages Used:** `express`, `mongoose`.

---

### `GET /api/v1/admin/users/:id` — Inspect User & Resource Breakdown
* **Purpose:** Detailed inspection of any user, counting how many projects, tasks, notes, and transactions they own.
* **Making Flow:**
  1. **Service:** Queries target user and runs parallel `countDocuments` across `Project`, `Task`, `Note`, and `Transaction` filtered by `{ user: targetUserId }`.
  2. **Response:** Return `200 OK` with user profile and `resourceSummary`.
* **Topics Used:** Resource Auditing, Relational Data Summaries.
* **Technology / Packages Used:** `express`, `mongoose`.

---

### `PATCH /api/v1/admin/users/:id/role` — Update User Role
* **Purpose:** Promotes or demotes a user (`user` $\leftrightarrow$ `admin`).
* **Making Flow:**
  1. **Self-Demotion Guard:** If `targetUserId === req.user._id`, throw `400 Bad Request` ("You cannot change your own role").
  2. **Service:** Updates `role` to `'user'` or `'admin'`.
  3. **Response:** Return `200 OK`.
* **Topics Used:** RBAC Elevation, Privilege Escalation Prevention, Self-Lockout Mitigation.
* **Technology / Packages Used:** `express`, `mongoose`.

---

### `DELETE /api/v1/admin/users/:id` — Cascade Deletion
* **Purpose:** Permanently deletes a user and cascades the deletion to clean up all orphaned documents across all collections.
* **Making Flow:**
  1. **Self-Deletion Guard:** If `targetUserId === req.user._id`, throw `400 Bad Request` ("You cannot delete your own admin account").
  2. **Service (`admin.service.js`):**
     * Delete user: `User.findByIdAndDelete(targetUserId)`.
     * Cascade cleanup in parallel:
       * `Project.deleteMany({ user: targetUserId })`
       * `Task.deleteMany({ user: targetUserId })`
       * `Note.deleteMany({ user: targetUserId })`
       * `Transaction.deleteMany({ user: targetUserId })`
  3. **Response:** Return `200 OK` ("User and all associated data permanently deleted").
* **Topics Used:** Cascade Deletions in NoSQL, Orphaned Document Prevention, Admin Safety Checks.
* **Technology / Packages Used:** `express`, `mongoose`.

---

### `DELETE /api/v1/admin/projects/:id` & `DELETE /api/v1/admin/tasks/:id` — Content Moderation
* **Purpose:** Allows administrators to moderate/force delete any project or task. Deleting a project automatically cascades to delete all tasks linked to that project ID.
* **Making Flow:**
  1. `Project.findByIdAndDelete(projectId)` followed by `Task.deleteMany({ project: projectId })`.
  2. Return `200 OK`.
* **Topics Used:** Moderation Workflows, One-to-Many Cascade Cleanup.
* **Technology / Packages Used:** `express`, `mongoose`.

---

## Summary of Core Technologies & Packages Used Across All Routes

| Technology / Package | Role in WorkFlowX |
| :--- | :--- |
| **`express`** | Core HTTP server, routing, middleware chaining, and error forwarding. |
| **`mongoose`** | MongoDB ODM, schema validation, indexes, compound indexes, population, and aggregation pipelines. |
| **`zod`** | Type-safe runtime schema validation, coercions (`date`), partial schemas, and refinements. |
| **`ioredis`** | Redis client for multi-device session state, TTL expiry, and user session sets. |
| **`jsonwebtoken`** | Creation and cryptographic verification of stateless HMAC SHA-256 access tokens. |
| **`bcrypt`** | Slow, salted key-stretching password hashing. |
| **Node.js `crypto`** | High-entropy random bytes generation (`randomBytes`, `randomUUID`) and non-blocking fast SHA-256 hashing. |
| **`cookie-parser`** | Parsing and signing `HttpOnly` security cookies. |
| **`nodemailer`** | Dispatching password reset links. |
