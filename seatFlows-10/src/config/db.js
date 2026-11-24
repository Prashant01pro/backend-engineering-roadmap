import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'seatflow',

    // Connection Pool tuning:
    max: 20,                  // Maximum 20 simultaneous client connections
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Fail fast if a connection takes > 2 seconds
})

pool.on('connect', () => {
    console.log('Connected to PostgreSQL database pool.')
})

pool.on('error', (err) => {
    console.error(' Unexpected error on idle PostgreSQL client:', err);
    process.exit(-1);
})

//Standard query helper (automatically checks out and returns client)
export const query = (text, params) => pool.query(text, params);

//Handles client acquisition, BEGIN, COMMIT, ROLLBACK, and guaranteed release.

export const withTransaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release(); // prevents connection starvation
    }
};