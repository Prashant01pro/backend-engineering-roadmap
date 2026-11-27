import { query } from "../../config/db.js"

export const createVenue = async ({ name, address, city, state, postalCode, capacity }, client = null) => {
    const sql = `
    INSERT INTO venues (name, address, city, state, postal_code, capacity)
    VALUES($1, $2, $3, $4, $5, $6)
    RETURNING *;
    `;

    const params = [name, address, city, state || null, postalCode, capacity];
    const runner = client || { query };
    const result = await runner.query(sql, params);
    return result.rows[0];
};

export const getVenueById = async (id) => {
    const sql = `SELECT * FROM venues WHERE id=$1`;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
}

export const getAllVenues = async () => {
    const sql = `SELECT * FROM venues ORDER BY created_at DESC;`;
    const result = await query(sql)
    return result.rows;
}

/**
 * High-performance seat generation using PostgreSQL's generate_series!
 * Instantly generates a grid of physical seats (e.g., Section 'Floor', Rows 1..10, Seats 1..20)
 * in 1 single database roundtrip without massive loops in Node.js.
 */

export const createVenueSeatGrid = async ({ venueId, section, totalRows, seatsPerRow }, client = null) => {
    const sql = `
    INSERT INTO venue_seats (venue_id, section, row_number, seat_number, is_accessible)
    SELECT 
        $1 AS venue_id,
        $2 AS section,
        r::text AS row_number,
        s::text AS seat_number,
        FALSE AS is_accessible
    FROM generate_series(1, $3::int) AS r
    CROSS JOIN generate_series(1, $4::int) AS s
    RETURNING id;
    `;

    const runner = client || { query };
    const result = await runner.query(sql, [venueId, section, totalRows, seatsPerRow]);
    return result.rowCount;  // returns total number of seats created
}

// organizer lookup
export const findOrganizerByUserId = async (userId) => {
    const sql = `SELECT * FROM organizers WHERE user_id=$1;`;
    const result = await query(sql, [userId]);
    return result.rows[0] || null;
}

export const createEvent = async ({ organizerId, venueId, title, description, category, startTime, endTime }, client = null) => {
    const sql = `
    INSERT INTO events (organizer_id, venue_id, title, description, category, start_time, end_time, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT')
    RETURNING *;
  `;
    const params = [organizerId, venueId, title, description || null, category, startTime, endTime];
    const runner = client || { query };
    const result = await runner.query(sql, params);
    return result.rows[0];
};

export const getEventById = async (id) => {
    const sql = `
    SELECT 
        e.*, 
        v.name AS venue_name, v.address AS venue_address, v.city AS venue_city,
        o.organization_name
    FROM events e
    JOIN venues v ON e.venue_id = v.id
    JOIN organizers o ON e.organizer_id = o.id
    WHERE e.id = $1;
  `;

    const result = await query(sql, [id]);
    return result.rows[0] || null;
};

export const getPublishedEventsPaginated = async ({ city, category, limit = 10, cursor = null }) => {
    let sql = `
    SELECT 
        e.id, e.title, e.description, e.category, e.start_time, e.end_time,
        v.name AS venue_name, v.city AS venue_city,
        o.organization_name
    FROM events e
    JOIN venues v ON e.venue_id = v.id
    JOIN organizers o ON e.organizer_id = o.id
    WHERE e.status = 'PUBLISHED'
  `;

    const params = [];
    if (city) {
        params.push(city);
        sql += ` AND LOWER(v.city) = LOWER($${params.length})`;
    }
    if (category) {
        params.push(category);
        sql += ` AND LOWER(e.category) = LOWER($${params.length})`;
    }

    if (cursor && cursor.startTime && cursor.id) {
        params.push(cursor.startTime, cursor.id);
        sql += ` AND (e.start_time, e.id) > ($${params.length - 1}, $${params.length})`;
    }
    params.push(limit + 1);
    sql += `
    ORDER BY e.start_time ASC, e.id ASC
    LIMIT $${params.length};
  `;
    const result = await query(sql, params);
    return result.rows;
};

export const createTicketType = async ({ eventId, name, price, description }, client = null) => {
    const sql = `
    INSERT INTO ticket_types (event_id, name, price, description)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
    const params = [eventId, name, price, description || null];
    const runner = client || { query };
    const result = await runner.query(sql, params);
    return result.rows[0];
};
export const getTicketTypesByEventId = async (eventId) => {
    const sql = `SELECT * FROM ticket_types WHERE event_id = $1 ORDER BY price ASC;`;
    const result = await query(sql, [eventId]);
    return result.rows;
};

//   Copies all physical venue_seats into event_seats for this event.
//   Runs inside a transaction during publishing.

export const instantiateEventSeats = async (eventId, venueId, defaultTicketTypeId, client) => {
    const sql = `
    INSERT INTO event_seats (event_id, venue_seat_id, ticket_type_id, status)
    SELECT 
        $1 AS event_id,
        vs.id AS venue_seat_id,
        $2 AS ticket_type_id,
        'AVAILABLE' AS status
    FROM venue_seats vs
    WHERE vs.venue_id = $3
    ON CONFLICT (event_id, venue_seat_id) DO NOTHING
    RETURNING id;
  `;
    const result = await client.query(sql, [eventId, defaultTicketTypeId, venueId]);
    return result.rowCount;
};

export const updateEventStatus = async (eventId, status, client = null) => {
    const sql = `
    UPDATE events 
    SET status = $2, updated_at = CURRENT_TIMESTAMP 
    WHERE id = $1 
    RETURNING *;
  `;
    const runner = client || { query };
    const result = await runner.query(sql, [eventId, status]);
    return result.rows[0];
};


// LIVE SEAT MAP=VIEW AVAILABILITY
export const getEventSeatsMap = async (eventId) => {
    const sql = `
    SELECT 
        es.id AS event_seat_id,
        es.status,
        vs.section,
        vs.row_number,
        vs.seat_number,
        vs.is_accessible,
        tt.name AS ticket_tier,
        tt.price
    FROM event_seats es
    JOIN venue_seats vs ON es.venue_seat_id = vs.id
    JOIN ticket_types tt ON es.ticket_type_id = tt.id
    WHERE es.event_id = $1
    ORDER BY vs.section, vs.row_number, vs.seat_number;
  `;
    const result = await query(sql, [eventId]);
    return result.rows;
};