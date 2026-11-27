CREATE INDEX idx_bookings_user_cursor 
ON bookings (user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_events_published_cursor 
ON events (start_time ASC, id ASC) 
WHERE status = 'PUBLISHED';

-- Why this index is so fast:
-- PostgreSQL instantly seeks to user_id = $1.
-- Within that user's partition, the index is already physically sorted by created_at DESC, id DESC.
-- PostgreSQL performs an Index Scan directly to the cursor coordinate without sorting in RAM!