# Stage 1: Database Foundation & Design Concepts.

We will explore every fundamental concept that you need to master before writing any SQL schema or backend code. By the end of this guide, you will understand not just what tables to create, but why every column, constraint, data type, and relationship is chosen.

1. Keys: The Foundation of Identity and Reference

Every row in a relational database must be identifiable and linkable.

Primary Key (PK)

A Primary Key is a column (or combination of columns) that uniquely identifies each row in a table. It must be unique and never NULL.

The Architecture Decision: Surrogate Key vs. Natural Key

Natural Key: A piece of data that already exists in the real world and is inherently unique (e.g., email, national_id_number, or a combination of passport_number + country).
Why we avoid Natural Keys as Primary Keys: Real-world data changes! A user might want to change their email. If email was your PK, changing it forces you to update every foreign key reference in bookings, audit_logs, payments, etc. (a massive, locking cascading update).
Surrogate Key: A system-generated artificial identifier with no business meaning (e.g., an auto-incrementing integer or a UUID).
Best Practice: Always use a surrogate key as the Primary Key (id). Use a Unique Constraint on natural identifiers (like email).
Data Type Choice for PK: BIGINT (SERIAL/IDENTITY) vs. UUID
Feature	BIGINT (Generated Always As Identity)	UUID v4 / UUID v7
Storage size	8 bytes per row	16 bytes per row
Index performance	Sequential, extremely fast B-tree index inserts	Random (UUIDv4) causes B-tree page fragmentation. (UUIDv7 solves this)
Predictability	Easily guessable (/api/bookings/101 
→
→ next is 102)	Completely unguessable, cryptographically secure
Distributed Systems	Needs central sequence generator (PostgreSQL)	Can be generated on the client/backend before DB insert

Recommendation for SeatFlow:

Internal tables with high relational lookups (venue_seats, ticket_types): BIGINT works great.
Public-facing entities (bookings, users): UUID prevents ID enumeration attacks (where a competitor scrapes your order volume by counting order IDs).
Foreign Key (FK) & Referential Integrity

A Foreign Key is a column that points to the Primary Key of another table, guaranteeing that you cannot create an orphan record.

Referential Actions (What happens when the parent row is deleted?)
ON DELETE RESTRICT / NO ACTION (Default):
If an organizer tries to delete an event that already has active bookings, the database halts and throws an error. This prevents accidental deletion of historical orders.
ON DELETE CASCADE:
If a venue is deleted, all its venue_seats should automatically be deleted because physical seats cannot exist without a venue.
ON DELETE SET NULL:
If a record is deleted, set the FK in the child table to NULL (only valid if the column allows NULL).
2. Database Relationships & Cardinality

Relationships dictate how business logic interacts with data.

A. One-to-One (1 : 1)

Rule: One record in Table A relates to at most one record in Table B.

Example in SeatFlow: users 
↔
↔ organizers.
Every organizer profile must belong to exactly one user account.
How to enforce in DB: Place user_id inside the organizers table as a Foreign Key with a UNIQUE constraint.
text
[users] 1 <-------- (user_id UNIQUE FK) --------> 1 [organizers]
B. One-to-Many (1 : N)

Rule: One record in Table A can relate to many records in Table B, but each record in Table B belongs to only one record in Table A.

Examples in SeatFlow:
One venue has many venue_seats.
One event has many event_seats.
One user has many bookings.
One booking has many booking_items.
How to enforce in DB: Put the Foreign Key on the "Many" side. venue_seats holds venue_id.
C. Many-to-Many (M : N) & Junction (Bridge) Tables

Rule: A record in Table A relates to many records in Table B, and vice-versa.

Example in SeatFlow: An event has many attendees, and an attendee attends many events. Or a booking contains multiple seats, and seats across events belong to different bookings.
Relational databases cannot directly implement M:N relationships with a simple foreign key.
Solution: A Junction Table (or Associative Entity).
text
[bookings] (1) <--- (N) [booking_items] (N) ---> (1) [event_seats]
booking_items turns the M:N relationship into two 1:N relationships. It also allows us to attach metadata to the link itself, such as price_at_booking.
3. Database Normalization (1NF, 2NF, 3NF) vs. Intentional Denormalization

Normalization is the process of structuring a database to eliminate redundancy and maintain data integrity.

First Normal Form (1NF)
Each column contains only atomic (indivisible) values.
Violation: Storing a comma-separated list of seats in a booking: "A1, A2, A3".
Fix: Each seat gets its own separate row in booking_items.
Each row must be unique (guaranteed by a Primary Key).
Second Normal Form (2NF)

Must be in 1NF AND all non-key columns must depend on the entire Primary Key (not a part of a composite key).

Violation: If booking_items had a composite PK of (booking_id, event_seat_id) and also stored user_email. user_email depends only on booking_id, not on event_seat_id.
Fix: Keep user_email in users.
Third Normal Form (3NF)

Must be in 2NF AND no transitive dependencies (non-key columns must not depend on other non-key columns).

"Every column must depend on the key, the whole key, and nothing but the key."
Violation: Storing venue_address or venue_capacity inside the events table. events only needs venue_id. Venue details belong strictly in venues.
When Should We Intentionally Break 3NF (Denormalization)?

Notice in our schema design:

ticket_types has a price.
booking_items also has a price_at_booking.
Why this is not bad design: This is Historical Snapshotting. If an organizer changes the VIP ticket price from $100 to $150 next week, previous receipts in booking_items must remain $100. If we relied strictly on a relational join to ticket_types, past accounting records would be corrupted!
4. PostgreSQL Constraints: Your First Line of Defense

Never rely solely on your Node.js/Express backend for data validation. Code can have bugs, race conditions, or be bypassed by manual DB queries. The database schema is the ultimate source of truth.

A. NOT NULL

Ensures essential business fields are never omitted. A booking without a user_id or an event seat without an event_id violates integrity.

B. UNIQUE (Single and Composite)
Single Column: users.email must be unique across the platform.
Composite Unique Constraint: A combination of multiple columns must be unique together:
In venue_seats: UNIQUE (venue_id, section, row_number, seat_number)
Why: You can have "Seat 1" in Section A and "Seat 1" in Section B, but you can never have two "Seat 1"s in Section A of the same venue.
In event_seats: UNIQUE (event_id, venue_seat_id)
Why: A physical seat can only be allocated once for a single event.
C. CHECK Constraints

PostgreSQL lets you write boolean expressions that every inserted or updated row must satisfy.

CHECK (capacity > 0): A venue cannot have 0 or negative seats.
CHECK (price >= 0): Ticket price cannot be negative.
CHECK (end_time > start_time): An event cannot end before it begins.
CHECK (status IN ('AVAILABLE', 'RESERVED', 'BOOKED')): Prevents invalid states from entering the table.
5. PostgreSQL Data Type Selection

Choosing the right type affects memory footprint, index speed, and mathematical accuracy:

Currency: Why FLOAT is Strictly Forbidden
FLOAT / REAL: Uses IEEE 754 floating-point arithmetic. Numbers are approximated in binary (
0.1
+
0.2
=
0.30000000000000004
0.1+0.2=0.30000000000000004). Over thousands of transactions, rounding errors accumulate into lost money.
DECIMAL(10, 2) / NUMERIC(10, 2): Exact fixed-point numeric representation. Every cent is preserved precisely.
Date & Time: TIMESTAMP vs TIMESTAMPTZ
TIMESTAMP (Without timezone): Stores date and time blindly without offset. If an event is at 19:00, is that in New York, London, or Tokyo?
TIMESTAMPTZ (With timezone): PostgreSQL converts the timestamp to UTC upon storage and converts it to the requested client timezone on retrieval.
Rule: For live events and countdown expiration timers (expires_at), always use TIMESTAMPTZ.
Text: CHAR vs VARCHAR(n) vs TEXT
In PostgreSQL, VARCHAR and TEXT have the exact same underlying storage performance (unlike older MySQL engines).
Use VARCHAR(n) when you want the database to enforce a sensible length limit (e.g., VARCHAR(255) for emails).
Use TEXT for free-form content with unpredictable length (e.g., event descriptions, bios).
6. Summary Checklist for Stage 1

Before writing any DDL statements:

Every entity has a surrogate Primary Key (id).
Foreign Keys connect parent and child entities, with appropriate cascade/restrict behaviors.
Composite UNIQUE constraints prevent logical duplicates (venue_seat and event_seat uniqueness).
CHECK constraints prevent corrupted states, negative prices, and backward dates.
Exact data types (DECIMAL, TIMESTAMPTZ) protect against financial and time-zone bugs.