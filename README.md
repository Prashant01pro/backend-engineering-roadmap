# Backend Development Learning Series

A comprehensive, hands-on backend learning repository demonstrating the evolution of modern authentication, authorization, session architectures, full-stack REST API design, financial modeling, and multi-collection aggregations using **Node.js**, **Express**, **MongoDB**, and **Redis**.

This repository is designed for developers, students, and engineers who want to study production-grade backend design patterns from first principles.

---

##  Curriculum & Projects Overview

The projects are structured sequentially, progressing from core token-based authentication to distributed sessions, culminating in an enterprise-grade REST API workspace:

```
  Backend-Project-Learning/
    │
    ├── secure-Api-Project-1/             # Phase 1: Stateless JWT Authentication
    ├── role-Based-Api-2/                 # Phase 2: Role-Based Access Control (RBAC)
    ├── session-Based-Authentication-3/   # Phase 3: Stateful Distributed Sessions with Redis
    ├── multi-Device-Auth-System-4/       # Phase 4: Multi-Device Hybrid Auth (JWT + Redis RTR)
    ├── workFlowX-5/                      # Phase 5: Complete Enterprise REST API Suite (Projects, Tasks, Notes, Finances, Analytics & Admin RBAC)
    ├── campusStoreX/                     # Phase 6: Database-First Marketplace Architecture (Embedding vs Referencing, ACID Transactions, Race Conditions, Concurrency & Aggregations)
    └── secureVault-7/                    # Phase 7: Zero-Trust Secure File & Document Management Platform (Storage Adapter, Magic Bytes, Sharp, Signed URLs, Rate Limiting & Security Lab)
```

---

### 1. [Secure API & JWT Authentication](./secure-Api-Project-1)
> **Focus**: Stateless authentication, token lifecycle, and secure cookie storage.

- **Key Concepts**:
  - User registration & password hashing with `bcrypt`
  - Dual-token architecture: Short-lived Access Token (15 min) + Long-lived Refresh Token (7 days)
  - Storing tokens securely in `httpOnly`, `sameSite`, `secure` cookies
  - Refresh token rotation & blacklisting
  - Time-limited password reset flow with Nodemailer & Gmail SMTP
  - Global error handling and custom API response structures
- **Documentation**: [Project 1 Readme](./secure-Api-Project-1/README.md) & [Route Flow Guide](./secure-Api-Project-1/ROUTE_FLOWS.md)

---

### 2. [Role-Based Access Control (RBAC) API](./role-Based-Api-2)
> **Focus**: Granular authorization, permission layers, and administrator dashboards.

- **Key Concepts**:
  - Hierarchical roles: `USER`, `MODERATOR`, and `ADMIN`
  - Reusable role-authorization middleware (`requireRole('ADMIN')`)
  - Admin management features: Ban/unban accounts, force role adjustments, account deletion
  - Dual authentication token support: HTTP-only cookies and `Authorization: Bearer <token>` headers
  - Centralized validation and clean layered architecture (Routes → Controllers → Services → Models)
- **Documentation**: [Project 2 Readme](./role-Based-Api-2/README.md) & [Route Flow Guide](./role-Based-Api-2/ROUTE_FLOWS.md)

---

### 3. [Session-Based Authentication System](./session-Based-Authentication-3)
> **Focus**: Production-grade stateful sessions built from scratch without black-box packages like `express-session`.

- **Key Concepts**:
  - Custom 32-byte cryptographically secure session IDs via Node's `crypto`
  - Redis store for high-speed in-memory session persistence
  - Dual-layer expiration: Redis TTL key expiration + lazy middleware checks
  - Multi-device login tracking using Redis Sets (`user_sessions:userId`)
  - Targeted revocation (single device) and mass logout (`logout-all`)
  - Session hijacking defense: User-Agent and IP fingerprint verification
- **Documentation**: [Project 3 Readme](./session-Based-Authentication-3/README.md) & [Route Architecture Guide](./session-Based-Authentication-3/ROUTE_FLOW_GUIDE.md)

---

### 4. [Multi-Device Hybrid Authentication System](./multi-Device-Auth-System-4)
> **Focus**: Combining stateless JWTs with stateful Redis sessions for low-latency API verification, Refresh Token Rotation (RTR), and instant multi-device revocation.

- **Key Concepts**:
  - **Hybrid Authentication Architecture**: Ultra-fast stateless Access Tokens (JWT, 15m) for routine API calls with zero database latency, paired with stateful Refresh Tokens in Redis for real-time device tracking.
  - **Multi-Device Tracking**: Independent session creation per device with User-Agent and IP extraction (e.g. Chrome Laptop, Android Phone, Firefox macOS).
  - **Active Device Dashboard**: `GET /api/v1/auth/sessions` with contextual `isCurrentDevice` indicator.
  - **Granular Session Revocation**: Logout current device, remotely revoke a specific device, or logout all devices everywhere.
  - **Refresh Token Rotation (RTR)**: Each refresh invalidates the old token and issues a new one; session TTL is preserved via Redis `KEEPTTL`.
  - **Breach Detection Kill-Switch**: Automatic detection of token reuse; if a stolen token is submitted, the server instantly purges the entire device session.
  - **Fast Cryptographic Hashing**: SHA-256 one-way hashing for high-entropy tokens (<0.005ms) avoiding Node thread-pool bottlenecks.
  - **Two-Key Redis Indexing & Self-Healing**: `session:${sessionId}` (string with 7-day TTL) + `user_sessions:${userId}` (set index with lazy cleanup of expired keys).
  - **Post-Reset Global Eviction**: Resetting a password automatically triggers a global Redis session purge across all devices.
- **Documentation**: [Project 4 Readme](./multi-Device-Auth-System-4/README.md), [Route Flow Guide](./multi-Device-Auth-System-4/ROUTE_FLOWS.md), & [Postman Collection](./multi-Device-Auth-System-4/postman_collection.json)

---

### 5. [WorkFlowX — Complete Enterprise REST API Suite](./workFlowX-5)
> **Focus**: Comprehensive productivity and financial management suite integrating Projects, Tasks, Notes, Income/Expenses, Multi-Model Analytics, and Admin Governance.

- **Key Concepts**:
  - **Feature-Based Modular Architecture**: Domain-driven folder organization (`auth`, `users`, `projects`, `tasks`, `notes`, `transactions`, `dashboard`, `admin`).
  - **Type-Safe Runtime Validation (Zod)**: Schema enforcement, date coercions, lowercase normalizations, partial schemas for updates, and custom `.refine()` validations.
  - **Projects Management**: Complete project lifecycle tracking (`active`, `paused`, `completed`, `archived`), mandatory deadlines, tech stacks, and multi-tenant data isolation.
  - **Relational Tasks & Cross-Collection Security**: Project-scoped and standalone tasks (`project: null`), priority levels, and server-side verification ensuring referenced projects belong to the authenticated user before attachment. Foreign key resolution via `.populate('project', 'title status')`.
  - **Notes & Compound In-RAM Indexing**: Case-insensitive text search across title and content, normalized tags with `$in` array queries, and compound indexing (`{ user: 1, isPinned: -1, updatedAt: -1 }`) for sorting pinned notes first with zero in-memory sort overhead.
  - **Financial Modeling (Income & Expenses)**: Positive amount modeling rule, transaction date vs. entry timestamp, date range queries (`$gte`, `$lte`), and multi-stage aggregation pipeline calculating income, expenses, net balance, and expense breakdown by category.
  - **Real-Time Dashboard Analytics**: Single-endpoint analytical view executing 6 concurrent database operations in parallel via `Promise.all` (projects breakdown, task breakdown, overdue alerts, notes tally, finances, and upcoming tasks).
  - **Admin RBAC & Cascade Governance**: Dual-middleware guard (`authenticate` + `authorize('admin')`), platform-wide metrics, user directory, role updating, project/task moderation, cascade deletions (purging all associated child records across collections), and admin self-lockout prevention.
- **Documentation**: [WorkFlowX Master Readme](./workFlowX-5/README.md), [Route Making Flow Blueprint](./workFlowX-5/WORKFLOWX_ROUTES_MAKING_FLOW.md), & [Postman Collection](./workFlowX-5/postman.collection.json)

---

### 6. [CampusStore (CampusStoreX) — Student Marketplace & Database-First Architecture](./campusStoreX)
> **Focus**: Production-grade MongoDB & Mongoose architectural engineering. Master document modeling (Embedding vs. Referencing), snapshot denormalization, race condition prevention, multi-document ACID transactions, and advanced multi-stage aggregation analytics.

- **Key Concepts**:
  - **Database-First, Not Feature-First**: Answers the critical backend question: *"Given product requirements, how do you architect an optimal, consistent, and scalable MongoDB database?"*
  - **The 10 Master Collections**: `users`, `categories`, `products`, `inventory`, `stockTransactions`, `follows`, `carts`, `orders`, `payments`, and `reviews`.
  - **Embedded Subdocuments vs. Normalized References**:
    - Embedded: `Product.specifications` (tied lifecycle, zero joins), `Cart.items[]` (atomic 20-item bound), `Order.items[]` (frozen financial receipt).
    - Normalized References: `Inventory` (isolated write-heavy stock state), `Reviews` (prevents unbounded array growth), `Follows` (isolated $N:M$ junction).
  - **Snapshot Data (Denormalization)**: Freezes product name and price inside `Order.items[]` at the exact moment of checkout to preserve financial and accounting history regardless of future catalog price changes.
  - **Derived vs. Stored State**: Computes `available` inventory on the fly (`quantity - reserved`) via Mongoose virtuals, and derives `averageRating` via aggregation pipelines instead of storing stale fields.
  - **Race Condition Defense & Concurrency**:
    - Atomic conditional updates: `$gte` inventory checks with `$inc: { quantity: -qty }` to prevent negative stock and overselling.
    - Multi-Document ACID Transactions: Guarantees that order creation, inventory deduction, sale audit logging, mock payment generation, and cart clearing all succeed together or cleanly roll back.
  - **Immutable Append-Only Audit Ledger**: `StockTransactions` tracks every unit movement (`PURCHASE`, `SALE`, `RETURN`, `DAMAGE`, `ADJUSTMENT`) with user attribution.
  - **Compound Unique Constraints**:
    - `{ follower: 1, following: 1 }` prevents duplicate follows at the database level.
    - `{ user: 1, product: 1 }` guarantees only one review per student per product.
  - **Verified Buyer Purchase Verification**: Enforces that only students with a completed order (`status: 'COMPLETED'`) containing the product can leave reviews.
  - **7 Production Aggregation Pipelines**: Multi-stage analytics including Total Sales, Best-Selling Products (`$unwind` + `$group` + `$sort`), Sales by Category (double `$lookup` join), Seller Revenue, User Spending, and Product Stock Breakdown.
- **Documentation**: [CampusStore Readme](./campusStoreX/README.md), [Route Flow Blueprint](./campusStoreX/ROUTES_BLUEPRINT.md), & [Postman Collection](./campusStoreX/postman.collection.json)

---

### 7. [SecureVault — Secure File & Document Management Platform](./secureVault-7)
> **Focus**: Zero-trust access control, binary magic-byte sniffing, image sanitization with Sharp, storage adapter architecture (Local & Cloudinary), temporary pre-signed URLs, distributed Redis rate limiting, and automated security exploit testing.

- **Key Concepts**:
  - **Zero-Trust Access Control & IDOR Prevention**: Authorization strictly enforced at the database query level (`{ _id: docId, owner: userId }`). Accessing another user's document returns `404 Not Found` to prevent resource enumeration.
  - **Storage Adapter Architecture (Local & Cloudinary)**: Unified storage strategy (`save`, `delete`, `getStream`, `generateSignedUrl`) decoupling business logic from storage mediums.
  - **Binary Magic-Byte Inspection (`file-type`)**: Detects and rejects disguised executables and malicious scripts regardless of client-provided `Content-Type` headers.
  - **Image Sanitization via Sharp**: Automatically strips EXIF metadata (GPS, camera serials), resizes to 250x250, and transcodes user avatars into optimized WebP formats.
  - **Temporary Signed URL File Sharing**: Capability-based sharing links using 64-character high-entropy tokens, SHA-256 database hashing, expiration timestamps, access counters, and append-only audit logging.
  - **Custom Distributed Rate Limiting (Redis)**: Multi-tier sliding window and fixed window rate limiters using atomic Redis pipelines (`INCR` + `TTL`) with custom policies for login brute-force, password reset, uploads, and downloads (`429 Too Many Requests`).
  - **Multi-Device Session Store & Immediate Invalidation**: Redis session store with `KEEPTTL` Refresh Token Rotation (RTR), breach kill-switch for token reuse, and live session verification on every request.
  - **OWASP Security Testing Lab**: Automated Postman exploit suite verifying immunity against IDOR, NoSQL injection, stored XSS, MIME spoofing, brute-forcing, and email enumeration.
  - **Production Observability & Resilience**: Correlation IDs (`X-Request-ID`), deep `/health` pinging of MongoDB and Redis, and graceful shutdown handling `SIGINT`/`SIGTERM`.
- **Documentation**: [SecureVault Readme](./secureVault-7/README.md), [Route-by-Route Making Flow](./secureVault-7/SECUREVAULT_ROUTES_MAKING_FLOW.md), & [Postman Collection](./secureVault-7/postman.collection.json)

---
### 8. [OrchestriX — Distributed Job Orchestration, Real-Time Event Streaming & Hybrid Auth Engine](./orchestriX-8)
> **Focus**: Production-grade distributed systems design: Asynchronous worker processing with BullMQ, true sliding-window rate limiting via Redis Sorted Sets (`ZSET`), multi-instance event broadcasting via Redis Pub/Sub, live Server-Sent Events (SSE) progress streaming, dual-write self-healing reconciliation cron, and Dead-Letter Queue (DLQ) bulk recovery.

- **Key Concepts**:
  - **Asynchronous Worker Fleet (BullMQ)**: Decouples long-running report calculations, data exports, and email dispatches from the HTTP request cycle (`concurrency: 5`, exponential backoff `2s -> 4s -> 8s`, maximum 3 attempts).
  - **Live Multi-Stage Progress Streaming (SSE)**: Native HTTP streaming (`text/event-stream`) via `GET /api/v1/notifications/stream`. Workers emit live progress milestones (`25% -> 50% -> 75% -> 100%`) through Redis Pub/Sub directly to the user's screen in `< 5ms`.
  - **Sliding-Window Rate Limiting (Redis ZSET)**: Eliminates boundary-burst vulnerabilities inherent in naive fixed-window limiters by maintaining exact timestamps in Redis Sorted Sets with atomic multi-exec pipelines (`zremrangebyscore`, `zadd`, `zcard`, `expire`).
  - **Dual-Write Problem & Self-Healing Reconciliation Engine**: Solves cross-database atomicity failures between MongoDB and Redis. A background cron worker periodically scans for orphaned "zombie" jobs (`QUEUED` for > 60s without `bullJobId`) and re-enqueues them automatically, guaranteeing at-least-once delivery.
  - **Dead-Letter Queue (DLQ) & One-Click Bulk Recovery**: Dedicated inspection endpoints (`GET /api/v1/jobs/failed`) and bulk retry engine (`POST /api/v1/jobs/failed/retry-all`) allowing instant re-enqueueing of all exhausted jobs once external services recover.
  - **Hybrid Authentication & Deterministic Device Management**: Short-lived JWT `accessToken` in `httpOnly` cookie + stateful Redis `sessionId` store with Refresh Token Rotation (RTR), reuse breach detection kill-switch, and deterministic device dashboard sorting (`isCurrentDevice: true` pinned to index 0).
  - **High-Throughput Cache-Aside & Write Invalidation**: Read caching (`cache:user:profile:${userId}` and `cache:jobs:stats:${userId}`) returning in `< 2ms` with `X-Cache: HIT/MISS` headers and explicit invalidation hooks on profile/avatar updates.
  - **Ephemeral Container Media Storage**: In-memory buffer ingestion (`multer.memoryStorage()`) streamed directly to Cloudinary CDN via `streamifier` with smart face cropping (`gravity: 'face'`), ensuring full compatibility with serverless/containerized hosts (Railway, Render, Fly.io).
- **Documentation**: [OrchestriX Master Readme](./orchestriX-8/README.md) & [Routes Architecture & Making Flow Blueprint](./orchestriX-8/docs/ROUTES_ARCHITECTURE_FLOW.md)

---

## 🛠️ Tech Stack & Tools

- **Runtime**: Node.js (v18+ / v20+ / v22+)
- **Framework**: Express.js (v5) — ES Modules (`"type": "module"`)
- **Primary Database**: MongoDB & Mongoose ODM
- **Cache / Session Store / Rate Limiting**: Redis (via `ioredis`)
- **Queue Engine & Background Workers**: BullMQ (v5)
- **Pub/Sub & Real-Time Streaming**: Redis Pub/Sub, Server-Sent Events (SSE)
- **Logging & Tracing**: Pino, Pino-HTTP, `X-Request-ID` correlation IDs
- **Schema Validation**: Zod (v4)
- **Security & Cryptography**: `bcrypt`, `jsonwebtoken`, Node native `crypto`, `helmet`
- **File Ingestion & Processing**: `multer`, `file-type`, `sharp`
- **Cloud Object Storage**: `cloudinary`, `streamifier`
- **Networking & Utilities**: `cookie-parser`, `nodemailer`, `dotenv`, `cors`

---

##  Quick Start Guide

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/backend-project-learning.git
cd backend-project-learning
```

### 2. Choose Any Project to Run
Each project is completely self-contained. Navigate to the project you wish to study:

```bash
# Example: Running WorkFlowX (Project 5)
cd workFlowX-5
```

### 3. Setup Environment Variables
Every project includes an `.env.example` file. Copy it to create your `.env`:

```bash
# On Windows (PowerShell):
Copy-Item .env.example .env

# On Mac / Linux:
cp .env.example .env
```

Open `.env` and fill in your MongoDB URI, Redis credentials, and JWT secrets.

### 4. Install Dependencies & Start Server
```bash
# Install dependencies
npm install

# Start in development mode
npm start
```

---

##  Security Best Practices Followed

- **Never Commit Secrets**: Real credentials and `.env` files are strictly excluded via `.gitignore`. Templates are provided in `.env.example`.
- **HTTP-Only Cookies**: Prevents Cross-Site Scripting (XSS) from reading sensitive authentication tokens.
- **Password Hashing**: Salts and hashes passwords with `bcrypt` (10–12 salt rounds).
- **Fast Token Hashing**: SHA-256 one-way hashing for high-entropy tokens (<0.005ms) avoiding Node thread-pool bottlenecks.
- **Session Hijacking Defense**: Session requests validate the client's User-Agent and IP against the stored fingerprint.
- **Refresh Token Rotation (RTR) & Kill-Switch**: Automatic reuse detection instantly revokes compromised sessions.
- **Multi-Tenant Data Isolation**: All database queries enforce `{ user: req.user._id }` ensuring zero cross-tenant data leakage.
- **Cross-Collection Authorization**: Verifies foreign key ownership before allowing attachments between entities (e.g. tasks/notes to projects).
- **Fail-Safe Revocation**: Supports instantaneous session destruction across distributed clusters using Redis.
- **Cascade Deletion**: Admin deletions automatically purge all orphaned child documents across all collections.

---

##  License
This repository is open-source and available under the [MIT License](LICENSE).

