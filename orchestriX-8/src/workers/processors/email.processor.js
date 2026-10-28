import { sendEmail } from '../../services/email.service.js';
import { getVerificationEmailTemplate, getPasswordResetEmailTemplate } from '../../templates/email.template.js';
import { JOB_TYPES } from '../../features/jobs/jobs.model.js';
import AppError from '../../utils/appError.js';

export const processEmailJob = async (job) => {
    const { type, payload } = job.data;

    switch (type) {
        case JOB_TYPES.EMAIL_VERIFICATION: {
            const { name, email, verificationUrl } = payload;
            const { html, text } = getVerificationEmailTemplate({ name, verificationUrl });

            return await sendEmail({ to: email, subject: 'Verify your orchestrix account', html, text })
        }

        case JOB_TYPES.PASSWORD_RESET: {
            const { name, email, resetUrl } = payload;
            const { html, text } = getPasswordResetEmailTemplate({ name, resetUrl });

            return await sendEmail({ to: email, subject: "password Reset Request", html, text })

        }
        default:
            throw new AppError(`Unknown email job type:${type},400`)
    }

}