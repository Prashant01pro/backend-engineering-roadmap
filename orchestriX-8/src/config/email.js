import nodemailer from 'nodemailer';
import { env } from './env.js';
import { logger } from './logger.js';

// Connection pooling prevents creating a new TLS connection for every single email

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true, // use pooled connections
    maxConnections: 5,
    maxMessages: 100,
    auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASSWORD
    }
});

// Why pool: true? Creating a new TLS connection over the internet takes ~300ms to 800ms. With pooling enabled, Nodemailer reuses established TCP/TLS sockets across multiple email sends.

//Verifies SMTP connection credentials on startup
export const verifyEmailConnection = async () => {
    try {
        await transporter.verify();
        logger.info('SMPT transporter verified and ready to send emails')
    } catch (error) {
        logger.error({ err: error.message }, 'Failed to connect to SMPT server')
    }
}