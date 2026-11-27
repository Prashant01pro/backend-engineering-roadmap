#  SeatFlow — Real-Time Event Booking & Ticketing Backend

**SeatFlow** is a high-concurrency, transactional event booking and ticketing backend built with **Node.js**, **Express**, **PostgreSQL (raw SQL)**, and **Upstash Redis**.

Unlike standard CRUD applications, **SeatFlow is engineered to solve real-world distributed systems challenges: preventing double bookings under simultaneous load, automatically releasing abandoned seat holds, ensuring idempotent payments, and maintaining sub-millisecond query performance at scale**.

---

##  Tech Stack & Packages

| Layer | Technology / Package | Purpose |
|---|---|---|
| **Runtime** | Node.js (ES Modules) | Application runtime |
| **Framework** | `express` (`^5.3.0`) | HTTP routing & middleware pipeline |
| **Database** | PostgreSQL + `pg` (`^8.23.1`) | Raw SQL, connection pooling, ACID transactions, row locks |
| **Caching** | Upstash Redis + `redis` (`^6.4.0`) | TLS Cache-Aside read optimization with graceful DB fallback |
| **Authentication** | `jsonwebtoken` (`^9.0.3`), `bcrypt` (`^6.0.0`) | Stateless JWT auth, salted password hashing, RBAC |
| **Configuration** | `dotenv` (`^18.0.10`) | Centralized fail-fast environment config (`src/config/env.js`) |
| **Middleware** | `cors` (`^2.8.6`) | Cross-Origin Resource Sharing |

---

##  Engineering Problems & How SeatFlow Tackles Them

### 1. Double Booking & Race Conditions
* **The Problem:** Two users click "Book" on Seat #5 at the exact same millisecond. Both read `status = 'AVAILABLE'` and both attempt to reserve it (classic *Lost Update*).
* **How We Tackled It:**
  * Wrapped booking creation inside an atomic database transaction via [`withTransaction`](src/config/db.js).
  * Used **Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`)** in [`bookings.repository.js`](src/features/bookings/bookings.repository.js) so PostgreSQL queues competing transactions on the exact same seat rows.
  * Added a hard database constraint `UNIQUE (event_id, venue_seat_id)` on `event_seats` as a final safety net.
  * **Verified Result:** Tested via [`test_concurrency.js`](test_concurrency.js) firing 20 simultaneous requests for Seat #5 → **1 Winner (`201 Created`), 19 Blocked (`409 Conflict`), 0 Errors**.

### 2. Deadlocks During Multi-Seat Selection
* **The Problem:** User A locks Seat `10` then requests Seat `20`, while User B locks Seat `20` then requests Seat `10`. Both hang forever (`40P01: deadlock detected`).
* **How We Tackled It:**
  * Deterministic lock ordering in [`bookings.service.js`](src/features/bookings/bookings.service.js): requested `eventSeatIds` are deduplicated and numerically sorted (`ORDER BY es.id ASC`) before acquiring `FOR UPDATE` locks.

### 3. Abandoned Checkouts (Zombie Holds)
* **The Problem:** A user reserves seats (`status = 'RESERVED'`) and closes their browser without paying, locking inventory indefinitely.
* **How We Tackled It:** *(See [`docs/problemSoln.md`](docs/problemSoln.md))*
  * **10-Minute Hold Window:** Bookings are created as `PENDING` with `expires_at = CURRENT_TIMESTAMP + INTERVAL '10 minutes'`.
  * **Atomic CTE Background Worker:** [`cleanupExpiredBookings.js`](src/jobs/cleanupExpiredBookings.js) runs every 30 seconds using a single atomic PostgreSQL **Common Table Expression (`WITH expired_bookings AS ...`)** to flip expired bookings to `EXPIRED` and release seats back to `AVAILABLE`.
  * **Partial Index Optimization:** `idx_bookings_expires_at` indexes *only* `WHERE status = 'PENDING'`, keeping cleanup scans under 2ms even with millions of historical rows.

### 4. Payment Retries, Double-Clicks & State Desync
* **The Problem:** Network retries or impatient users double-clicking "Pay" can trigger duplicate charges. A declined card shouldn't destroy the user's active seat hold.
* **How We Tackled It:**
  * **Decoupled Finite State Machines:** Seat state (`AVAILABLE` → `RESERVED` → `BOOKED`), Booking state (`PENDING` → `CONFIRMED` / `EXPIRED` / `CANCELLED`), and Payment state (`PENDING` → `SUCCESS` / `FAILED` / `REFUNDED`) are strictly isolated.
  * **Idempotency Keys:** `payments.idempotency_key` carries a `UNIQUE` constraint. Repeated requests with the same key return the previous transaction outcome without re-charging.
  * **Row Lock & Expiry Guard:** [`payments.service.js`](src/features/payments/payments.service.js) locks the booking row (`FOR UPDATE`), verifies `expires_at > NOW()`, and atomically settles payment, booking, and seats together.

### 5. Slow `OFFSET` Queries & Duplicate Timestamp Pagination Bugs
* **The Problem:** `OFFSET 50000` forces PostgreSQL to read and discard 50,000 rows on every deep page request. Meanwhile, naive `WHERE created_at < $1` cursor queries skip rows created at the exact same microsecond.
* **How We Tackled It:** *(See [`docs/performance.md`](docs/performance.md))*
  * **Keyset (Cursor-Based) Pagination:** Built a reusable helper in [`pagination.js`](src/utils/pagination.js) using Base64URL opaque cursors and the **`limit + 1` lookahead trick** (eliminating expensive `SELECT COUNT(*)` queries).
  * **Unique Tie-Breaker & Tuple Comparison:** Queries use `(created_at, id) < ($2, $3)` for descending bookings and `(start_time, id) > ($2, $3)` for ascending upcoming events.
  * **Composite & Partial B-Tree Indexes:** Added `idx_bookings_user_cursor` (`user_id, created_at DESC, id DESC`) and partial index `idx_events_published_cursor` (`start_time ASC, id ASC WHERE status = 'PUBLISHED'`) in [`002_add_cursor_indexes.sql`](src/db/migrations/002_add_cursor_indexes.sql).

### 6. High Read Traffic & Connection Pool Starvation
* **The Problem:** Thousands of users refreshing event details exhaust the PostgreSQL connection pool (`max: 20`), starving critical booking write transactions.
* **How We Tackled It:**
  * **Cache-Aside Pattern with Upstash Redis:** [`redis.js`](src/config/redis.js) caches `GET /api/v1/events/:id` for 10 minutes (`EX: 600`) and invalidates the cache *after* database mutations (`createTicketType`, `publishEvent`) to prevent stale re-caching.
  * **Graceful Degradation:** If Redis is unreachable, `getCache` / `setCache` fail silently and fall back to PostgreSQL without crashing the API.

### 7. Bulk Seat Generation Bottlenecks
* **The Problem:** Looping 10,000 `INSERT` queries in Node.js for a stadium layout takes tens of seconds.
* **How We Tackled It:**
  * Used PostgreSQL's `generate_series` with `CROSS JOIN` in [`event.repository.js`](src/features/events/event.repository.js) to generate thousands of `venue_seats` in a single roundtrip, and `INSERT INTO event_seats ... SELECT FROM venue_seats` when publishing events.

### 8. Connection Leaks & Unclean Restarts
* **The Problem:** Unhandled errors during manual `pool.connect()` transactions leak connections until the pool freezes; `Ctrl+C` or deployment restarts cut off in-flight transactions.
* **How We Tackled It:**
  * `withTransaction` in [`db.js`](src/config/db.js) guarantees `ROLLBACK` on error and `client.release()` inside a `finally` block.
  * **Centralized Config:** [`env.js`](src/config/env.js) loads `dotenv` once, validates critical secrets (`JWT_SECRET`), and exports a frozen config object.
  * **Graceful Shutdown:** [`server.js`](src/server.js) intercepts `SIGINT` and `SIGTERM` to close HTTP requests, drain `pool.end()`, and call `disconnectRedis()`.

---

##  Feature-Based (Vertical Slice) Architecture

```text
seatFlows-10/
├── docs/                              # Architecture specs, performance notes & route blueprints
├── src/
│   ├── config/
│   │   ├── env.js                     # Centralized, fail-fast frozen environment config
│   │   ├── db.js                      # PostgreSQL pool (max 20) & withTransaction helper
│   │   └── redis.js                   # Upstash Redis client with graceful fallback & quit
│   ├── db/
│   │   ├── migrate.js                 # Raw SQL migration runner
│   │   └── migrations/
│   │       ├── 001_create_initial_schema.sql  # 10 normalized tables + constraints
│   │       └── 002_add_cursor_indexes.sql     # Composite & partial cursor indexes
│   ├── features/
│   │   ├── auth/                      # Register, Login, JWT & RBAC middleware
│   │   ├── events/                    # Venues, Seat Grid, Events, Ticket Tiers, Publishing
│   │   ├── bookings/                  # Transactional seat locking & cursor history
│   │   └── payments/                  # Idempotent mock payment gateway & confirmation
│   ├── jobs/
│   │   └── cleanupExpiredBookings.js  # Atomic CTE background worker (30s interval)
│   ├── middleware/
│   │   └── error.middleware.js        # Global Express error boundary
│   ├── utils/
│   │   ├── appError.js                # Operational error class with HTTP status codes
│   │   ├── catchAsync.js              # Async controller wrapper
│   │   └── pagination.js              # Base64URL cursor encoding & limit+1 formatter
│   ├── app.js                         # Express app, /health, feature route mounting
│   └── server.js                      # Boot checks, worker startup & graceful shutdown
├── test_concurrency.js                # 20-user simultaneous booking race-condition test
├── .env.example                       # Environment variable template
└── package.json
```

---

##  Database Schema (10 Core Tables)

Tables are created in strict topological dependency order in [`001_create_initial_schema.sql`](src/db/migrations/001_create_initial_schema.sql):

1. `users` — Customers, organizers, and admins (`UUID` PK, case-insensitive unique email)
2. `venues` — Physical event locations (`BIGINT` PK, `capacity > 0`)
3. `organizers` — 1:1 business profiles linked to `users`
4. `venue_seats` — Reusable physical layout (`UNIQUE (venue_id, section, row_number, seat_number)`)
5. `events` — Scheduled events (`DRAFT`, `PUBLISHED`, `COMPLETED`, `CANCELLED`)
6. `ticket_types` — Event pricing tiers (`NUMERIC(10,2)`, `price >= 0`)
7. `bookings` — Customer order headers (`PENDING`, `CONFIRMED`, `CANCELLED`, `EXPIRED`, `expires_at`)
8. `event_seats` — Bookable event inventory (`AVAILABLE`, `RESERVED`, `BOOKED`, `UNIQUE (event_id, venue_seat_id)`)
9. `booking_items` — Line items with immutable `price_at_booking` snapshots
10. `payments` — Financial attempts (`UNIQUE idempotency_key`, `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`)

---

##  Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in your PostgreSQL credentials, `JWT_SECRET`, and optional Upstash `REDIS_URI`:
```bash
cp .env.example .env
```

### 3. Run Database Migrations
```bash
npm run db:migrate
```
*(Also execute `src/db/migrations/002_add_cursor_indexes.sql` against PostgreSQL for cursor pagination indexes.)*

### 4. Start the Server
```bash
npm run dev    # Development (nodemon)
npm start      # Production
```

### 5. Verify Concurrency Protection
Update `TOKEN` and `SEAT_ID` in `test_concurrency.js`, then run:
```bash
node test_concurrency.js
```

---

##  Additional Documentation
* **[Route-by-Route Making Blueprint](docs/ROUTES_BLUEPRINT.md)** — Complete implementation flow, concepts, and packages for every route in SeatFlow.
* **[Database Architecture](docs/databaseArchitecture.md)** — Column-level justifications & ERD.
* **[Zombie Hold Solution](docs/problemSoln.md)** — Expiration worker & CTE design.
* **[Performance Engineering](docs/performance.md)** — Execution plans, cursor pagination, and caching notes.
