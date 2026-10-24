import { transporter } from '../config/email.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import AppError from '../utils/appError.js';

//Sends a transactional email
/*
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plaintext fallback
 * @returns {Promise<{ messageId: string, accepted: string[] }>} */

export const sendEmail = async ({ to, subject, html, text }) => {
    try {
        const mailOptions = {
            from: env.EMAIL_FROM,
            to,
            subject,
            html,
            text
        }

        const info = await transporter.sendMail(mailOptions);

        logger.info({
            messageId: info.messageId,
            to,
            subject,
            accepted: info.accepted,
        }, 'Email dispatched successfully');

        return {
            messageId: info.messageId,
            accepted: info.accepted
        }
    } catch (error) {
        logger.error({ err: error.message, to, subject }, 'Failed to send email via SMTP');
        throw new AppError('Email service unavailable. Please try again later.', 503);
    }
}