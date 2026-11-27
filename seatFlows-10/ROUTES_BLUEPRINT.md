#  SeatFlow — Route-by-Route Making Blueprint

A complete, reusable engineering reference documenting **how every route in SeatFlow is built from request to database**. Use this guide as a blueprint whenever you build authentication, inventory, transactional locking, pagination, or payments in future projects.

---

##  Route Index

1. **System Health**
   * `GET /health`
2. **Authentication (`/api/v1/auth`)**
   * `POST /api/v1/auth/register`
   * `POST /api/v1/auth/login`
3. **Events & Venues (`/api/v1/events`)**
   * `GET /api/v1/events`
   * `GET /api/v1/events/:id`
   * `GET /api/v1/events/:id/seats`
   * `POST /api/v1/events/venues`
   * `POST /api/v1/events/venues/:venueId/seats`
   * `POST /api/v1/events`
   * `POST /api/v1/events/:id/ticket-types`
   * `POST /api/v1/events/:id/publish`
4. **Bookings (`/api/v1/bookings`)**
   * `POST /api/v1/bookings`
   * `GET /api/v1/bookings/my-bookings`
   * `GET /api/v1/bookings/:id`
5. **Payments (`/api/v1/payments`)**
   * `POST /api/v1/payments`

---

## 1. System Health

### `GET /health`
* **Access:** Public
* **Source:** [`src/app.js`](../src/app.js)

#### Making Flow
1. **Route Handler:** Executes a lightweight SQL probe `SELECT NOW() as current_time` via `pool.query(...)`.
2. **Success (`200 OK`):** Returns server status `'UP'`, ISO timestamp, `'Connected'`, and database time.
3. **Failure (`500 Internal Server Error`):** Catches connection error and returns `'DOWN'` with error message.

* **Topics Used:** Database Liveness Probe, Connection Pool Health Check.
* **Technology / Packages:** `express`, `pg` (`pool.query`).

---

## 2. Authentication (`/api/v1/auth`)

### `POST /api/v1/auth/register`
* **Access:** Public
* **Source:** [`auth.route.js`](../src/features/auth/auth.route.js) → [`auth.controller.js`](../src/features/auth/auth.controller.js) → [`auth.service.js`](../src/features/auth/auth.service.js) → [`auth.repository.js`](../src/features/auth/auth.repository.js)

#### Making Flow
1. **Controller (`register`):** Wrapped in `catchAsync`. Passes `req.body` to `authService.registerUser`.
2. **Service (`registerUser`):**
   * Validates `email`, `password`, and `fullName` (`400 Bad Request` via `AppError` if missing).
   * Calls `authRepo.findUserByEmail(email)` (`WHERE LOWER(email) = LOWER($1)`). Throws `409 Conflict` if email exists.
   * Hashes password using `bcrypt.hash(password, 12)`.
   * **Role Branching:**
     * If `role === 'ORGANIZER'`: Requires `organizationName`. Runs `withTransaction(async (client) => ...)` to atomically insert into `users` **and** `organizers` (1:1 profile).
     * Otherwise: Inserts into `users` with default role `'CUSTOMER'`.
   * Signs a JWT with `{ id, role }` using `env.jwt.secret` and `env.jwt.expiresIn`.
3. **Response (`201 Created`):** Returns `{ user, organizer, token }` (never returning `password_hash`).

* **Topics Used:** Salted Password Hashing, Case-Insensitive Email Uniqueness, Multi-Table Atomic Transactions (`withTransaction`), Stateless JWT Signing, Custom Operational Errors (`AppError`).
* **Technology / Packages:** `express`, `bcrypt`, `jsonwebtoken`, `pg`.

---

### `POST /api/v1/auth/login`
* **Access:** Public
* **Source:** [`auth.route.js`](../src/features/auth/auth.route.js) → [`auth.controller.js`](../src/features/auth/auth.controller.js) → [`auth.service.js`](../src/features/auth/auth.service.js) → [`auth.repository.js`](../src/features/auth/auth.repository.js)

#### Making Flow
1. **Controller (`login`):** Wrapped in `catchAsync`. Passes `req.body` to `authService.loginUser`.
2. **Service (`loginUser`):**
   * Validates `email` and `password` (`400` if missing).
   * Fetches user including `password_hash` via `authRepo.findUserByEmail(email)`.
   * Compares plaintext password against hash via `bcrypt.compare(password, user.password_hash)`. Throws `401 Unauthorized` on mismatch.
   * Generates JWT via `signToken(user.id, user.role)`.
   * Deletes `user.password_hash` from the response object before returning.
3. **Response (`200 OK`):** Returns `{ user, token }`.

* **Topics Used:** Constant-Time Hash Comparison, Credential Sanitization, Stateless Authentication.
* **Technology / Packages:** `express`, `bcrypt`, `jsonwebtoken`, `pg`.

---

## 3. Events & Venues (`/api/v1/events`)

### `GET /api/v1/events`
* **Access:** Public
* **Source:** [`event.route.js`](../src/features/events/event.route.js) → [`event.controller.js`](../src/features/events/event.controller.js) → [`event.service.js`](../src/features/events/event.service.js) → [`event.repository.js`](../src/features/events/event.repository.js)

#### Making Flow
1. **Controller (`getEvents`):** Passes `req.query` (`city`, `category`, `limit`, `cursor`) to `eventService.getEvents`.
2. **Service (`getEvents`):**
   * Clamps `limit` between `1` and `50` (default `10`).
   * Decodes Base64URL cursor via `decodeCursor(queryParams.cursor)` into `{ startTime, id }`.
   * Calls `eventRepo.getPublishedEventsPaginated({ city, category, limit, cursor })`.
   * Formats result with `formatPaginationResponse` using `(item) => ({ startTime: item.start_time, id: item.id })`.
3. **Repository (`getPublishedEventsPaginated`):**
   * Queries `events` joined with `venues` and `organizers` where `e.status = 'PUBLISHED'`.
   * Dynamically appends parameterized filters for `LOWER(v.city)` and `LOWER(e.category)`.
   * If cursor exists, applies ascending tuple comparison: `AND (e.start_time, e.id) > ($x, $y)`.
   * Orders by `e.start_time ASC, e.id ASC` and fetches `LIMIT limit + 1`.
4. **Response (`200 OK`):** Returns `{ items, pagination: { limit, hasNextPage, nextCursor } }`.

* **Topics Used:** Keyset (Cursor-Based) Pagination, Ascending Tuple Comparison, Partial Composite Indexing (`idx_events_published_cursor`), Dynamic Parameterized SQL Filters (SQL Injection Prevention), `limit + 1` Lookahead.
* **Technology / Packages:** `express`, `pg`, Node `Buffer` (`base64url`).

---

### `GET /api/v1/events/:id`
* **Access:** Public
* **Source:** [`event.route.js`](../src/features/events/event.route.js) → [`event.controller.js`](../src/features/events/event.controller.js) → [`event.service.js`](../src/features/events/event.service.js) → [`event.repository.js`](../src/features/events/event.repository.js)

#### Making Flow
1. **Controller (`getEvent`):** Passes `req.params.id` to `eventService.getEvent`.
2. **Service (`getEvent`):**
   * Builds cache key `event:${id}` and checks Redis via `getCache(cacheKey)`.
   * **Cache HIT:** Immediately returns cached JSON without hitting PostgreSQL.
   * **Cache MISS:** Fetches event details (`eventRepo.getEventById`) + ticket tiers (`eventRepo.getTicketTypesByEventId`). Throws `404` if not found.
   * Saves combined object in Redis via `setCache(cacheKey, result, 600)` (10-minute TTL).
3. **Response (`200 OK`):** Returns event metadata, venue info, organizer name, and `ticketTypes`.

* **Topics Used:** Cache-Aside Pattern, TTL Expiration, Graceful Cache Degradation (DB Fallback).
* **Technology / Packages:** `express`, `pg`, `redis` (Upstash TLS).

---

### `GET /api/v1/events/:id/seats`
* **Access:** Public
* **Source:** [`event.route.js`](../src/features/events/event.route.js) → [`event.controller.js`](../src/features/events/event.controller.js) → [`event.service.js`](../src/features/events/event.service.js) → [`event.repository.js`](../src/features/events/event.repository.js)

#### Making Flow
1. **Controller (`getEventSeats`):** Passes `req.params.id` to `eventService.getEventSeats`.
2. **Service (`getEventSeats`):** Verifies event exists (`404` if missing), then fetches live seat inventory directly from PostgreSQL (intentionally bypassed Redis so seat availability is always real-time).
3. **Repository (`getEventSeatsMap`):** Joins `event_seats` → `venue_seats` → `ticket_types`, ordered by `section, row_number, seat_number`.
4. **Response (`200 OK`):** Returns array of seats with `event_seat_id`, `status`, `section`, `row_number`, `seat_number`, `ticket_tier`, and `price`.

* **Topics Used:** Real-Time Inventory Read Consistency, Multi-Table `JOIN`s, Cache Bypass for High-Volatility Data.
* **Technology / Packages:** `express`, `pg`.

---

### `POST /api/v1/events/venues`
* **Access:** Protected (`authenticateUser` + `restrictTo('ORGANIZER', 'ADMIN')`)
* **Source:** [`event.route.js`](../src/features/events/event.route.js) → [`auth.middleware.js`](../src/features/auth/auth.middleware.js) → [`event.controller.js`](../src/features/events/event.controller.js) → [`event.service.js`](../src/features/events/event.service.js) → [`event.repository.js`](../src/features/events/event.repository.js)

#### Making Flow
1. **Middleware:** `authenticateUser` verifies Bearer JWT and attaches `req.user`; `restrictTo('ORGANIZER', 'ADMIN')` enforces RBAC (`403` for customers).
2. **Service (`createVenue`):** Validates required address fields and `capacity > 0`.
3. **Repository (`createVenue`):** Inserts into `venues` and returns the created row.
4. **Response (`201 Created`):** Returns the new venue object.

* **Topics Used:** JWT Verification Middleware, Role-Based Access Control (RBAC), Database `CHECK` Constraints.
* **Technology / Packages:** `express`, `jsonwebtoken`, `pg`.

---

### `POST /api/v1/events/venues/:venueId/seats`
* **Access:** Protected (`authenticateUser` + `restrictTo('ORGANIZER', 'ADMIN')`)
* **Source:** [`event.route.js`](../src/features/events/event.route.js) → [`event.controller.js`](../src/features/events/event.controller.js) → [`event.service.js`](../src/features/events/event.service.js) → [`event.repository.js`](../src/features/events/event.repository.js)

#### Making Flow
1. **Service (`generateVenueSeats`):** Validates `section`, `totalRows`, `seatsPerRow`, and verifies venue exists (`404` if not).
2. **Repository (`createVenueSeatGrid`):** Uses PostgreSQL set-returning function `generate_series(1, totalRows) CROSS JOIN generate_series(1, seatsPerRow)` to bulk-insert the entire physical seating grid in **1 single query**.
3. **Response (`201 Created`):** Returns `{ message: "Successfully generated X physical seats in Section Y" }`.

* **Topics Used:** Set-Based Bulk Insertion, PostgreSQL `generate_series` & `CROSS JOIN`, Composite Unique Constraint (`uq_venue_seat`).
* **Technology / Packages:** `express`, `pg`.

---

### `POST /api/v1/events`
* **Access:** Protected (`authenticateUser` + `restrictTo('ORGANIZER', 'ADMIN')`)
* **Source:** [`event.route.js`](../src/features/events/event.route.js) → [`event.controller.js`](../src/features/events/event.controller.js) → [`event.service.js`](../src/features/events/event.service.js) → [`event.repository.js`](../src/features/events/event.repository.js)

#### Making Flow
1. **Service (`createEvent`):**
   * Looks up organizer profile via `findOrganizerByUserId(req.user.id)` (`403` if missing).
   * Validates `startTime > now` and `endTime > startTime`.
   * Verifies `venueId` exists (`404` if missing).
2. **Repository (`createEvent`):** Inserts into `events` with initial lifecycle state `'DRAFT'`.
3. **Response (`201 Created`):** Returns the draft event record.

* **Topics Used:** Temporal Date Validation, Foreign Key Ownership Lookup, State Machine Initialization (`DRAFT`).
* **Technology / Packages:** `express`, `pg`.

---

### `POST /api/v1/events/:id/ticket-types`
* **Access:** Protected (`authenticateUser` + `restrictTo('ORGANIZER', 'ADMIN')`)
* **Source:** [`event.route.js`](../src/features/events/event.route.js) → [`event.controller.js`](../src/features/events/event.controller.js) → [`event.service.js`](../src/features/events/event.service.js) → [`event.repository.js`](../src/features/events/event.repository.js)

#### Making Flow
1. **Service (`createTicketType`):**
   * Verifies event exists (`404`), belongs to the logged-in organizer (`403`), and is still in `'DRAFT'` status (`400` if already published/cancelled).
   * Inserts tier via `eventRepo.createTicketType`.
   * Invalidates Redis cache `await deleteCache('event:' + eventId)` **after** the DB insert succeeds.
2. **Response (`201 Created`):** Returns the created ticket type.

* **Topics Used:** Resource Ownership Authorization, Lifecycle Guard, Post-Mutation Cache Invalidation.
* **Technology / Packages:** `express`, `pg`, `redis`.

---

### `POST /api/v1/events/:id/publish`
* **Access:** Protected (`authenticateUser` + `restrictTo('ORGANIZER', 'ADMIN')`)
* **Source:** [`event.route.js`](../src/features/events/event.route.js) → [`event.controller.js`](../src/features/events/event.controller.js) → [`event.service.js`](../src/features/events/event.service.js) → [`event.repository.js`](../src/features/events/event.repository.js)

#### Making Flow
1. **Service (`publishEvent`):**
   * Verifies event exists, belongs to organizer, is not already `'PUBLISHED'`, and has at least 1 ticket tier.
   * Executes `withTransaction(async (client) => ...)`:
     * Calls `instantiateEventSeats`: runs `INSERT INTO event_seats ... SELECT ... FROM venue_seats WHERE venue_id = $3 ON CONFLICT DO NOTHING` to copy physical seats into bookable inventory.
     * Throws `400` if `seatsCreated === 0` (no physical seats generated for venue).
     * Calls `updateEventStatus(eventId, 'PUBLISHED', client)`.
     * Invalidates Redis cache `deleteCache('event:' + eventId)`.
2. **Response (`200 OK`):** Returns `{ event, seatsInstantiated }`.

* **Topics Used:** Atomic Publishing Transaction, `INSERT ... SELECT` Set-Based Inventory Instantiation, Idempotent `ON CONFLICT DO NOTHING`, Cache Invalidation.
* **Technology / Packages:** `express`, `pg`, `redis`.

---

## 4. Bookings (`/api/v1/bookings`)

### `POST /api/v1/bookings`
* **Access:** Protected (`authenticateUser`)
* **Source:** [`bookings.route.js`](../src/features/bookings/bookings.route.js) → [`bookings.controller.js`](../src/features/bookings/bookings.controller.js) → [`bookings.service.js`](../src/features/bookings/bookings.service.js) → [`bookings.repository.js`](../src/features/bookings/bookings.repository.js)

#### Making Flow
1. **Service (`createBookingReservation`):**
   * Validates `eventSeatIds` is a non-empty array with max 6 seats (anti-hoarding rule).
   * **Deadlock Prevention:** Deduplicates and sorts seat IDs numerically (`[...new Set(eventSeatIds.map(Number))].sort((a, b) => a - b)`).
   * Starts `withTransaction`:
     1. **Lock Seats:** Calls `bookingRepo.lockAndGetSeats(sortedSeatIds, client)` using `ORDER BY es.id ASC FOR UPDATE`.
     2. **Existence & Single-Event Check:** Ensures all requested seat IDs exist (`404`) and belong to the same `event_id` (`400`).
     3. **Availability Check:** Verifies every locked seat has `status === 'AVAILABLE'`. If any seat is `RESERVED` or `BOOKED`, aborts transaction and throws `409 Conflict`.
     4. **Total Calculation:** Sums `seat.price` from `ticket_types`.
     5. **Create Booking Header:** Inserts into `bookings` with `status = 'PENDING'` and `expires_at = CURRENT_TIMESTAMP + INTERVAL '10 minutes'`.
     6. **Create Line Items:** Bulk-inserts `booking_items` snapshotting `price_at_booking`.
     7. **Reserve Inventory:** Updates `event_seats` to `status = 'RESERVED'`.
2. **Response (`201 Created`):** Returns `{ bookingId, eventId, totalAmount, status, expiresAt, seats }`.

* **Topics Used:** ACID Transactions, Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`), Deadlock Prevention (Deterministic Lock Ordering), Anti-Hoarding Limits, Price Snapshotting (Immutability), Temporary 10-Minute Holds.
* **Technology / Packages:** `express`, `pg` (`withTransaction`).

---

### `GET /api/v1/bookings/my-bookings`
* **Access:** Protected (`authenticateUser`)
* **Source:** [`bookings.route.js`](../src/features/bookings/bookings.route.js) → [`bookings.controller.js`](../src/features/bookings/bookings.controller.js) → [`bookings.service.js`](../src/features/bookings/bookings.service.js) → [`bookings.repository.js`](../src/features/bookings/bookings.repository.js)

#### Making Flow
1. **Controller (`getMyBookings`):** Passes `req.user.id` and `req.query` (`limit`, `cursor`) to service.
2. **Service (`getMyBookings`):** Clamps `limit` (1–50), decodes `cursor` into `{ createdAt, id }`, fetches `limit + 1` rows, and formats response via `formatPaginationResponse`.
3. **Repository (`getUserBookingsPaginated`):** Filters `WHERE b.user_id = $1`, applies descending tuple comparison `AND (b.created_at, b.id) < ($2, $3)`, and orders by `b.created_at DESC, b.id DESC`.
4. **Response (`200 OK`):** Returns `{ items, pagination: { limit, hasNextPage, nextCursor } }`.

* **Topics Used:** Cursor-Based Pagination, Descending Tuple Comparison, Equality-First Composite Index (`idx_bookings_user_cursor`), Base64URL Opaque Cursors.
* **Technology / Packages:** `express`, `pg`, Node `Buffer`.

---

### `GET /api/v1/bookings/:id`
* **Access:** Protected (`authenticateUser`)
* **Source:** [`bookings.route.js`](../src/features/bookings/bookings.route.js) → [`bookings.controller.js`](../src/features/bookings/bookings.controller.js) → [`bookings.service.js`](../src/features/bookings/bookings.service.js) → [`bookings.repository.js`](../src/features/bookings/bookings.repository.js)

#### Making Flow
1. **Service (`getBooking`):** Calls `bookingRepo.getBookingWithItems(bookingId)`. Throws `404` if not found.
2. **Authorization:** Verifies `booking.user_id === req.user.id` (`403 Forbidden` if another user attempts access).
3. **Repository (`getBookingWithItems`):** Joins `bookings` → `events` → `venues` → `booking_items` → `event_seats` → `venue_seats`, aggregating line items in SQL using `json_agg(json_build_object(...))`.
4. **Response (`200 OK`):** Returns booking header + nested `items` array.

* **Topics Used:** Horizontal Authorization (IDOR Prevention), SQL JSON Aggregation (`json_agg` / `json_build_object`), Eliminating N+1 Queries.
* **Technology / Packages:** `express`, `pg`.

---

## 5. Payments (`/api/v1/payments`)

### `POST /api/v1/payments`
* **Access:** Protected (`authenticateUser`)
* **Source:** [`payments.route.js`](../src/features/payments/payments.route.js) → [`payments.controller.js`](../src/features/payments/payments.controller.js) → [`payments.service.js`](../src/features/payments/payments.service.js) → [`payments.repository.js`](../src/features/payments/payments.repository.js)

#### Making Flow
1. **Service (`processPayment`):**
   * Validates `bookingId` and `idempotencyKey` (`400` if missing).
   * **Idempotency Check:** Calls `paymentRepo.findPaymentByIdempotencyKey(idempotencyKey)`. If found, immediately returns the existing payment outcome without double-charging.
   * Starts `withTransaction`:
     1. **Lock Booking:** Calls `paymentRepo.lockBookingForPayment(bookingId, client)` (`SELECT ... FOR UPDATE`) to serialize concurrent payment attempts on the same booking.
     2. **Ownership & State Guards:** Ensures booking exists (`404`), belongs to `userId` (`403`), is not already `CONFIRMED` (`400`), is `PENDING` (`400`), and `expires_at > now` (`410 Gone` if expired).
     3. **Mock Failure Path (`simulateFailure = true`):** Inserts payment record with `status = 'FAILED'`. Leaves booking `PENDING` and seats `RESERVED` so the user can retry within their remaining hold window.
     4. **Success Path:** Generates `txn_mock_<hex>` via `crypto.randomBytes(8)`, inserts payment with `status = 'SUCCESS'`, and calls `confirmBookingAndSeats(booking.id, client)` to flip `bookings.status = 'CONFIRMED'` and `event_seats.status = 'BOOKED'`.
2. **Response (`200 OK`):** Returns payment receipt and `confirmedSeatsCount`.

* **Topics Used:** Payment Idempotency (`UNIQUE idempotency_key`), Booking Row Locking (`FOR UPDATE`), Expiration Enforcement (`410 Gone`), Decoupled Finite State Machines, Atomic 3-Table Settlement (`payments` + `bookings` + `event_seats`).
* **Technology / Packages:** `express`, `pg` (`withTransaction`), Node `crypto`.

---

## 6. Background Worker (No HTTP Route)

### `releaseExpiredBookings` & `startExpirationWorker`
* **Source:** [`src/jobs/cleanupExpiredBookings.js`](../src/jobs/cleanupExpiredBookings.js) (initialized in [`src/server.js`](../src/server.js))

#### Making Flow
1. Runs immediately on server boot and every 30 seconds via `setInterval` (`.unref()` so it never blocks process exit).
2. Executes a single atomic **Common Table Expression (CTE)**:
   * `expired_bookings`: Updates `bookings` where `status = 'PENDING' AND expires_at < CURRENT_TIMESTAMP` to `'EXPIRED'`, returning `id`.
   * `released_seats`: Updates `event_seats` back to `'AVAILABLE'` for all seats linked to `expired_bookings` via `booking_items`.

* **Topics Used:** Atomic SQL CTE (`WITH ...`), Partial Index (`idx_bookings_expires_at`), Non-Blocking Interval Timer (`timer.unref()`), Zombie Lock Prevention.
* **Technology / Packages:** Node.js timers, `pg`.
