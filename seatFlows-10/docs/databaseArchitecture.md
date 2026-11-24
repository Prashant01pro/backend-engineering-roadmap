# 🎟️ Ticket Booking Platform – Database Architecture

## Detailed Architectural Specification

This document explains the database architecture for a ticket booking platform built using **PostgreSQL**.

Before writing DDL (`CREATE TABLE`) statements, an experienced database architect documents the reasoning behind every column, data type, nullability rule, default value, and constraint.

The database design contains **10 core tables** that manage users, organizers, venues, events, seats, bookings, and payments.

---

# 📚 Database Tables Overview

| No. | Table Name | Purpose |
|---|---|---|
| 1 | `users` | Stores customers, organizers, and administrators |
| 2 | `organizers` | Stores organizer business profiles |
| 3 | `venues` | Stores physical event locations |
| 4 | `venue_seats` | Stores permanent venue seating layouts |
| 5 | `events` | Stores scheduled events |
| 6 | `ticket_types` | Stores event ticket categories and pricing |
| 7 | `event_seats` | Tracks bookable seats for individual events |
| 8 | `bookings` | Stores customer booking orders |
| 9 | `booking_items` | Stores individual seats associated with bookings |
| 10 | `payments` | Tracks payment attempts and transactions |

---

# 1. Users

### Domain Purpose

Central identity registry for customers, organizers, and platform administrators.

### Table Structure

| Column | Data Type | Nullable | Default | Key / Constraint | Engineering Justification |
|---|---|---|---|---|---|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK | Prevents predictable ID enumeration on public endpoints |
| email | VARCHAR(255) | NOT NULL | None | UNIQUE | Natural identifier used for authentication and notifications |
| password_hash | VARCHAR(255) | NOT NULL | None | — | Stores bcrypt or Argon2 password hashes, never plain text |
| full_name | VARCHAR(100) | NOT NULL | None | — | Legal or display name of the ticket purchaser |
| phone_number | VARCHAR(20) | NULL | NULL | — | Optional phone number for SMS/WhatsApp ticket delivery |
| role | VARCHAR(20) | NOT NULL | `'CUSTOMER'` | CHECK | RBAC foundation |
| created_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | — | Account registration timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | — | Tracks the last profile update |

### Role Constraint

```sql
CHECK (role IN ('CUSTOMER', 'ORGANIZER', 'ADMIN'))
```

### Important Considerations

- Passwords must never be stored in plain text.
- Use bcrypt or Argon2 for password hashing.
- Email lookup should be case-insensitive.
- UUIDs make public identifiers less predictable.

---

# 2. Organizers

### Domain Purpose

Business profile representing an entity that creates and hosts events.

### Architectural Question

**Why separate organizers from users instead of adding organizer columns directly to the users table?**

### Answer: Single Responsibility and Data Sparsity

Most users are ticket buyers.

If we store `organization_name`, `tax_id`, `bank_details`, `bio`, and `is_verified` directly inside the users table, most customer records would contain unnecessary NULL values.

Separating organizers keeps the users table clean and focused.

### Table Structure

| Column | Data Type | Nullable | Default | Key / Constraint | Engineering Justification |
|---|---|---|---|---|---|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK | Unique organizer profile ID |
| user_id | UUID | NOT NULL | None | FK → users(id), UNIQUE | Enforces one organizer profile per user |
| organization_name | VARCHAR(150) | NOT NULL | None | — | Public organization or company name |
| bio | TEXT | NULL | NULL | — | Organizer description |
| contact_email | VARCHAR(255) | NOT NULL | None | — | Official support email |
| is_verified | BOOLEAN | NOT NULL | FALSE | — | Verification flag for fraud prevention |
| created_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | — | Organizer registration timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | — | Last business profile update |

### Relationship

```text
users (1) ───────── (1) organizers
```

A user can manage at most one organizer profile in this design.

---

# 3. Venues

### Domain Purpose

Stores physical locations such as stadiums, auditoriums, clubs, and theaters where events take place.

### Table Structure

| Column | Data Type | Nullable | Default | Key / Constraint | Engineering Justification |
|---|---|---|---|---|---|
| id | BIGINT | NOT NULL | GENERATED ALWAYS AS IDENTITY | PK | Internal reference ID |
| name | VARCHAR(150) | NOT NULL | None | — | Venue name |
| address | TEXT | NOT NULL | None | — | Complete street address |
| city | VARCHAR(100) | NOT NULL | None | — | Event discovery and filtering |
| state | VARCHAR(100) | NULL | NULL | — | State or province |
| postal_code | VARCHAR(20) | NOT NULL | None | — | Postal or ZIP code |
| capacity | INTEGER | NOT NULL | None | CHECK | Total physical venue capacity |
| created_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | — | Audit timestamp |

### Constraint

```sql
CHECK (capacity > 0)
```

Prevents negative or zero venue capacity.

---

# 4. Venue Seats

### Domain Purpose

Stores the permanent physical seating layout of a venue.

A venue has a fixed seating arrangement that can be reused across multiple events.

### Table Structure

| Column | Data Type | Nullable | Default | Key / Constraint | Engineering Justification |
|---|---|---|---|---|---|
| id | BIGINT | NOT NULL | GENERATED ALWAYS AS IDENTITY | PK | Seat reference ID |
| venue_id | BIGINT | NOT NULL | None | FK → venues(id) | Links seat to its venue |
| section | VARCHAR(50) | NOT NULL | None | Composite UNIQUE | Physical area, e.g. Balcony or Floor |
| row_number | VARCHAR(10) | NOT NULL | None | Composite UNIQUE | Seat row identifier |
| seat_number | VARCHAR(10) | NOT NULL | None | Composite UNIQUE | Individual seat number |
| is_accessible | BOOLEAN | NOT NULL | FALSE | — | Wheelchair accessibility indicator |

### Critical Constraint

```sql
UNIQUE (venue_id, section, row_number, seat_number)
```

Prevents duplicate physical seat definitions inside the same venue.

### Example Seating Layout

```text
Venue: Stadium A

Section A
    Row 1 → A1, A2, A3, A4
    Row 2 → B1, B2, B3, B4

Section B
    Row 1 → A1, A2, A3, A4
    Row 2 → B1, B2, B3, B4
```

---

# 5. Events

### Domain Purpose

Represents a specific scheduled event hosted by an organizer at a venue.

### Table Structure

| Column | Data Type | Nullable | Default | Key / Constraint | Engineering Justification |
|---|---|---|---|---|---|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK | Public event identifier |
| organizer_id | UUID | NOT NULL | None | FK → organizers(id) | Event organizer |
| venue_id | BIGINT | NOT NULL | None | FK → venues(id) | Event location |
| title | VARCHAR(200) | NOT NULL | None | — | Event name |
| description | TEXT | NULL | NULL | — | Agenda, artist information, and rules |
| category | VARCHAR(50) | NOT NULL | None | — | Event category |
| start_time | TIMESTAMPTZ | NOT NULL | None | — | Event starting date and time |
| end_time | TIMESTAMPTZ | NOT NULL | None | CHECK | Event ending date and time |
| status | VARCHAR(20) | NOT NULL | `'DRAFT'` | CHECK | Event lifecycle state |
| created_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | — | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | — | Last update timestamp |

### Important Constraints

```sql
CHECK (end_time > start_time)
```

An event cannot end before it begins.

```sql
CHECK (
    status IN (
        'DRAFT',
        'PUBLISHED',
        'COMPLETED',
        'CANCELLED'
    )
)
```

### Event Lifecycle

```text
       DRAFT
         |
         v
     PUBLISHED
         |
         v
     COMPLETED

     PUBLISHED
         |
         v
     CANCELLED
```

### Foreign Key Behavior

- `organizer_id` → `organizers(id)` with `ON DELETE RESTRICT`.
- `venue_id` → `venues(id)` with `ON DELETE RESTRICT`.

This prevents deleting an organizer or venue while referenced by events.

---

# 6. Ticket Types

### Domain Purpose

Defines ticket pricing tiers and categories for an event.

Examples:

- VIP
- Gold
- Silver
- General Admission

### Table Structure

| Column | Data Type | Nullable | Default | Key / Constraint | Engineering Justification |
|---|---|---|---|---|---|
| id | BIGINT | NOT NULL | GENERATED ALWAYS AS IDENTITY | PK | Internal lookup ID |
| event_id | UUID | NOT NULL | None | FK → events(id) | Associated event |
| name | VARCHAR(50) | NOT NULL | None | Composite UNIQUE | Ticket category name |
| price | NUMERIC(10,2) | NOT NULL | None | CHECK | Accurate monetary value |
| description | TEXT | NULL | NULL | — | Ticket benefits and inclusions |

### Critical Constraints

```sql
UNIQUE (event_id, name)
```

Prevents duplicate ticket categories for the same event.

```sql
CHECK (price >= 0)
```

Prevents negative ticket prices.

### Example

| Ticket Type | Price |
|---|---:|
| VIP | ₹5,000 |
| Gold | ₹3,000 |
| Silver | ₹2,000 |
| General | ₹1,000 |

---

# 7. Event Seats

### Domain Purpose

Represents the bookable seat instance for a particular event.

This is one of the most important tables because it handles seat availability and concurrency control.

### Why Do We Need This Table?

`venue_seats` stores the permanent physical seating layout.

`event_seats` stores the availability of those seats for a particular event.

The same physical seat can be reused for different events, but it must not be allocated twice for the same event.

### Table Structure

| Column | Data Type | Nullable | Default | Key / Constraint | Engineering Justification |
|---|---|---|---|---|---|
| id | BIGINT | NOT NULL | GENERATED ALWAYS AS IDENTITY | PK | High-throughput lookup ID |
| event_id | UUID | NOT NULL | None | FK → events(id) | Associated event |
| venue_seat_id | BIGINT | NOT NULL | None | FK → venue_seats(id) | Physical seat reference |
| ticket_type_id | BIGINT | NOT NULL | None | FK → ticket_types(id) | Associated pricing tier |
| status | VARCHAR(20) | NOT NULL | `'AVAILABLE'` | CHECK | Real-time seat inventory state |
| version | INTEGER | NOT NULL | 1 | — | Optimistic concurrency control |

### Critical Constraint

```sql
UNIQUE (event_id, venue_seat_id)
```

A physical seat can only be allocated once per event.

### Seat Status

```text
AVAILABLE
    |
    v
 RESERVED
    |
    v
  BOOKED
```

### Seat Status Values

| Status | Meaning |
|---|---|
| AVAILABLE | Seat is available for booking |
| RESERVED | Seat is temporarily held |
| BOOKED | Seat has been successfully booked |

### Optimistic Concurrency Control

The `version` column can be incremented whenever the seat state changes.

This helps detect simultaneous updates and prevent conflicting modifications.

---

# 8. Bookings

### Domain Purpose

Represents an order created by a user containing one or more reserved or purchased seats.

### Table Structure

| Column | Data Type | Nullable | Default | Key / Constraint | Engineering Justification |
|---|---|---|---|---|---|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK | Public booking reference |
| user_id | UUID | NOT NULL | None | FK → users(id) | Customer who owns the booking |
| event_id | UUID | NOT NULL | None | FK → events(id) | Event being booked |
| total_amount | NUMERIC(10,2) | NOT NULL | None | CHECK | Total booking amount |
| status | VARCHAR(20) | NOT NULL | `'PENDING'` | CHECK | Booking lifecycle |
| expires_at | TIMESTAMPTZ | NULL | NULL | — | Temporary booking hold deadline |
| created_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | — | Booking creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | — | Last booking update |

### Constraints

```sql
CHECK (total_amount >= 0)
```

```sql
CHECK (
    status IN (
        'PENDING',
        'CONFIRMED',
        'CANCELLED',
        'EXPIRED'
    )
)
```

### Booking Lifecycle

```text
           PENDING
          /   |   \
         /    |    \
        v     v     v
 CONFIRMED CANCELLED EXPIRED
```

### Temporary Booking Hold

The `expires_at` column stores the deadline for a pending booking.

For example:

```text
User selects seats
       |
       v
Booking created
       |
       v
Status = PENDING
       |
       v
10-minute hold
       |
       v
Payment completed?
       |
   +---+---+
   |       |
  YES      NO
   |       |
   v       v
CONFIRMED EXPIRED
```

A background worker can identify expired bookings and release their seats.

---

# 9. Booking Items

### Domain Purpose

Stores the individual line items associated with a booking.

Each row links a booking to a selected event seat.

### Table Structure

| Column | Data Type | Nullable | Default | Key / Constraint | Engineering Justification |
|---|---|---|---|---|---|
| id | BIGINT | NOT NULL | GENERATED ALWAYS AS IDENTITY | PK | Line item ID |
| booking_id | UUID | NOT NULL | None | FK → bookings(id) | Parent booking |
| event_seat_id | BIGINT | NOT NULL | None | FK → event_seats(id) | Selected event seat |
| price_at_booking | NUMERIC(10,2) | NOT NULL | None | CHECK | Historical price snapshot |
| created_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | — | Audit timestamp |

### Important Constraint

```sql
CHECK (price_at_booking >= 0)
```

### Why Store `price_at_booking`?

Suppose a customer purchases a ticket for ₹2,000.

Later, the organizer increases the ticket price to ₹2,500.

The existing booking must still show the original price of ₹2,000.

Therefore, `price_at_booking` preserves the historical purchase price.

---

# 10. Payments

### Domain Purpose

Records financial transactions and payment attempts associated with bookings.

### Table Structure

| Column | Data Type | Nullable | Default | Key / Constraint | Engineering Justification |
|---|---|---|---|---|---|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK | Unique payment reference |
| booking_id | UUID | NOT NULL | None | FK → bookings(id) | Booking being paid for |
| amount | NUMERIC(10,2) | NOT NULL | None | CHECK | Payment amount |
| currency | VARCHAR(3) | NOT NULL | `'USD'` | — | ISO 4217 currency code |
| payment_method | VARCHAR(50) | NOT NULL | None | — | CARD, UPI, PAYPAL, etc. |
| idempotency_key | VARCHAR(255) | NOT NULL | None | UNIQUE | Prevents duplicate payment processing |
| transaction_reference | VARCHAR(255) | NULL | NULL | UNIQUE | Payment gateway transaction ID |
| status | VARCHAR(20) | NOT NULL | `'PENDING'` | CHECK | Payment lifecycle state |
| created_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | — | Payment creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | — | Last payment update |

### Constraints

```sql
CHECK (amount > 0)
```

```sql
CHECK (
    status IN (
        'PENDING',
        'SUCCESS',
        'FAILED',
        'REFUNDED'
    )
)
```

### Why Use an Idempotency Key?

Imagine a customer clicks the Pay button twice or the network retries a payment request.

Without idempotency, the system might process the same payment more than once.

The unique `idempotency_key` helps prevent duplicate payment processing.

### Example Payment Gateway References

- Stripe transaction reference
- Razorpay payment ID
- PayPal transaction ID

---

# 🔄 State Separation – Most Important Concept

Notice how the states of seats, bookings, and payments are completely separated.

### 1. Event Seat State

```text
AVAILABLE
RESERVED
BOOKED
```

### 2. Booking State

```text
PENDING
CONFIRMED
CANCELLED
EXPIRED
```

### 3. Payment State

```text
PENDING
SUCCESS
FAILED
REFUNDED
```

### Why Is This Separation Important?

Each table represents a different business process.

| Entity | Responsibility |
|---|---|
| event_seats | Tracks seat availability |
| bookings | Tracks the customer's booking order |
| payments | Tracks financial transactions |

This separation allows:

1. Retrying payment if a card is declined without creating a completely new booking.
2. Automatically expiring pending bookings.
3. Releasing seats when booking holds expire.
4. Maintaining independent booking and payment lifecycles.

---

# 🧩 Entity Relationship Diagram (ERD)

```text
                    USERS
                      |
             1        |        1
                      |
                  ORGANIZERS
                      |
                      | 1
                      |
                      | N
                    EVENTS
                   /      \
                  /        \
                 N          N
                /            \
            VENUES        TICKET_TYPES
               |
               | 1
               |
               | N
          VENUE_SEATS
               |
               | 1
               |
               | N
           EVENT_SEATS
               |
               | 1
               |
               | N
          BOOKING_ITEMS
               |
               | N
               |
               | 1
            BOOKINGS
               |
               | 1
               |
               | N
             PAYMENTS
```

### Simplified Relationship Summary

```text
users          → organizers
organizers     → events
venues         → venue_seats
venues         → events
events         → ticket_types
events         → event_seats
venue_seats    → event_seats
users          → bookings
events         → bookings
bookings       → booking_items
event_seats    → booking_items
bookings       → payments
```

---

# ⚙️ Important PostgreSQL Concepts Used

| Concept | Where It Is Used | Why It Matters |
|---|---|---|
| UUID | users, organizers, events, bookings, payments | Public identifiers |
| BIGINT | venues, seats, ticket types | Internal identifiers |
| PRIMARY KEY | Every table | Unique row identification |
| FOREIGN KEY | Related tables | Referential integrity |
| UNIQUE | Email, venue seats, ticket names, idempotency keys | Prevents duplicate records |
| CHECK | Status, price, capacity, timestamps | Enforces business rules |
| TIMESTAMPTZ | Timestamps | Timezone-aware date and time storage |
| NUMERIC | Prices and amounts | Accurate monetary values |
| ON DELETE CASCADE | Dependent records | Automatically deletes dependent rows |
| ON DELETE RESTRICT | Events and their dependencies | Prevents unsafe deletion |

---

# 🚀 Final Architectural Takeaway

The database is designed around three important responsibilities:

1. **Inventory Management** – Tracks which seats are available, reserved, or booked.
2. **Booking Management** – Tracks customer orders and their lifecycle.
3. **Payment Management** – Tracks payment attempts and financial transactions.

The most important design principle is to keep these responsibilities separate while maintaining consistency through PostgreSQL constraints and transactions.

This schema provides a foundation for building a scalable ticket booking backend using:

- PostgreSQL
- Node.js
- Express.js
- Redis
- BullMQ
- Socket.IO
- Payment Gateway Integration

**The next step is translating this architectural design into PostgreSQL DDL (`CREATE TABLE`) statements and implementing transactional booking logic.**


# Database Architecture – Advanced Concepts

Now, let’s cover the next critical architectural topics before you begin implementing:

1. **The Schema Dependency Graph & Creation Order (Topological Sorting)**
2. **The State Transition Lifecycles (Finite State Machines)**
3. **The PostgreSQL Foreign Key Indexing Trap (A critical performance concept)**

---

## 1. Schema Dependency Graph & Creation Order

In a relational database, you cannot reference a table that does not exist yet. Foreign keys create **hard dependencies**.

If you try to create `event_seats` before `events` or `venue_seats`, PostgreSQL will throw: `relation does not exist`.

Here is the exact dependency hierarchy (from independent parent tables down to deep children):

### Dependency Hierarchy

**Level 0 (No FK Dependencies):**

```text
[users]        [venues]
```

**Level 1 (Depends only on Level 0):**

```text
[organizers]   (depends on users)

[venue_seats]  (depends on venues)
```

**Level 2 (Depends on Level 1 & 0):**

```text
[events]       (depends on organizers & venues)
```

**Level 3 (Depends on Level 2):**

```text
[ticket_types] (depends on events)

[bookings]     (depends on users & events)
```

**Level 4 (Depends on Level 3 & Level 1):**

```text
[event_seats]  (depends on events, venue_seats, ticket_types)
```

**Level 5 (Depends on Level 4 & Level 3):**

```text
[booking_items] (depends on bookings & event_seats)

[payments]      (depends on bookings)
```

### The Strict Execution Order for `CREATE TABLE`:

1. `users`
2. `venues`
3. `organizers`
4. `venue_seats`
5. `events`
6. `ticket_types`
7. `bookings`
8. `event_seats`
9. `booking_items`
10. `payments`

*(When dropping tables for teardown/testing, the order is reversed: drop `payments` first, down to `users` last, or use `DROP TABLE ... CASCADE`)*.

---

## 2. State Transition Lifecycles (Finite State Machines)

In complex systems, data doesn't just change randomly; it moves through well-defined **state transitions**. A valid state machine guarantees your database never ends up in an impossible business condition.

Let’s trace the 3 interconnected state machines across an end-to-end checkout.

### Checkout Flow

```text
     [event_seats]                 [bookings]                 [payments]

           |                           |                           |
           |                           |                           |
    (1) AVAILABLE                      |                           |
           |                           |                           |
   User selects seat                   |                           |
           v                           v                           |
    (2) RESERVED  <===========>     PENDING                        |
           |                     (holds 10-min timer)              |
           |                           |                           |
           |                   User clicks "Pay"                   v
           |                           |                        PENDING
           |                           |                           |
           |                           |                           |
           +-------------+-------------+                           |
                         |                                         |
             +-----------+-----------+                             |
             |                       |                             |
    Payment Succeeds?         Payment Fails / Expired?             |
             |                       |                             |
             v                       v                             v
    (3)   BOOKED                 CONFIRMED                      SUCCESS
                                     |
                         (or EXPIRED / CANCELLED)              (or FAILED)
```

### A. The Seat Lifecycle (`event_seats.status`)

1. `AVAILABLE`: Any user browsing the event can view and click on this seat.
2. `RESERVED`: A user has clicked "Book" and is on the checkout page.
   - **Rule**: Other users cannot select this seat.
   - **Timer**: Held for a maximum of 10 minutes.
3. `BOOKED`: Payment succeeded. The ticket is officially sold.
   - **Rule**: This seat can never be reserved again unless a refund or event cancellation occurs.

### B. The Order Lifecycle (`bookings.status`)

1. `PENDING`: Created the moment the user locks their selected seats. The column `expires_at` is set to `CURRENT_TIMESTAMP + INTERVAL '10 minutes'`.
2. `CONFIRMED`: A successful payment record was received before `expires_at`.
3. `EXPIRED`: The 10-minute timer ran out before payment completed. The seat reservation is voided.
4. `CANCELLED`: The user actively cancelled or an administrator voided the order.

### C. The Payment Lifecycle (`payments.status`)

1. `PENDING`: An intent to charge was initiated.
2. `SUCCESS`: Gateway confirmed payment (via webhook or charge verification).
3. `FAILED`: Card declined, insufficient funds, or network timeout.
4. `REFUNDED`: The booking was cancelled and funds were reversed.

---

## 3. The PostgreSQL Foreign Key Indexing Trap

This is one of the most common performance bottlenecks in relational databases:

### The Rule:

> **PostgreSQL does NOT automatically create indexes on Foreign Key columns.**

- When you declare a `PRIMARY KEY` or `UNIQUE` constraint, PostgreSQL automatically builds an underlying **B-Tree index**.
- When you declare `FOREIGN KEY (booking_id) REFERENCES bookings(id)`, PostgreSQL creates the constraint check, **but it does NOT create an index on `booking_id`!**

### Why is this catastrophic if left unindexed?

Imagine `booking_items` has 10,000,000 rows.

1. **Join Queries Crawl**:

   ```sql
   SELECT * FROM bookings b
   JOIN booking_items bi ON bi.booking_id = b.id
   WHERE b.user_id = 'some-user-id';
   ```

   Without an index on `booking_items.booking_id`, PostgreSQL must perform a **Sequential Scan** (reading all 10 million rows from disk) just to find the items for that one booking!

2. **Cascading Deletions / Updates Lock Tables**:

   If an order is cancelled or deleted, PostgreSQL has to check `booking_items` to enforce referential integrity. Without an index on `event_seat_id` and `booking_id`, PostgreSQL locks or scans the entire child table.

### Solution (To keep in mind for our schema):

Every single foreign key column that will be used in `JOIN`, `WHERE`, or cascading checks should have an explicit B-tree index created for it:

- `idx_venue_seats_venue_id`
- `idx_events_organizer_id`
- `idx_events_venue_id`
- `idx_event_seats_event_id`
- `idx_bookings_user_id`
- `idx_bookings_event_id`
- `idx_booking_items_booking_id`
- `idx_booking_items_event_seat_id`
- `idx_payments_booking_id`



# 🏗️ Database Architecture – Advanced Concepts

Before implementing the ticket booking database, we need to understand three critical architectural concepts:

1. **Schema Dependency Graph & Creation Order (Topological Sorting)**
2. **State Transition Lifecycles (Finite State Machines)**
3. **PostgreSQL Foreign Key Indexing**

These concepts help us build a database that is logically structured, consistent, and performant.

---

# 1. Schema Dependency Graph & Creation Order

## What Is a Schema Dependency?

In a relational database, tables can reference other tables through **Foreign Keys (FKs)**.

A foreign key creates a dependency between two tables.

For example:

```sql
FOREIGN KEY (user_id) REFERENCES users(id)
```

Here, the `bookings` table depends on the `users` table.

Therefore, `users` must exist before we create `bookings`.

If we try to create `event_seats` before `events` or `venue_seats`, PostgreSQL will throw an error:

```text
ERROR: relation does not exist
```

## Dependency Hierarchy

The following graph represents the dependency structure of our 10 core tables.

### Level 0 – No Foreign Key Dependencies

```text
    [users]       [venues]
```

These tables can be created independently.

### Level 1 – Depends on Level 0

```text
    [organizers]       [venue_seats]
         |                  |
         v                  v
       users              venues
```

- `organizers` depends on `users`.
- `venue_seats` depends on `venues`.

### Level 2 – Depends on Level 1 and Level 0

```text
             [events]
             /      \
            /        \
     organizers     venues
```

The `events` table depends on:

- `organizers`
- `venues`

### Level 3 – Depends on Level 2

```text
       [ticket_types]       [bookings]
             |                /    \
             v               v      v
           events          users   events
```

- `ticket_types` depends on `events`.
- `bookings` depends on `users` and `events`.

### Level 4 – Depends on Level 3 and Level 1

```text
              [event_seats]
              /     |      \
             /      |       \
         events  venue_seats  ticket_types
```

The `event_seats` table depends on:

- `events`
- `venue_seats`
- `ticket_types`

### Level 5 – Deep Child Tables

```text
          [booking_items]       [payments]
             /       \              |
            /         \             |
       bookings    event_seats    bookings
```

- `booking_items` depends on `bookings` and `event_seats`.
- `payments` depends on `bookings`.

---

## What Is Topological Sorting?

**Topological Sorting** is the process of arranging nodes in a directed graph so that every dependency appears before the node that depends on it.

In database architecture, it helps determine the correct order for creating tables.

### Strict Execution Order for CREATE TABLE

Follow this order when creating the database tables:

| Order | Table | Dependencies |
|---|---|---|
| 1 | `users` | None |
| 2 | `venues` | None |
| 3 | `organizers` | users |
| 4 | `venue_seats` | venues |
| 5 | `events` | organizers, venues |
| 6 | `ticket_types` | events |
| 7 | `bookings` | users, events |
| 8 | `event_seats` | events, venue_seats, ticket_types |
| 9 | `booking_items` | bookings, event_seats |
| 10 | `payments` | bookings |

### Important: Dropping Tables

When dropping tables for testing or teardown, reverse the dependency order.

```text
payments
   |
booking_items
   |
event_seats
   |
bookings
   |
ticket_types
   |
events
   |
venue_seats
   |
organizers
   |
venues
   |
users
```

Drop child tables before parent tables.

Alternatively, PostgreSQL supports:

```sql
DROP TABLE table_name CASCADE;
```

**Warning:** `CASCADE` can also remove dependent database objects. Use it carefully.

---

# 2. State Transition Lifecycles (Finite State Machines)

## What Is a Finite State Machine?

A **Finite State Machine (FSM)** is a model in which a system moves between a finite number of predefined states according to specific rules.

In complex systems, data should not change randomly.

Instead, it should follow well-defined state transitions.

For our ticket booking platform, we have three interconnected state machines:

1. Seat lifecycle
2. Booking lifecycle
3. Payment lifecycle

These state machines work together during the checkout process.

## Overall Checkout Flow

```text
       EVENT SEATS                 BOOKINGS                 PAYMENTS
       -----------                 --------                 --------

       AVAILABLE
           |
           |
     User selects seat
           |
           v
        RESERVED  <---------->   PENDING
                                  |
                             10-minute timer
                                  |
                             User clicks Pay
                                  |
                                  v
                               PENDING
                                  |
                                  |
                         Payment processing
                                  |
                     +------------+------------+
                     |                         |
                     v                         v
                Payment Success          Payment Failure
                     |                         |
                     v                         v
                  BOOKED                  EXPIRED / CANCELLED
                     |                         |
                     v                         v
                 CONFIRMED                  FAILED
```

The important principle is that each entity maintains its own lifecycle.

---

## A. Seat Lifecycle – `event_seats.status`

The seat lifecycle represents the availability of a physical seat for a particular event.

### 1. AVAILABLE

- The seat is available for booking.
- Users browsing the event can view and select it.

### 2. RESERVED

A user has selected the seat and is on the checkout page.

**Rules:**

- Other users cannot reserve the same seat.
- The seat is temporarily held.
- The hold lasts for a maximum of 10 minutes.

### 3. BOOKED

- Payment has been successfully verified.
- The ticket is officially sold.
- The seat cannot be reserved again unless a valid cancellation or refund process releases it.

### Seat Lifecycle Diagram

```text
       AVAILABLE
           |
           | User selects seat
           v
        RESERVED
           |
           | Payment succeeds
           v
         BOOKED
```

If the reservation expires:

```text
       RESERVED
           |
           | Hold expires
           v
       AVAILABLE
```

---

## B. Booking Lifecycle – `bookings.status`

The booking lifecycle represents the state of the customer's order.

### 1. PENDING

- A booking is created when the user locks the selected seats.
- The `expires_at` column stores the reservation deadline.

Example:

```sql
expires_at = CURRENT_TIMESTAMP + INTERVAL '10 minutes'
```

### 2. CONFIRMED

- Payment has been successfully verified.
- The booking is officially confirmed.

### 3. EXPIRED

- The 10-minute reservation period has ended.
- Payment was not completed in time.
- The associated seat reservation must be released.

### 4. CANCELLED

- The customer actively cancels the booking, or
- An administrator cancels the order.

### Booking Lifecycle Diagram

```text
             PENDING
            /   |   \
           /    |    \
          v     v     v
    CONFIRMED CANCELLED EXPIRED
```

---

## C. Payment Lifecycle – `payments.status`

The payment lifecycle tracks the financial transaction.

### 1. PENDING

A payment attempt has been initiated.

### 2. SUCCESS

The payment gateway confirms that the payment succeeded.

This confirmation can arrive through:

- A verified payment webhook.
- A payment status verification request.

### 3. FAILED

Payment was unsuccessful because of reasons such as:

- Card declined.
- Insufficient funds.
- Payment gateway failure.
- Network timeout.

### 4. REFUNDED

The payment amount has been reversed through a refund process.

### Payment Lifecycle Diagram

```text
          PENDING
          /    \
         /      \
        v        v
     SUCCESS   FAILED
        |
        |
        v
     REFUNDED
```

**Important architectural note:** In a production payment system, a refund should generally be recorded as a separate financial transaction rather than overwriting the original successful payment. This allows partial refunds and preserves the payment history.

---

## Why Keep These Three States Separate?

| Entity | Responsibility |
|---|---|
| `event_seats` | Tracks seat availability |
| `bookings` | Tracks customer order status |
| `payments` | Tracks financial transaction status |

Separating these states provides several advantages:

1. Payment can be retried without creating an entirely new booking.
2. Pending bookings can automatically expire.
3. Expired reservations can release seats.
4. Payment failures do not automatically mean the booking has been deleted.
5. Each business process can be managed independently.

---

# 3. PostgreSQL Foreign Key Indexing Trap

This is one of the most important PostgreSQL performance concepts.

## The Rule

> PostgreSQL does NOT automatically create indexes on foreign key columns.

Let's understand the difference.

### Primary Key and Unique Constraints

When you declare a primary key:

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY
);
```

PostgreSQL automatically creates a unique B-tree index to enforce the primary key.

Similarly, a `UNIQUE` constraint creates a unique index.

### Foreign Key Constraint

Consider:

```sql
CREATE TABLE bookings (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id)
);
```

PostgreSQL creates the foreign key constraint to enforce referential integrity.

However, it does **not** automatically create an index on `bookings.user_id`.

This distinction is extremely important.

---

## Why Can Missing Foreign Key Indexes Cause Performance Problems?

Imagine the `booking_items` table contains:

```text
10,000,000 rows
```

Now execute this query:

### Example SQL Query

```sql
SELECT *
FROM bookings b
JOIN booking_items bi
    ON bi.booking_id = b.id
WHERE b.user_id = 'some-user-id';
```

Without an appropriate index on `booking_items.booking_id`, PostgreSQL may need to perform a Sequential Scan on the child table.

A Sequential Scan reads the table's rows to find matching records.

For a table containing millions of rows, this can become expensive.

**Note:** PostgreSQL's query planner may choose different execution plans depending on table size, statistics, and data distribution. An index does not guarantee an index scan for every query.

---

## Another Problem: Cascading Deletes and Updates

Consider:

```sql
DELETE FROM bookings
WHERE id = 'some-booking-id';
```

If the booking has dependent records in `booking_items`, PostgreSQL must check those records to enforce referential integrity.

Without an index on `booking_items.booking_id`, finding the related child rows can require scanning the child table.

The same consideration applies when checking foreign key references during certain updates and deletes.

Therefore, indexing relevant foreign key columns is important for both query performance and referential integrity operations.

---

## Solution: Create Explicit B-Tree Indexes

For our ticket booking schema, consider the following indexes:

```sql
-- Venue Seats
CREATE INDEX idx_venue_seats_venue_id
ON venue_seats(venue_id);


-- Events
CREATE INDEX idx_events_organizer_id
ON events(organizer_id);

CREATE INDEX idx_events_venue_id
ON events(venue_id);


-- Event Seats
CREATE INDEX idx_event_seats_event_id
ON event_seats(event_id);


-- Bookings
CREATE INDEX idx_bookings_user_id
ON bookings(user_id);

CREATE INDEX idx_bookings_event_id
ON bookings(event_id);


-- Booking Items
CREATE INDEX idx_booking_items_booking_id
ON booking_items(booking_id);

CREATE INDEX idx_booking_items_event_seat_id
ON booking_items(event_seat_id);


-- Payments
CREATE INDEX idx_payments_booking_id
ON payments(booking_id);
```

---

## Foreign Key Indexing Checklist

| Table | Foreign Key Column | Suggested Index |
|---|---|---|
| `organizers` | `user_id` | `idx_organizers_user_id` |
| `venue_seats` | `venue_id` | `idx_venue_seats_venue_id` |
| `events` | `organizer_id` | `idx_events_organizer_id` |
| `events` | `venue_id` | `idx_events_venue_id` |
| `ticket_types` | `event_id` | `idx_ticket_types_event_id` |
| `event_seats` | `event_id` | `idx_event_seats_event_id` |
| `event_seats` | `venue_seat_id` | `idx_event_seats_venue_seat_id` |
| `event_seats` | `ticket_type_id` | `idx_event_seats_ticket_type_id` |
| `bookings` | `user_id` | `idx_bookings_user_id` |
| `bookings` | `event_id` | `idx_bookings_event_id` |
| `booking_items` | `booking_id` | `idx_booking_items_booking_id` |
| `booking_items` | `event_seat_id` | `idx_booking_items_event_seat_id` |
| `payments` | `booking_id` | `idx_payments_booking_id` |

**Important:** These are candidate indexes, not a requirement to blindly create every index. A primary key, unique constraint, or existing composite index may already cover a particular lookup. Check existing indexes and actual query patterns before adding redundant ones.

---

# 🎯 Final Takeaways

Before implementing the PostgreSQL schema, understand these three concepts:

| Concept | Main Purpose |
|---|---|
| Dependency Graph | Determines the correct table creation order |
| Finite State Machines | Ensures valid business state transitions |
| Foreign Key Indexing | Improves joins and referential integrity checks |

### What We Have Learned

- Tables must be created in dependency order.
- Child tables should generally be dropped before parent tables.
- Seat, booking, and payment lifecycles must remain separate.
- State transitions should follow predefined business rules.
- PostgreSQL does not automatically index foreign key columns.
- Indexes should be selected based on actual query patterns and existing indexes.

## Next Implementation Phase

With the schema structure and these architectural concepts understood, we are ready to move toward:

1. Writing PostgreSQL `CREATE TABLE` statements.
2. Defining primary keys, foreign keys, and constraints.
3. Creating appropriate indexes.
4. Implementing atomic seat reservation transactions.
5. Handling concurrent booking requests safely.
6. Integrating payment processing with the backend.

**Our goal is not just to create tables. It is to build a database that preserves correctness under real-world traffic and concurrent booking requests.**