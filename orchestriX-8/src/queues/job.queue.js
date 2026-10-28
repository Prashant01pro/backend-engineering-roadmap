// The Central Job Queue 
// This file is the gateway that the Express API uses to dispatch background work.

import { Queue } from "bullmq";
import { bullRedisConnection } from '../config/redis.js';
import { logger } from '../config/logger.js';
import Job, { JOB_STATUS } from '../features/jobs/jobs.model.js';

export const QUEUE_NAME = 'orchestriX_jobs';

// initialize BullMQ queue
export const jobQueue = new Queue(QUEUE_NAME, {
    connection: bullRedisConnection,
    defaultJobOptions: {
        attempts: 3, // retry failed jobs upto 3 times
        backoff: {
            type: 'exponential',
            delay: 2000, //2s , then 4s, then 8s 
        },
        removeOnComplete: {
            age: 24 * 3600, // keep completed job metadata in redis for 24h
            count: 500, // keep maximum 500 completed jobs in Redis
        },
        removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs in Redis for 7 days for inspection
        }
    }
})

/**
 * Enqueues a job: Persists the record in MongoDB first, then pushes to BullMQ
 * @param {Object} params
 * @param {string} params.type - One of JOB_TYPES
 * @param {Object} params.payload - Data required by the worker
 * @param {string|null} params.ownerId - User ID who triggered the job
 * @param {Object} [params.options] - BullMQ options (delay, priority, etc.)
 * @returns {Promise<Job>} - The created MongoDB job document
 */

export const addJobToQueue = async ({ type, payload, ownerId = null, options = {} }) => {
    
    // If delay is provided in options, calculate scheduledAt timestamp
    const scheduledAt = options.delay ? new Date(Date.now() + options.delay) : null;

    // create durable record in mongodb
    const mongoJob = await Job.create({
        ownerId,
        type,
        payload,
        status: JOB_STATUS.QUEUED,
        maxAttempts: options.attempts || 3,
        scheduledAt, // Stores scheduled execution time
    });
    try {
        // add task to bullmq queue in redis
        const bullJob = await jobQueue.add(
            type,
            {
                mongoJobId: mongoJob._id.toString(),
                type,
                payload,
                ownerId,
            },
            options //Passes { delay: delayMs } to BullMQ
        )

        // link bullmq ID back to mongodb record 
        mongoJob.bullJobId = bullJob.id;
        await mongoJob.save();

        logger.info({
            mongoJobId: mongoJob._id,
            bullJobId: bullJob.id,
            type,
        }, "Background job enqueued successfully");

        return mongoJob;

    } catch (error) {
        // If Redis queueing fails, mark MongoDB record as failed immediately
        mongoJob.status = JOB_STATUS.FAILED;
        mongoJob.errorSummary = `Failed to push to Redis queue:${error.message}`;
        await mongoJob.save();

        logger.error({ err: error, mongoJobId: mongoJob._id }, 'Failed to enqueue job into bullmq');
        throw error;
    }
}