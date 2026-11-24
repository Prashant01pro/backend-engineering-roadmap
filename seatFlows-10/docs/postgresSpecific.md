# PostgreSQL-Specific Dialect Features and Implementation Techniques

PostgreSQL-specific dialect features and implementation techniques you must understand before writing your DDL scripts.

Writing clean, modern PostgreSQL is different from writing generic SQL or MySQL. Here are the core PostgreSQL mechanics you should know.

---

## 1. Modern PostgreSQL Mechanics

### A. UUID Generation: `gen_random_uuid()` vs. `uuid-ossp`

- **Old way (Pre-PostgreSQL 13)**: Developers had to run `CREATE EXTENSION "uuid-ossp";` and use `uuid_generate_v4()`.
- **Modern way (PostgreSQL 13+)**: PostgreSQL includes `gen_random_uuid()` natively into core. No extensions required!
- When declaring a UUID primary key:

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

---

### B. Auto-Incrementing IDs: `IDENTITY` vs. `SERIAL`

In older tutorials, you will often see:

```sql
id SERIAL PRIMARY KEY  -- Legacy PostgreSQL syntax
```

- **Why avoid `SERIAL`?** `SERIAL` is not standard SQL. It creates an implicit sequence behind the scenes that can cause permission issues and sequence desynchronization during data restores.
- **Modern SQL Standard (PostgreSQL 10+)**:

```sql
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

`GENERATED ALWAYS AS IDENTITY` adheres to the ANSI SQL standard, prevents accidental manual inserts into the ID column, and cleanly manages the sequence.

---

### C. Enums vs. `VARCHAR` + `CHECK` Constraints

Should we use PostgreSQL Custom Enum Types or `VARCHAR` with a `CHECK` constraint for statuses like `role`, `status`, etc.?

```sql
-- Option A: Custom Enum

CREATE TYPE booking_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'EXPIRED'
);

-- Option B: VARCHAR with CHECK constraint

status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
CHECK (
    status IN (
        'PENDING',
        'CONFIRMED',
        'CANCELLED',
        'EXPIRED'
    )
);
```

| Criteria | PostgreSQL `ENUM` | `VARCHAR` + `CHECK` |
|---|---|---|
| **Storage** | 4 bytes internally | Size of string + 1 byte |
| **Adding a new status** | Easy (`ALTER TYPE ... ADD VALUE`) | Easy (`ALTER TABLE ... DROP/ADD CONSTRAINT`) |
| **Removing or renaming a status** | **Extremely difficult** in Postgres (requires recreating type or recreating table) | **Trivial** (just update the check constraint) |
| **Tooling/ORM compatibility** | Sometimes clumsy with migrations | Universally supported by every library |

> **Recommendation**: For SeatFlow, **`VARCHAR` with a `CHECK` constraint** is far more maintainable and resilient to future schema migrations.

---

### D. The `updated_at` Column Pattern in PostgreSQL

In MySQL, you might be used to:

```sql
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

**PostgreSQL does not have `ON UPDATE CURRENT_TIMESTAMP`.**

In PostgreSQL, the standard architectural pattern is to create a single **reusable trigger function**:

1. Define a generic function:
   - "Whenever a row is updated, set its `updated_at = CURRENT_TIMESTAMP` and return the new row."
2. Attach a `BEFORE UPDATE` trigger to any table that needs automatic timestamp tracking (`users`, `organizers`, `events`, `bookings`, `payments`).

This keeps application code clean because developers don't have to remember to manually pass `updated_at: new Date()` on every SQL `UPDATE` statement.

---

## 2. Integrity Checklist: What Makes This Schema Bulletproof?

When you review your tables, check off these 4 core guarantees:

### 1. No Orphan Rows

- Every child table references a valid parent (`FOREIGN KEY`).
- If a venue is deleted, its physical seats are safely cascaded.
- If an event has active bookings, the event and venue are protected (`RESTRICT`).

### 2. No Physical Duplicate Seats

- `venue_seats` enforces `UNIQUE (venue_id, section, row_number, seat_number)`.

### 3. No Double-Listing of Event Seats

- `event_seats` enforces `UNIQUE (event_id, venue_seat_id)`.

### 4. Auditability and Exact Math

- All money columns use `NUMERIC(10, 2)` (never float).
- All timestamps use `TIMESTAMPTZ` (UTC-safe).
- Historical prices are snapshot in `booking_items.price_at_booking`.

---

## 3. How to Structure Your SQL Files

When you begin writing your database scripts, a clean, production-grade directory structure keeps things organized:

```text
seatFlows-10/
│
├── docs/
│   └── stage1.md          # Your architectural & conceptual notes
│
└── src/
    └── db/
        └── schema.sql     # DDL: Tables, constraints, and indexes
```

### Script Execution Flow in `schema.sql`

1. **Drop existing tables (for clean resets)** in reverse dependency order:
   - Drop `payments`, `booking_items`, `event_seats`, `bookings`, `ticket_types`, `events`, `venue_seats`, `organizers`, `venues`, `users`.
2. **Define the reusable `updated_at` trigger function**.
3. **Create tables** in strict topological order (from `users` and `venues` down to `payments`).
4. **Create foreign key indexes** to prevent sequential scans during joins and deletes.
5. **Attach `updated_at` triggers** to relevant tables.