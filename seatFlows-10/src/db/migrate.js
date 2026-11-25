import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
    const client = await pool.connect();
    try {
        console.log('starting database migration')

        const migrationPath = path.join(__dirname, 'migrations', '001_create_initial_schema.sql');
        const sql = await fs.readFile(migrationPath, 'utf-8');

        await client.query(sql);

        console.log('Schema migration completed successfully: all 10 tables created.');
    } catch (error) {
        console.error(' Migration failed:', error.message);
        process.exit(1);
    } finally {
        // Release the client and drain the pool so the CLI script exits cleanly
        client.release();
        await pool.end();
    }
}

runMigrations();