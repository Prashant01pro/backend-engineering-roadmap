import app from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB, disconnectDB } from './config/db.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { verifyEmailConnection } from './config/email.js';
import { startWorker, stopWorker } from './workers/job.worker.js';
import { eventBus, CHANNELS } from './services/eventBus.service.js';
import { startReconciliationCron, stopReconciliationCron } from './services/reconciliation.service.js';

let server;
let isShuttingDown = false;

const startServer = async () => {
    try {
        // Establish database and cache connections
        logger.info('Initializing services...');
        await connectDB();
        await connectRedis();
        eventBus.initialize()
        await verifyEmailConnection() // verify SMTP credentials
        startWorker(); // Start the background worker!
        startReconciliationCron(60000); // Scans every 60 seconds

        // Start HTTP server
        server = app.listen(env.PORT, () => {
            logger.info({
                port: env.PORT,
                environment: env.NODE_ENV,
                nodeVersion: process.version,
            }, `OrchestriX Server running on port ${env.PORT}`);
        });
    } catch (error) {
        logger.fatal({ err: error }, 'Critical failure during server startup. Exiting process.');
        process.exit(1);
    }
};

// Listen to notification events (this will bridge to WebSockets):
eventBus.subscribe(CHANNELS.USER_NOTIFICATIONS, ({ userId, notification }) => {
    logger.info({ userId, title: notification.title }, 'Real-time notification event received via Redis Pub/Sub');
});

// Graceful Shutdown Handler
const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.warn({ signal }, `Received ${signal}. Starting graceful shutdown sequence...`)

    // Force terminate after 10s if requests hang
    const forceShutdownTimer = setTimeout(() => {
        logger.error('Graceful shutdown timed out. Forcefully terminating process.');
        process.exit(1);
    }, 10000);

    // Don't let timeout keep Node event loop alive if everything closes cleanly
    forceShutdownTimer.unref();

    try {
        // stop accepting new HTTP requests
        if (server) {
            await new Promise((resolve, reject) => {
                server.close((err) => {
                    if (err) return reject(err);
                    logger.info('HTTP server closed; no new requests accepted');
                    resolve()
                })
            })
        }
        stopReconciliationCron();
        await stopWorker(); //Finish active jobs before killing process

        // disconnect redis and mongodb
        await disconnectRedis()
        await disconnectDB()

        logger.info('All resources released cleanly. Exiting.');
        process.exit(0);
    } catch (error) {
        logger.error({ err: error }, 'Error during graceful shutdown');
        process.exit(1);
    }
}

// Signal traps (Ctrl+C and Container stop signals)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Uncaught exceptions & unhandled promise rejections
process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'UNCAUGHT EXCEPTION! Initiating emergency shutdown...');
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'UNHANDLED REJECTION! Initiating emergency shutdown...');
    gracefulShutdown('unhandledRejection');
});

startServer();