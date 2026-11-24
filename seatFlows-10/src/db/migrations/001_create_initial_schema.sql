CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- users
CREATE TABLE
    users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20),
        role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_user_role CHECK (role IN ('CUSTOMER', 'ORGANIZER', 'ADMIN'))
    );

CREATE UNIQUE INDEX idx_users_email ON users (LOWER(email));

-- venues
CREATE TABLE
    venues (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name VARCHAR(150) NOT NULL,
        address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100),
        postal_code VARCHAR(20) NOT NULL,
        capacity INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_venue_capacity CHECK (capacity > 0)
    );

CREATE INDEX idx_venues_city ON venues (city);

-- organizers
CREATE TABLE
    organizers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE RESTRICT,
        organization_name VARCHAR(150) NOT NULL,
        bio TEXT,
        contact_email VARCHAR(255) NOT NULL,
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

-- venue_seats
CREATE TABLE
    venue_seats (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        venue_id BIGINT NOT NULL REFERENCES venues (id) ON DELETE CASCADE,
        section VARCHAR(50) NOT NULL,
        row_number VARCHAR(10) NOT NULL,
        seat_number VARCHAR(10) NOT NULL,
        is_accessible BOOLEAN NOT NULL DEFAULT FALSE,
        CONSTRAINT uq_venue_seat UNIQUE (venue_id, section, row_number, seat_number)
    );

CREATE INDEX idx_venue_seats_venue_id ON venue_seats (venue_id);

-- events
CREATE TABLE
    events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        organizer_id UUID NOT NULL REFERENCES organizers (id) ON DELETE RESTRICT,
        venue_id BIGINT NOT NULL REFERENCES venues (id) ON DELETE RESTRICT,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_event_times CHECK (end_time > start_time),
        CONSTRAINT chk_event_status CHECK (
            status IN ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED')
        )
    );

CREATE INDEX idx_events_start_time ON events (start_time);

CREATE INDEX idx_events_status ON events (status);

CREATE INDEX idx_events_category ON events (category);

-- ticket_types
CREATE TABLE
    ticket_types (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        event_id UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        description TEXT,
        CONSTRAINT uq_event_ticket_type UNIQUE (event_id, name),
        CONSTRAINT chk_ticket_price CHECK (price >= 0)
    );

CREATE INDEX idx_ticket_types_event_id ON ticket_types (event_id);

-- event_seats
CREATE TABLE
    event_seats (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        event_id UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
        venue_seat_id BIGINT NOT NULL REFERENCES venue_seats (id) ON DELETE RESTRICT,
        ticket_type_id BIGINT NOT NULL REFERENCES ticket_types (id) ON DELETE RESTRICT,
        status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
        version INTEGER NOT NULL DEFAULT 1,
        CONSTRAINT uq_event_seat UNIQUE (event_id, venue_seat_id),
        CONSTRAINT chk_event_seat_status CHECK (status IN ('AVAILABLE', 'RESERVED', 'BOOKED'))
    );

CREATE INDEX idx_event_seats_event_status ON event_seats(event_id, status);

--bookings
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    total_amount NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_booking_total CHECK (total_amount >=0),
    CONSTRAINT chk_booking_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED'))
);

CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_expires_at ON bookings (expires_at) WHERE status='PENDING';


-- booking_items
CREATE TABLE booking_items(
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    event_seat_id BIGINT NOT NULL REFERENCES event_seats(id) ON DELETE RESTRICT,
    price_at_booking NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_booking_seat UNIQUE(booking_id, event_seat_id),
    CONSTRAINT chk_item_price CHECK(price_at_booking >=0)
);

CREATE INDEX idx_booking_items_booking_id ON booking_items (booking_id);
CREATE INDEX idx_booking_items_event_seat_id ON booking_items (event_seat_id);


-- payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    payment_method VARCHAR(50) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    transaction_reference VARCHAR(255) UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_payment_amount CHECK (amount > 0),
    CONSTRAINT chk_payment_status CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'))
);

CREATE INDEX idx_payments_booking_id ON payments (booking_id);

COMMIT;