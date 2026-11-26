import { query } from "../config/db.js";

export const releaseExpiredBookings = async () => {
    const sql = `
    WITH expired_bookings AS (
        UPDATE bookings 
        SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
        WHERE status='PENDING' AND expires_at < CURRENT_TIMESTAMP
        RETURNING id
    ),
    released_seats AS (
        UPDATE event_seats
        SET status= 'AVAILABLE'
        WHERE id IN (
            SELECT bi.event_seat_id
            FROM booking_items bi
            JOIN expired_bookings eb ON bi.booking_id = eb.id
        )
        RETURNING id
    )
    SELECT 
       (SELECT COUNT(*) FROM expired_bookings)::int AS expired_bookings_count,
       (SELECT COUNT(*) FROM released_seats)::int AS released_seats_count;
    `;

    try {
        const result = await query(sql);
        const { expired_bookings_count, released_seats_count } = result.rows[0]

        if (expired_bookings_count > 0) {
            console.log(
                `[Cleanup Working] Expired ${expired_bookings_count} booking(s) and released ${released_seats_count} seat(s) back to AVAILABLE.`
            );
        }
    } catch (err) {
        console.error('[Cleanup Worker] Error releasing expired bookings:', err.message);
    }
}

// Starts a recurring background timer , for every 30 seconds
export const startExpirationWorker = (intervalMS = 30000) => {
    console.log(`Expiration cleanup worker initialized (running every ${intervalMS / 1000}s)`);

    // runing once immediately on startup
    releaseExpiredBookings();

    const timer = setInterval(releaseExpiredBookings, intervalMS);

    //Unref timer so it doesn't prevent Node process from exiting during tests/shutdown
    timer.unref();
} 