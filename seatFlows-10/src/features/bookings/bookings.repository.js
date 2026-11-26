import { query } from '../../config/db.js'

// CRITICAL CONCURRENCY FUNCTION:
//  Acquires an exclusive row-level lock on the requested seats.
//  ORDER BY es.id ASC guarantees deterministic lock acquisition and prevents deadlocks.

export const lockAndGetSeats = async (sortedSeatIds, client) => {
    const sql = `
    SELECT
    es.id,
    es.event_id,
    es.status,
    tt.price,
    tt.name AS ticket_tier
    FROM event_seats es 
    JOIN ticket_types tt ON es.ticket_type_id=tt.id
    WHERE es.id = ANY ($1::bigint[])
    ORDER BY es.id ASC
    FOR UPDATE;
    `;

    const result = await client.query(sql, [sortedSeatIds]);
    return result.rows;
};

// inserting booking order header with 10-minute hold deadline.
export const createBooking = async ({ userId, eventId, totalAmount, holdMinutes = 10 }, client) => {
    const sql = `
    INSERT INTO bookings (user_id, event_id, total_amount, status, expires_at)
    VALUES ($1, $2, $3, 'PENDING', CURRENT_TIMESTAMP + ($4 || ' minutes') :: interval )
    RETURNING id, user_id, event_id, total_amount, status, expires_at, created_at;
    `;

    const result = await client.query(sql, [userId, eventId, totalAmount, `${holdMinutes}`]);
    return result.rows[0];
}

// bulk insertion line items , snapshotting the historical price at reservation time.
export const createBookingItems = async (bookingId, seats, client) => {
    const valueClauses = [];
    const params = [];

    seats.forEach((seat, index) => {
        const offset = index * 3;
        valueClauses.push(`($${offset + 1},$${offset + 2},$${offset + 3})`);
        params.push(bookingId, seat.id, seat.price);
    });

    const sql = `
    INSERT INTO booking_items (booking_id, event_seat_id, price_at_booking)
    VALUES ${valueClauses.join(', ')}
    RETURNING id, booking_id, event_seat_id, price_at_booking;
    `;

    const result = await client.query(sql, params);
    return result.rows;
}

// status updation of locked seats from available to reserved

export const updateEventSeatsStatus = async (seatIds, status, client) => {
    const sql = `
    UPDATE event_seats
    SET status=$2
    WHERE id=ANY ($1::bigint[])
    RETURNING id, status;
    `;

    const result = await client.query(sql, [seatIds, status]);
    return result.rows;
};

// fetching booking details and items for customer inspection
export const getBookingWithItems = async (bookingId) => {

    const sql = `
    SELECT 
        b.id, b.user_id, b.event_id, b.total_amount, b.status, b.expires_at, b.created_at,
        e.title AS event_title, e.start_time,
        v.name AS venue_name,
        json_agg(
            json_build_object(
                'seat_id', es.id,
                'section', vs.section,
                'row_number', vs.row_number,
                'seat_number', vs.seat_number,
                'price', bi.price_at_booking
            )
        ) AS items
    FROM bookings b
    JOIN events e ON b.event_id = e.id
    JOIN venues v ON e.venue_id = v.id
    JOIN booking_items bi ON b.id = bi.booking_id
    JOIN event_seats es ON bi.event_seat_id = es.id
    JOIN venue_seats vs ON es.venue_seat_id = vs.id
    WHERE b.id = $1
    GROUP BY b.id, e.id, v.id;
  `;

    const result = await query(sql, [bookingId]);
    return result.rows[0] || null;
};

//Fetching booking history for the logged-in customer

export const getUserBookings = async (userId) => {
    const sql = `
    SELECT 
        b.id, b.event_id, b.total_amount, b.status, b.expires_at, b.created_at,
        e.title AS event_title, e.start_time,
        v.name AS venue_name
    FROM bookings b
    JOIN events e ON b.event_id = e.id
    JOIN venues v ON e.venue_id = v.id
    WHERE b.user_id = $1
    ORDER BY b.created_at DESC;
  `;

    const result = await query(sql, [userId]);
    return result.rows;
};