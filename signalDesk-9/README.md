# SignalDesk — Real-Time Incident Intelligence & Collaboration Platform

> **An enterprise incident intelligence and war room platform engineered for high-concurrency investigations, conflict-free collaborative editing (CRDTs), real-time investigator presence, evidence image pipelines, Redis cache-aside aggregations, and large-dataset search.**

---

## 🌟 Executive Summary

When mission-critical infrastructure experiences downtime (e.g. *INC-1042: Production API returning HTTP 500*), engineering organizations cannot rely on disjointed chat apps, fragmented docs, and slow database queries. 

**SignalDesk** is an incident management platform built around:
1. **Dual Real-Time Layers**:
   - **Socket.IO (Port 3000)**: Ephemeral multi-tab presence, typing indicators, incident group chat, direct messaging, and durable real-time notifications.
   - **Hocuspocus + Yjs CRDT (Port 1234)**: Conflict-free concurrent editing of investigation documents by 10+ engineers simultaneously with automatic convergence, Yjs Awareness live cursors, and binary BSON persistence.
2. **Deterministic Lifecycle & Auditing**:
   - Strict **Finite State Machine (FSM)** incident lifecycles (`REPORTED` ➔ `ACKNOWLEDGED` ➔ `INVESTIGATING` ➔ `RESOLVED` ➔ `CLOSED`).
   - Immutable timeline audit log tracking every status transition, assignment, evidence upload, and comment.
3. **High-Performance Infrastructure**:
   - In-memory image processing pipeline using **Sharp** (magic-byte validation, EXIF metadata stripping, WebP thumbnail & display generation, and Cloudinary CDN streaming).
   - Redis **Cache-Aside** architecture with **deterministic invalidation** for executive analytics dashboards.
   - **Big Data Seeding Engine** (1,000 to 100,000+ records) with **Keyset / Cursor Pagination** ($O(1)$ constant-time queries) and `.explain('executionStats')` profiling.

---

## 📐 High-Level System Architecture

```text
                                 SIGNALDESK
                                      │
                 ┌────────────────────┴────────────────────┐
                 │                                         │
                 ▼                                         ▼
   [ Port 3000: Express API Gateway ]        [ Port 1234: Hocuspocus Gateway ]
   - Hybrid JWT & Redis Sessions             - Dedicated Yjs WebSocket Gateway
   - REST API Modules (CRUD, Teams)          - CRDT Document Synchronization
   - Socket.IO Real-Time Engine              - Yjs Awareness (Live Cursors)
   - Multi-Tab Presence Registry             - Auto-debounced MongoDB saves
                 │                                         │
                 ├────────────────────┬────────────────────┤
                 ▼                    ▼                    ▼
        [ MongoDB Database ]     [ Redis Cache ]     [ Cloudinary CDN ]
        - Persistent Documents   - Sessions & TTL    - Optimized Evidence
        - Binary Yjs State       - Presence Sets     - WebP Thumbnails
        - Timeline & History     - Analytics Cache   - Display Variants
```

---

## 🛠️ Technology Stack & Responsibilities

| Technology | Role & Engineering Responsibility |
| :--- | :--- |
| **Node.js (v22+)** | Asynchronous event-loop backend runtime |
| **Express.js (v5)** | REST API Gateway, routing, request validation, centralized error handling |
| **MongoDB (v7)** | Primary durable database (Relational references, compound indexes, timeline logs, and binary BSON) |
| **Mongoose (v9)** | Object Document Modeling (ODM), schema strictness, compound indexes, and `$facet` aggregations |
| **Socket.IO (v4)** | Duplex WebSocket gateway for chat, typing indicators, presence broadcasts, and push alerts |
| **Yjs (v13)** | Conflict-free Replicated Data Types (CRDT) engine for real-time document synchronization |
| **Hocuspocus (v4)** | Dedicated collaborative WebSocket server managing Yjs documents and Awareness |
| **Redis (v7) / ioredis** | Stateful session storage, multi-tab presence sets, and cache-aside query caching |
| **Sharp** | High-performance image processing (resizing, WebP conversion, auto-rotation, EXIF stripping) |
| **Multer & Streamifier** | In-memory buffer ingestion (`memoryStorage`) with streaming directly to Cloudinary CDN |
| **File-Type** | Binary magic-byte sniffing to defeat polyglot file attacks |
| **Cloudinary** | Cloud object storage and global CDN delivery for evidence screenshots |
| **Zod** | Compile-time and runtime payload validation and fail-fast environment variable verification |
| **JWT & Bcrypt** | Stateless Access Tokens paired with stateful Refresh Token Rotation (RTR) |
| **Pino & Pino-HTTP** | High-speed structured JSON logging with correlation IDs (`X-Request-ID`) |

---

## 📂 Feature-Based Project Structure

```text
signalDesk-9/
├── .env
├── .env.example
├── docker-compose.yml
├── package.json
├── ROUTE_ARCHITECTURE_GUIDE.md        # Comprehensive making flow blueprint for every endpoint
├── README.md                          # Master project documentation
└── src/
    ├── app.js                         # Express app configuration & middleware pipeline
    ├── server.js                      # Dual server bootstrap (Express/Socket.IO on 3000 + Hocuspocus on 1234)
    │
    ├── config/                        # Core infrastructure configs
    │   ├── db.js                      # MongoDB connection & disconnect handlers
    │   ├── redis.js                   # Redis connection client
    │   ├── env.js                     # Zod-validated environment schema
    │   ├── logger.js                  # Pino structured logging
    │   ├── email.js                   # Nodemailer SMTP transporter
    │   └── cloudinary.storage.js      # Cloudinary CDN integration & stream uploaders
    │
    ├── middlewares/                   # Cross-cutting HTTP middlewares
    │   ├── error.middleware.js        # Global error interceptor (operational vs programming)
    │   ├── rateLimiter.middleware.js  # Tiered rate limiting guards
    │   ├── requestId.middleware.js    # UUID request correlation injection
    │   └── upload.middleware.js       # Multer RAM storage & magic-byte validation
    │
    ├── utils/                         # Reusable core helpers
    │   ├── appError.js                # Custom operational error class
    │   ├── catchAsync.js              # Async wrapper eliminating try/catch boilerplate
    │   ├── token.js                   # JWT generation & hashing utilities
    │   └── cache.js                   # Generic Redis cache helper
    │
    ├── sockets/                       # Real-Time Socket.IO Infrastructure
    │   ├── socket.server.js           # Server initialization & singleton getter (`getIO`)
    │   └── socket.auth.js             # Handshake JWT authentication & Redis session verification
    │
    ├── collaboration/                 # CRDT Collaborative Infrastructure
    │   ├── hocuspocus.server.js       # Hocuspocus server initialization & debounced DB persistence
    │   └── hocuspocus.auth.js         # Hocuspocus JWT verification & team membership authorization
    │
    └── features/                      # Modular Business Domains
        ├── auth/                      # User authentication, hybrid JWTs & multi-device Redis sessions
        ├── teams/                     # Investigation teams, memberships & lead RBAC
        ├── incidents/                 # Incident workspace, strict FSM lifecycle & audit timeline
        ├── evidence/                  # Sharp image processing pipeline (WebP, thumbnails, magic-bytes)
        ├── presence/                  # Multi-tab connection tracking, online/offline & typing indicators
        ├── chat/                      # 1-to-1 & incident group chat with persist-then-broadcast & cursor pagination
        ├── notes/                     # CRDT-backed investigation notebook & milestone snapshots
        │   └── history/               # Document history & periodic snapshot tracking
        ├── notifications/             # Event-driven durable notification engine & user socket rooms
        ├── analytics/                 # Redis cache-aside dashboard & single-pass $facet aggregation
        └── search/                    # Large dataset search, keyset cursor pagination & .explain() profiler
            └── seeds/                 # Batched big-data seeder (1k, 10k, 100k records)
```

---

## 🚀 Key Architectural Features & Solutions

### 1. Conflict-Free Collaborative Notes (CRDTs + Hocuspocus)
* **The Problem**: In major outages, 10+ engineers edit different sections of an incident doc simultaneously. Optimistic Concurrency Control (OCC) fails repeatedly with `409 Conflict`, blocking investigation progress.
* **The Solution**: Full CRDT integration via **Yjs** and **Hocuspocus**. Edits are represented as binary update operations. They merge deterministically with zero conflict errors.
* **Storage**: Document metadata is stored in `Note`, while raw compiled CRDT state vectors are stored as binary BSON (`Buffer`) in `CollaborativeDocument`, debounced automatically every 3 seconds.

### 2. Multi-Tab Presence Engine (Redis Sets)
* **The Problem**: If an investigator opens SignalDesk in 2 tabs and closes 1 tab, naively setting `isOnline: false` displays them as offline even though Tab 2 is still open.
* **The Solution**: Active socket IDs are tracked in Redis Sets (`presence:user_sockets:<userId>`). A user is only declared `offline` and their durable `lastSeen` timestamp updated in MongoDB when their active socket count reaches exactly zero.

### 3. Persist-Then-Broadcast Chat (Socket.IO)
* **The Problem**: Chat messages broadcasted before saving are lost if the database throws an error or the network drops.
* **The Solution**: Every message is validated and persisted to MongoDB first, confirmed to the client via Socket.IO Acknowledgment (`ack({ status: 'ok', data: message })`), and then broadcasted to authorized rooms (`incident:<id>` or `conversation:<id>`).

### 4. Ephemeral Typing Indicators with Safety Timeouts
* Ephemeral `typing:start` and `typing:stop` events broadcast within incident rooms without polluting the database.
* Server-side `setTimeout` cleanup (4-second window) automatically clears stale indicators if a client tab crashes or disconnects.

### 5. In-Memory Image Pipeline (Sharp + Cloudinary)
* Accepts evidence uploads up to 10MB in memory without creating temporary files on host disks.
* Verifies true file signatures using `file-type` to block polyglot malware.
* Strips privacy-invasive EXIF/GPS metadata, auto-rotates, and produces two optimized WebP variants:
  - **Thumbnail**: 200x200 cover crop WebP for fast chat and list previews.
  - **Display Variant**: Max 1600px width/height WebP for high-res investigation review.

### 6. High-Performance Incident Analytics (Redis Cache-Aside)
* Computes multi-metric operational stats (open, critical, resolved, and Mean Time to Resolution in minutes) using a single-pass MongoDB `$facet` aggregation pipeline.
* Cached in Redis with a 15-minute TTL.
* **Deterministic Cache Invalidation**: Creating an incident or updating its status automatically invalidates the global and team-specific cache keys, guaranteeing real-time accuracy without stale data.

### 7. Keyset / Cursor Pagination & Big Data Seeding
* Features a high-volume deterministic seeding script (`seedIncidents.js`) capable of inserting 1,000, 10,000, or 100,000+ realistic incidents in batches.
* Provides **Keyset / Cursor Pagination** (`(createdAt, _id)` range queries) that execute in $O(1)$ constant time regardless of dataset depth, outperforming traditional offset pagination (`skip`).
* Verified using MongoDB `.explain('executionStats')` confirming index scans (`IXSCAN`) and zero collection scans (`COLLSCAN`).

---

## ⚡ Quick Start Guide

### 1. Prerequisites
* Node.js v20+ or v22+
* Docker Desktop (for MongoDB and Redis)

### 2. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env
```
Ensure your `.env` contains valid credentials for MongoDB, Redis, JWT secrets, and Cloudinary.

### 3. Start Database & Cache Containers
```bash
docker compose up -d
```
Starts:
* **MongoDB 7.0**: Port `27017` (container `signaldesk_mongo`)
* **Redis 7.2**: Port `6379` (container `signaldesk_redis`)

### 4. Install Dependencies
```bash
npm install
```

### 5. Start Development Server
```bash
npm run dev
```

Output:
```text
[INFO] Initializing services...
[INFO] MongoDB connection established
[INFO] Redis socket connected
[INFO] Redis ready to accept commands
[INFO] SMTP transporter verified and ready to send emails
[INFO] Hocuspocus Collaboration Server listening on port 1234
[INFO] SignalDesk Server running on port 3000
```

---

## 🧪 Testing & Verification

### 1. Seed Realistic Incidents for Performance Testing
```bash
# Seed 1,000 records
node src/features/search/seeds/seedIncidents.js

# Or seed 10,000 records
SEED_COUNT=10000 node src/features/search/seeds/seedIncidents.js
```

### 2. Test Real-Time Collaboration (CRDT Client Script)
Run the automated multi-client convergence test in a separate terminal:
```bash
node test-crdt.js
```
Simulates two investigators editing simultaneously on `ws://localhost:1234` and proves state convergence without conflict errors!

---

## 📖 Complete API & Route Architecture Guide
For the complete step-by-step implementation blueprint of every single route, controller, service, validation schema, and WebSocket event, refer to:
👉 **[ROUTE_ARCHITECTURE_GUIDE.md](./ROUTE_ARCHITECTURE_GUIDE.md)**

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
