import { query } from "../../config/db.js";

// idempotency check
export const findPaymentByIdempotencyKey = async (idempotencyKey) => {
    const sql = `SELECT * FROM payments WHERE idempotency_key=$1;`;

    const result = await query(sql, [idempotencyKey]);
    return result.rows[0] || null;
};

//locking booking for payment
// locking the booking record to prevent two payments confirming the same order simultaneously

export const lockBookingForPayment = async (bookingId, client) => {
    const sql = `
    SELECT id, user_id, event_id, total_amount, status, expires_at
    FROM bookings
    WHERE id=$1
    FOR UPDATE;
    `;

    const result = await client.query(sql, [bookingId]);
    return result.rows[0] || null;
}

// payment attempt record

export const createPaymentRecord = async ({ bookingId, amount, currency = 'INR', paymentMethod, idempotencyKey, transactionReference, status }, client) => {
    const sql = `
    INSERT INTO payments (
      booking_id, amount, currency, payment_method, idempotency_key, transaction_reference, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
    `;

    const params = [bookingId, amount, currency, paymentMethod, idempotencyKey, transactionReference || null, status];
    const result = await client.query(sql, params)

    return result.rows[0];
}

// confirmation
//  Flips booking status from 'PENDING' -> 'CONFIRMED'
//  Flips all associated event_seats from 'RESERVED' -> 'BOOKED'

export const confirmBookingAndSeats = async (bookingId, client) => {
    // confirm booking

    const updateBookingSql = `
    UPDATE bookings
    SET status ='CONFIRMED', updated_at= CURRENT_TIMESTAMP
    WHERE id=$1
    RETURNING id, status;
    `;

    await client.query(updateBookingSql, [bookingId])

    // marking seat officially booked
    const updateSeatSql = `
    UPDATE event_seats
    SET status= 'BOOKED'
    WHERE id IN (
      SELECT event_seat_id FROM booking_items WHERE booking_id=$1
    )
    RETURNING id, status;
    `;

    const seatsResult = await client.query(updateSeatSql, [bookingId]);
    return seatsResult.rows;
}


export const getPaymentById = async (paymentId) => {
    const sql = `SELECT * FROM payments WHERE id = $1;`;
    const result = await query(sql, [paymentId]);
    return result.rows[0] || null;
};