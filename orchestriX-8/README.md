# 1. The Core Philosophy: Engineering Beyond CRUD

Traditional backend tutorials treat each feature as an isolated, linear request-response path:
HTTP Request
⟶
Controller
⟶
Database
⟶
HTTP Response
HTTP Request⟶Controller⟶Database⟶HTTP Response

orchestrix changes this paradigm entirely. It treats operations as event-driven, decoupled lifecycles:

Long-running work (report generation, batch exports) is decoupled from the HTTP cycle via asynchronous background queues (BullMQ).
External I/O risks (SMTP server downtime, network latency) do not block or fail user-facing endpoints.
State is distributed across tiers based on durability and speed requirements (persistent storage vs. high-velocity operational state).

# 2. Architectural Boundaries: Who Owns What?

One of the most important backend design skills is avoiding conflation between layers:

Layer / Technology	Responsibility	What it Stores	What it NEVER Stores
MongoDB (Mongoose)	Durable Business Truth	User profiles, password hashes, application-level job audits, persistent in-app notifications, delivery logs, workflow definitions.	Ephemeral queue offsets, high-velocity rate counters, active session payloads.
Redis	Operational Data Store	Session IDs & payloads, cache-aside read caches, sliding-window rate limit counters, temporary lock/idempotency keys.	Long-term history, authoritative persistent audit logs.
BullMQ (over Redis)	Queue & Job Lifecycle Engine	BullMQ internal job state machine (waiting, active, delayed, failed, completed), retry backoffs, worker concurrency locks.	Application-specific business reports or long-term notification records.
Redis Pub/Sub	Ephemeral Broadcaster	Real-time event notifications pushed to connected, live API instances.	Messages needing guaranteed persistence (fire-and-forget: disconnected subscribers lose messages).

# 3. Critical Distributed Systems Challenges to Master

As we move through the phases, the primary value will come from tackling edge cases that break naive implementations:

The Dual-Write Problem (MongoDB + BullMQ Queueing):
The Problem: Creating a user in MongoDB and subsequently queueing a verification email in Redis via two independent network calls means if the worker/server crashes between them, the user exists but the email is never sent.
The Solution (Phase 14): The Transactional Outbox Pattern (storing an outbox record inside a MongoDB transaction, polled or dispatched reliably to BullMQ with idempotent processing downstream).
At-Least-Once Delivery & Idempotency:
SMTP delivery and network timeouts mean workers may retry a job that partially completed or succeeded right before a network disconnect.
Every job processor must be designed with idempotency keys so duplicate execution does not result in duplicate side-effects (e.g., duplicate emails, double deductions, repeated notifications).
Application State vs. Queue Engine State Synchronization:
BullMQ tracks waiting, active, stalled, and failed.
MongoDB tracks business statuses (CREATED, QUEUED, PROCESSING, RETRY_WAIT, COMPLETED, FAILED).
Handling crashes where a worker dies mid-job requires understanding BullMQ's stalled job detection without prematurely or permanently corrupting MongoDB state.
Cache Invalidation & Consistency:
Understanding Cache-Aside read flows vs write invalidations.
Handling race conditions where a write updates MongoDB, an invalidation fires, but a concurrent stale read repopulates Redis with outdated data.
Stateful Sessions vs Horizontally Scaled APIs:
Storing sessions in Redis allows multiple Express instances to authorize requests identically without sticky routing or JWT revocation complications.
Session fixation mitigation (regenerating session IDs upon privilege elevation/login).
Multi-device session revocation and session destruction upon password resets.

# 4. Roadmap Alignment: 13 Distinct Phases

We will tackle the implementation strictly phase-by-phase without jumping ahead or taking shortcuts:

Phase 0: Project Foundation, Docker Compose (Mongo + Redis), structured logging (pino), graceful shutdown, and centralized error handling.
Phase 1: User Authentication Foundation (register, password hash with argon2 or bcrypt, validation with zod).
Phase 2: Server-Side Sessions with Redis (session lifecycle, cookie flags, multi-device tracking, global logout).
Phase 3: Email Infrastructure (Nodemailer, SMTP configuration, HTML/text templates, transport resilience).
Phase 4: Email Verification (secure token hashing, expiration, single-use, resend throttling).
Phase 5: Password Reset (anti-enumeration responses, cryptographically secure single-use tokens, session invalidation on reset).
Phase 6: BullMQ & Background Processing (decoupled workers, job lifecycle, exponential backoff, retry routing).
Phase 7: Advanced Job Reliability (idempotency keys, deduplication, delayed/scheduled jobs, stalled-job simulation).
Phase 8: In-App & Multi-Channel Notifications (MongoDB notification model, read/unread states, email delivery logs).
Phase 9: Redis Caching API (Cache-aside pattern, fine-grained TTLs, explicit invalidation hooks).
Phase 10: Redis Rate Limiting (IP/User/Route-based policies, fixed vs sliding-window via Redis sorted sets).
Phase 11: Redis Pub/Sub (multi-instance event broadcasting, reconnection resilience).
Phase 12: Integration & Chaos Testing (simulating Redis down, SMTP down, worker crashes, concurrent duplicate requests).
Phase 13+: The Transactional Outbox Pattern (cross-system atomicity).


