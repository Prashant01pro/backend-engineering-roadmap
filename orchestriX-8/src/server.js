import app from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB, disconnectDB } from './config/db.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { verifyEmailConnection } from './config/email.js';
import { startWorker, stopWorker } from './workers/job.worker.js';

let server;
let isShuttingDown = false;

const startServer = async () => {
    try {
        // Establish database and cache connections
        logger.info('Initializing services...');
        await connectDB();
        await connectRedis();
        await verifyEmailConnection() // verify SMTP credentials
        startWorker(); // Start the background worker!

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
    logger.fatal({ reason }, 'UNHANDLED REJECTION! Initiating emergency shutdown...');
    gracefulShutdown('unhandledRejection');
});

startServer();