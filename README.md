#  Backend Development Learning Series

A comprehensive, hands-on backend learning repository demonstrating the evolution of modern authentication, authorization, and session architectures using **Node.js**, **Express**, **MongoDB**, and **Redis**.

This repository is designed for developers, students, and engineers who want to study production-grade backend design patterns from first principles.

---

##  Curriculum & Projects Overview

The projects are structured sequentially, progressing from token-based authentication to advanced distributed session management:

```
  Backend-Project-Learning/
    |
    ├── secure-Api-Project-1/             # Phase 1: Stateless JWT Authentication
    ├── role-Based-Api-2/                 # Phase 2: Role-Based Access Control (RBAC)
    ├── session-Based-Authentication-3/   # Phase 3: Stateful Distributed Sessions with Redis
    └── multi-Device-Auth-System-4/       # Phase 4: Multi-Device Hybrid Auth (JWT + Redis RTR)
```

---

### 1. [Secure API & JWT Authentication](./secure-Api-Project-1)
> **Focus**: Stateless authentication, token lifecycle, and secure cookie storage.

- **Key Concepts**:
  - User registration & password hashing with \crypt\
  - Dual-token architecture: Short-lived Access Token (15 min) + Long-lived Refresh Token (7 days)
  - Storing tokens securely in \httpOnly\, \sameSite\, \secure\ cookies
  - Refresh token rotation & blacklisting
  - Time-limited password reset flow with Nodemailer & Gmail SMTP
  - Global error handling and custom API response structures
- **Documentation**: [Project 1 Readme](./secure-Api-Project-1/README.md) & [Route Flow Guide](./secure-Api-Project-1/ROUTE_FLOWS.md)

---

### 2. [Role-Based Access Control (RBAC) API](./role-Based-Api-2)
> **Focus**: Granular authorization, permission layers, and administrator dashboards.

- **Key Concepts**:
  - Hierarchical roles: \USER\, \MODERATOR\, and \ADMIN\
  - Reusable role-authorization middleware (\
equireRole('ADMIN')\)
  - Admin management features: Ban/unban accounts, force role adjustments, account deletion
  - Dual authentication token support: HTTP-only cookies and \Authorization: Bearer <token>\ headers
  - Centralized validation and clean layered architecture (Routes → Controllers → Services → Models)
- **Documentation**: [Project 2 Readme](./role-Based-Api-2/README.md) & [Route Flow Guide](./role-Based-Api-2/ROUTE_FLOWS.md)

---

### 3. [Session-Based Authentication System](./session-Based-Authentication-3)
> **Focus**: Production-grade stateful sessions built from scratch without black-box packages like \express-session\.

- **Key Concepts**:
  - Custom 32-byte cryptographically secure session IDs via Node's \crypto\
  - Redis store for high-speed in-memory session persistence
  - Dual-layer expiration: Redis TTL key expiration + lazy middleware checks
  - Multi-device login tracking using Redis Sets (\user_sessions:userId\)
  - Targeted revocation (single device) and mass logout (\logout-all\)
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

##  Tech Stack & Tools

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js (v5)
- **Primary Database**: MongoDB & Mongoose ODM
- **Cache / Session Store**: Redis (via \ioredis\ or Upstash)
- **Security & Cryptography**: \crypt\, \jsonwebtoken\, Node \crypto\
- **Networking & Utilities**: \cookie-parser\, \
odemailer\, \dotenv\, \cors\

---

##  Quick Start Guide

### 1. Clone the Repository
\\\ash
git clone https://github.com/<your-username>/backend-project-learning.git
cd backend-project-learning
\\\

### 2. Choose Any Project to Run
Each project is completely self-contained. Navigate to the project you wish to study:

\\\ash
# Example: Running Project 3
cd session-Based-Authentication-3
\\\

### 3. Setup Environment Variables
Every project includes an \.env.example\ file. Copy it to create your \.env\:

\\\ash
# On Windows (PowerShell):
Copy-Item .env.example .env

# On Mac / Linux:
cp .env.example .env
\\\

Open \.env\ and fill in your MongoDB URI, Redis credentials, and JWT secrets.

### 4. Install Dependencies & Start Server
\\\ash
# Install dependencies
npm install

# Start in development mode
npm start
\\\

---

##  Security Best Practices Followed

- **Never Commit Secrets**: Real credentials and \.env\ files are strictly excluded via \.gitignore\. Templates are provided in \.env.example\.
- **HTTP-Only Cookies**: Prevents Cross-Site Scripting (XSS) from reading sensitive authentication tokens.
- **Password Hashing**: Salts and hashes passwords with \crypt\ (10–12 salt rounds).
- **Session Hijacking Defense**: Session requests validate the client's \User-Agent\ against the stored fingerprint.
- **Fail-Safe Revocation**: Supports instantaneous session destruction across distributed clusters using Redis.

---

##  Contributing & Feedback

Contributions, corrections, and improvements are welcome! If you find a bug or want to suggest an architecture pattern:
1. Fork the repository
2. Create your feature branch (\git checkout -b feature/awesome-feature\)
3. Commit your changes (\git commit -m 'Add awesome feature'\)
4. Push to the branch (\git push origin feature/awesome-feature\)
5. Open a Pull Request

---

##  License
This project is open-source and available under the [MIT License](LICENSE).
