# SecureVault — Enterprise File & Document Management Platform

> **SecureVault** is an enterprise-grade, zero-trust backend API for uploading, organizing, sharing, and downloading confidential documents and profile media. It synthesizes **7 core backend engineering domains**—including distributed rate limiting, cryptographic session rotation, magic-byte file validation, image sanitization with Sharp, cloud storage abstraction (Cloudinary), and automated exploit defense—into a single production-ready platform.

---

##  Table of Contents
1. [Core Identity & Fundamental Invariants](#1-core-identity--fundamental-invariants)
2. [How SecureVault Covers 7 Backend Projects](#2-how-securevault-covers-7-backend-projects)
3. [End-to-End System Architecture](#3-end-to-end-system-architecture)
4. [Storage Strategy & Cloudinary Integration](#4-storage-strategy--cloudinary-integration)
5. [The 10 Implementation Phases](#5-the-10-implementation-phases)
6. [Security Testing Lab & Exploit Verification](#6-security-testing-lab--exploit-verification)
7. [Tech Stack & Package Ecosystem](#7-tech-stack--package-ecosystem)
8. [Folder & Feature Architecture](#8-folder--feature-architecture)
9. [Environment Setup & Installation](#9-environment-setup--installation)
10. [Route Documentation](#10-route-documentation)

---

## 1.  Core Identity & Fundamental Invariants

SecureVault bridges two traditionally distinct systems:
1. **A Zero-Trust Document Locker**: A confidential private document repository where users upload, organize, inspect, and retrieve confidential records (e.g., identity documents, contracts, financial records).
2. **A Controlled Sharing Engine**: An auditable file distribution engine using revocable, temporary access grants and cryptographically signed URLs.

###  Fundamental Security Invariants
* **Authentication $\neq$ Authorization**: Authenticated users have zero inherent rights to any resource other than what their identity explicitly owns (`owner: req.user._id`) or has been granted via an active, unexpired sharing policy.
* **Metadata $\neq$ Binary Blobs**: MongoDB never stores raw file bytes. MongoDB stores only indexed metadata (keys, size, MIME type, owner, timestamps). Files live strictly outside the web root or in private cloud buckets.
* **Never Trust the Client**: Client-provided MIME types (`file.mimetype`) and file extensions (`.pdf`, `.png`) are untrusted. SecureVault inspects binary magic bytes before allocating storage.
* **Instant Revocation**: JWT access tokens are validated against live Redis session states on every protected request. Logging out or changing passwords immediately terminates access across all devices.

---

## 2.  How SecureVault Covers 7 Backend concepts 

Instead of building isolated toy projects, SecureVault synthesizes 7 real-world backend engineering systems into one cohesive codebase:

```
                           SECUREVAULT PLATFORM
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
 [1: Auth API]                [2: File Access]              [3: Rate Limiter]
• Bcrypt cost 12          • SHA-256 share tokens        • Redis pipeline counters
• Redis device sessions   • Max download counters       • IP & User sliding windows
• Refresh token rotation  • Instant link revocation     • Brute-force protection
• Zod password policy     • Audit access logs           • 429 Retry-After headers
    │                               │                               │
    ├───────────────────────────────┼───────────────────────────────┤
    ▼                               ▼                               ▼
 [4: Security Lab]           [5: Avatar API]                  [6: Doc Vault]
• Automated IDOR tests    • Multer memory streaming     • Private PDF lifecycle
• NoSQL injection tests   • Magic-byte verification     • Database query scoping
• Stored XSS defense      • Sharp EXIF stripping        • Safe attachment headers
• Brute-force checks      • Safe replacement pattern    • Orphan file cleanup
    │                               │                               │
    └───────────────────────────────┼───────────────────────────────┘
                                    ▼
                           [7: Cloud Storage API]
                      • Storage Adapter Pattern (Local & Cloud)
                      • Cloudinary Private/Authenticated Buckets
                      • Expiring Signed Download URLs
```

---

## 3.  End-to-End System Architecture

Every HTTP request traverses an isolated multi-tier defense pipeline before touching business logic or storage:

```
[ Client: Postman / Browser / SPA ]
                │
                ▼ (HTTP / HTTPS)
    ┌───────────────────────────┐
    │     Express Gateway       │
    └─────────────┬─────────────┘
                  │
                  ▼
    ┌───────────────────────────┐
    │    Security Middleware    │ ◄── Helmet, CORS Allowlist, Rate Limiting (Redis)
    └─────────────┬─────────────┘
                  │
                  ▼
    ┌───────────────────────────┐
    │   Authentication Layer    │ ◄── JWT Verification + Redis Session State Check
    └─────────────┬─────────────┘
                  │
                  ▼
    ┌───────────────────────────┐
    │ Input Validation & Upload │ ◄── Zod Schema Validation, Multer, Magic-Byte MIME
    └─────────────┬─────────────┘
                  │
                  ▼
    ┌───────────────────────────┐
    │        Controllers        │ ◄── Protocol translation (Status codes, Headers, DTOs)
    └─────────────┬─────────────┘
                  │
                  ▼
    ┌───────────────────────────┐
    │      Service Layer        │ ◄── Pure business logic & authorization enforcement
    └───────┬───────────┬───────┘
            │           │
   ┌────────┴─────┐     └─────────────┐
   ▼              ▼                   ▼
┌──────────────┐ ┌─────────────────┐ ┌───────────────────────────────────┐
│   MongoDB    │ │      Redis      │ │      Storage Abstraction          │
│ (Metadata,   │ │ (Rate limits,   │ │  ┌───────────────┬──────────────┐ │
│  Audit Logs, │ │  Active device  │ │  │ Local Disk    │ Cloudinary   │ │
│  Users)      │ │  sessions)      │ │  │ (Development) │ (Production) │ │
│              │ │                 │ │  └───────────────┴──────────────┘ │
└──────────────┘ └─────────────────┘ └───────────────────────────────────┘
```

---

## 4.  Storage Strategy & Cloudinary Integration

SecureVault implements the **Storage Adapter / Strategy Pattern**. Route handlers and document services never interact directly with filesystems or cloud SDKs. They communicate solely through the unified `IStorageService` interface:

* `storage.save(key, buffer, mimeType)`
* `storage.getStream(key)`
* `storage.delete(key)`
* `storage.generateSignedUrl(key, expiresInSeconds)`

### Cloudinary Privacy & Delivery Types
* **Public Avatars (`isImage = true`)**: Uploaded with `type: 'upload'` and `resource_type: 'image'`. Delivered directly via CDN for fast frontend rendering.
* **Confidential Documents (`isImage = false`)**: Uploaded with **`type: 'authenticated'`** and `resource_type: 'raw'`. 
  * Cloudinary rejects any direct public URL with `401 Unauthorized`.
  * Downloads require an expiring, cryptographically signed URL (`cloudinary.utils.private_download_url`) with `attachment: true`.

---

## 5.  The 10 Implementation Phases

SecureVault was constructed methodically across 10 progressive phases:

| Phase | Title | Milestone Achieved |
|---|---|---|
| **Phase 1** | **Project Foundation** | Express scaffolding, Mongoose & Redis clients, centralized `AppError`, and `catchAsync`. |
| **Phase 2** | **Secure Authentication API** | User registration, bcrypt hashing (cost 12), JWT access tokens, Redis multi-device session store (`KEEPTTL`), token-reuse detection, and Zod password policy. |
| **Phase 3** | **Rate Limiting Service** | Custom multi-tier rate limiter built from scratch. Atomic Redis pipelines (`INCR` + `TTL`), IP sliding windows, user-based limits, and brute-force login protection (`429 Too Many Requests`). |
| **Phase 4** | **Profile Image Upload API** | Multer memory buffer ingestion, binary magic-byte detection via `file-type`, Sharp image processing (resizing to 250x250, EXIF stripping, WebP conversion), and safe replacement pattern. |
| **Phase 5** | **Private Document Management** | Private PDF uploads, metadata catalog, and secure streaming. Elimination of Insecure Direct Object References (IDOR/BOLA) via database-scoped queries (`{ _id: docId, owner: userId }`). |
| **Phase 6** | **Secure File Sharing** | Temporary signed access grants. Unguessable 64-character tokens, SHA-256 database storage, expiration timestamps, access count limits, and append-only audit logging. |
| **Phase 7** | **Cloud File Storage API** | Decoupling the application from local disk storage using the Storage Adapter Pattern. Full integration with Cloudinary private/authenticated storage and pre-signed download URLs. |
| **Phase 8** | **Security Testing Lab** | Deliberate vulnerability testing against the API: IDOR, NoSQL injection, stored XSS, MIME spoofing, token invalidation, and email enumeration. Verified via automated Postman tests. |
| **Phase 9** | **Operational Security & Scalability** | Correlation IDs (`X-Request-ID`), structured logging, deep `/health` checks pinging both MongoDB and Redis, and graceful shutdown handling (`SIGINT`/`SIGTERM`). |
| **Phase 10** | **Production-Style Review** | Comprehensive audit across Authentication, File Storage, Infrastructure, and Least-Privilege deployment checklists. |

---

## 6.  Security Testing Lab & Exploit Verification

SecureVault includes an automated test suite verifying defense against the top OWASP API security threats:

| Attack Vector | Exploit Payload Tested | Defense Mechanism | Verified Response |
|---|---|---|---|
| **IDOR / BOLA** | User B requests User A's `documentId` | Scoped DB query: `findOne({ _id: docId, owner: userId })` | `404 Document not found` |
| **NoSQL Injection** | `{ "password": { "$ne": "any" } }` | Strict Zod runtime schema type enforcement | `400 expected string, received object` |
| **MIME Spoofing** | Renamed `fake.exe` / `test.txt` to `test.pdf` | Binary magic-byte header inspection (`%PDF-`) | `400 Invalid file format` |
| **Stored XSS** | Filename `<script>alert(1)</script>.pdf` | Path regex sanitization: `replace(/[^a-zA-Z0-9._-]/g, '_')` | Sanitized to `_script_alert_1___script_.pdf` |
| **Brute Force** | 6 rapid login attempts with wrong passwords | Redis atomic counter rate limiter (5 req / 15 min) | `429 Too Many Requests` + `Retry-After` |
| **Session Revocation** | Using valid 15m JWT after calling `/logout` | `authenticate` middleware verifies Redis session state | `401 Session has expired or been revoked` |
| **User Enumeration** | Forgot password with unregistered email | Identical response message returned silently | `200 Password reset link sent if account exists` |

---

## 7.  Tech Stack & Package Ecosystem

- **Runtime**: Node.js (v18+) — ES Modules (`"type": "module"`)
- **HTTP Framework**: Express.js (v5)
- **Primary Database**: MongoDB & Mongoose ODM (Metadata, Users, Shares, Audit Logs)
- **In-Memory Cache / Coordination**: Redis (via `ioredis`) for atomic rate limiting and active device sessions
- **Authentication**: `jsonwebtoken` (Access Tokens) + Native `crypto` (Opaque Refresh Tokens & Hashes)
- **Password Hashing**: `bcrypt` (12 Salt Rounds)
- **Input Validation**: `zod`
- **Multipart Ingestion**: `multer` (Memory storage streams)
- **Binary MIME Sniffing**: `file-type` (Header magic bytes inspection)
- **Image Processing**: `sharp` (EXIF stripping, WebP conversion, 250x250 resizing)
- **Cloud Object Storage**: `cloudinary` + `streamifier`
- **Security Middleware**: `helmet`, `cors`, `cookie-parser`
- **Email Delivery**: `nodemailer`

---

## 8.  Folder & Feature Architecture

SecureVault follows a **Domain-Driven, Feature-Based Modular Architecture**:

```text
secureVault-7/
├── uploads/                              # Local storage fallback (gitignored)
│   ├── avatars/
│   └── documents/
├── src/
│   ├── config/
│   │   ├── db.js                         # Resilient MongoDB connection
│   │   └── redis.js                      # ioredis client with reconnect listeners
│   ├── features/
│   │   ├── auth/                         # Authentication, Passwords, Multi-Device Sessions
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.middleware.js
│   │   │   ├── auth.model.js
│   │   │   ├── auth.route.js
│   │   │   ├── auth.services.js
│   │   │   └── auth.validation.js
│   │   ├── users/                        # User Profile & Avatar Ingestion
│   │   │   ├── user.controller.js
│   │   │   ├── user.route.js
│   │   │   └── user.service.js
│   │   ├── documents/                    # Private Document Management System
│   │   │   ├── document.controller.js
│   │   │   ├── document.model.js
│   │   │   ├── document.route.js
│   │   │   └── document.service.js
│   │   ├── shares/                       # Temporary Signed Links & Audit Trails
│   │   │   ├── share.controller.js
│   │   │   ├── share.model.js
│   │   │   ├── share.route.js
│   │   │   └── share.service.js
│   │   └── storage/                      # Storage Abstraction Layer (Adapter Pattern)
│   │       ├── cloudinary.storage.js
│   │       ├── local.storage.js
│   │       └── index.js
│   ├── middlewares/
│   │   ├── error.middleware.js           # Centralized global error handler
│   │   ├── rateLimiter.middleware.js     # Redis atomic fixed/sliding rate limiter
│   │   ├── requestId.middleware.js       # Correlation ID (X-Request-ID)
│   │   └── upload.middleware.js          # Multer memory stream + magic-byte validator
│   ├── stores/
│   │   └── redis.sessions.store.js       # Multi-device session manager with self-healing sets
│   ├── utils/
│   │   ├── appError.js                   # Operational error wrapper
│   │   ├── catchAsync.js                 # Async controller wrapper
│   │   ├── deviceInfo.js                 # User-Agent & trusted IP extractor
│   │   ├── sendEmail.js                  # Nodemailer transport
│   │   └── token.js                      # JWT and high-entropy crypto token generators
│   ├── app.js                            # Express app configuration & middleware pipeline
│   └── server.js                         # Top-level DB await & graceful shutdown handler
├── .env.example
├── package.json
├── postman.collection.json               # Complete automated Postman test suite
├── README.md                             # Master documentation
└── SECUREVAULT_ROUTES_MAKING_FLOW.md     # Route-by-route implementation guide
```

---

## 9.  Environment Setup & Installation

### 1. Prerequisites
- Node.js (v18 or higher)
- MongoDB instance (local or Atlas)
- Redis instance (local or Redis Cloud)
- Cloudinary account (Cloud Name, API Key, API Secret)

### 2. Installation
```bash
git clone https://github.com/<your-username>/backend-project-learning.git
cd backend-project-learning/secureVault-7
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate the required credentials:
```env
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/securevault
REDIS_URI=redis://127.0.0.1:6379

ACCESS_TOKEN_SECRET=your_jwt_access_secret_key_here
ACCESS_TOKEN_EXPIRES_IN=15m

EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
FRONTEND_URL=http://localhost:5173

STORAGE_DRIVER=cloudinary
LOCAL_STORAGE_PATH=./uploads

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 4. Run Development Server
```bash
npm run dev
```

---

## 10.  Route Documentation

For the complete, step-by-step implementation guide covering **every single route**, their architectural making flows, topics used, and package dependencies, refer to:

👉 **[Complete Route-by-Route Making Flow Guide (`SECUREVAULT_ROUTES_MAKING_FLOW.md`)](./SECUREVAULT_ROUTES_MAKING_FLOW.md)**

