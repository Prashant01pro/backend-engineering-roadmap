import app from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { startExpirationWorker } from './jobs/cleanupExpiredBookings.js';

const client = await pool.connect();
client.release();

app.listen(env.port, () => {
  console.log(` SeatFlow server is running in ${env.nodeEnv} mode on port ${env.port}`);
  console.log(` Health check available at: http://localhost:${env.port}/health`);
});

startExpirationWorker(30000); // checks every 30 seconds