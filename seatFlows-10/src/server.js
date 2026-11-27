import app from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { startExpirationWorker } from './jobs/cleanupExpiredBookings.js';
import { connectRedis, disconnectRedis } from './config/redis.js';

const client = await pool.connect();
client.release();

await connectRedis();

const server = app.listen(env.port, () => {
  console.log(` SeatFlow server is running in ${env.nodeEnv} mode on port ${env.port}`);
  console.log(` Health check available at: http://localhost:${env.port}/health`);
});

startExpirationWorker(30000); // checks every 30 seconds

const gracefulShutdown = async (signal) => {
  console.log(`\n ${signal} received , starting graceful shutdown...`);

  // force exit , if cheanup takes longer than 10 seconds
  const forceExitTimer = setTimeout(() => {
    console.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10000)

  forceExitTimer.unref();

  server.close(async () => {
    console.log('server closed')

    await pool.end();
    console.log('postgresql pool closed')

    await disconnectRedis();
    process.exit(0)
  })
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));