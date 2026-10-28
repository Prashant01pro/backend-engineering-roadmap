import { Worker } from 'bullmq';
import { bullRedisConnection } from '../config/redis.js';
import { logger } from '../config/logger.js';
import Job, { JOB_STATUS, JOB_TYPES } from '../features/jobs/jobs.model.js';
import { QUEUE_NAME } from '../queues/job.queue.js';
import { processEmailJob } from './processors/email.processor.js';
import { processReportJob } from './processors/report.processor.js';

import { createNotification } from '../features/notifications/notification.service.js';
import { NOTIFICATION_TYPES } from '../features/notifications/notification.model.js';

let worker;

//Main job dispatcher
const jobHandler = async (job) => {
    const { type, mongoJobId } = job.data;

    // update mongodb status to PROCESSING
    if (mongoJobId) {
        await Job.findByIdAndUpdate(mongoJobId, {
            status: JOB_STATUS.PROCESSING,
            startedAt: new Date(),
        });
    }

    switch (type) {
        case JOB_TYPES.EMAIL_VERIFICATION:
        case JOB_TYPES.PASSWORD_RESET:
            return await processEmailJob(job);
        case JOB_TYPES.REPORT_GENERATION:
        case JOB_TYPES.DATA_EXPORT:
            return await processReportJob(job);

        default:
            throw new Error(`No processor registered for job type:${type}`);
    }
}

// starts the background worker 
export const startWorker = () => {
    worker = new Worker(QUEUE_NAME, jobHandler, {
        connection: bullRedisConnection,
        concurrency: 5, // Process upto 5 jobs simultaneously
    })

    // workers event listeners 
    worker.on('ready', () => {
        logger.info('BullMQ Job worker started and waiting for tasks...')
    })

    worker.on('progress', async (job, progress) => {
        if (job.data.mongoJobId) {
            await Job.findByIdAndUpdate(job.data.mongoJobId, { progress })
        }
    })

    worker.on('completed', async (job, result) => {
        logger.info({ jobId: job.id, type: job.data.type }, "Job completed successfully")

        if (job.data.mongoJobId) {
            await Job.findByIdAndUpdate(job.data.mongoJobId, {
                status: JOB_STATUS.COMPLETED,
                completedAt: new Date(),
                result,
                progress: 100
            })

            //Create In-App Notification for the user
            if (job.data.ownerId) {
                await createNotification({
                    userId: job.data.ownerId,
                    type: NOTIFICATION_TYPES.JOB_COMPLETED,
                    title: 'Report Ready for Download',
                    message: `Your background job (${job.data.type}) has completed successfully.`,
                    data: {
                        jobId: job.data.mongoJobId,
                        downloadUrl: result?.downloadUrl,
                    },
                });
            }
        }
    })

    worker.on('failed', async (job, err) => {
        logger.error({ jobId: job?.id, err: err.message, attempts: job?.attemptsMade }, 'Job failed')

        if (job?.data?.mongoJobId) {
            const isExhausted = job.attemptsMade >= job.opts.attempts;
            await Job.findByIdAndUpdate(job.data.mongoJobId, {
                attempts: job.attemptsMade,
                errorSummary: err.message,
                status: isExhausted ? JOB_STATUS.FAILED : JOB_STATUS.QUEUED,// Remains queued if retrying
                ...(isExhausted && { failedAt: new Date() })
            })
        }
    });

    worker.on('error', (err) => {
        logger.error({ err: err.message }, "BullMQ worker internal error")
    })

    return worker;
}

// graceful worker shutdown : waits for active jobs to finish 
export const stopWorker = async () => {
    if (worker) {
        logger.info('Closing bullmq worker gracefully...');
        await worker.close()
        logger.info('bullmq worker closed.')
    }
}