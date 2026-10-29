import Job, { JOB_STATUS } from '../features/jobs/jobs.model.js';
import { jobQueue } from '../queues/job.queue.js';
import { logger } from '../config/logger.js';

// Reconciles orphaned / zombie jobs that were written to MongoDB
// but failed to enqueue into BullMQ due to network or Redis hiccups.

export const reconcileOrphanedJobs = async () => {
    try {
        // find jobs that have been pending for > 60 seconds without a bullJobId
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

        const orphanedJobs = await Job.find({
            status: {$in:[JOB_STATUS.QUEUED,JOB_STATUS.CREATED]},
            createdAt: { $lt: oneMinuteAgo },
            $or: [
                { bullJobId: { $exists: false } },
                { bullJobId: null }
            ]
        }).limit(20);

        if (orphanedJobs.length === 0) {
            return;
        }

        logger.warn({ count: orphanedJobs.length }, 'Reconciliation: Detected orphaned zombie jobs. Recovering...');

        for (const job of orphanedJobs) {
            try {
                // Re-enqueue into BullMQ
                const bullJob = await jobQueue.add(
                    job.type,
                    {
                        mongoJobId: job._id.toString(),
                        ownerId: job.ownerId? job.ownerId.toString():null,
                        type: job.type,
                        payload: job.payload,
                    },
                    {
                        priority: job.priority === "HIGH" ? 1 : 2,
                    }
                );

                // link the recovered bullJobId
                job.bullJobId = bullJob.id;
                await job.save();

                logger.info({ jobId: job._id, bullJobId: bullJob.id }, "Reconciliation: Successfully recovered orphaned job")
            } catch (enqueueError) {
                logger.error({ err: enqueueError, jobId: job._id }, 'Reconciliation: Failed to recover job');
            }
        }
    } catch (error) {
        logger.error({ err: error }, 'Reconciliation: Error during orphan scan');
    }
};

//Starts the periodic reconciliation interval
let reconciliationInterval;

export const startReconciliationCron = (intervalMs = 60000) => {
    logger.info('Self-healing reconciliation engine started');
    reconciliationInterval = setInterval(reconcileOrphanedJobs, intervalMs);
};

export const stopReconciliationCron = () => {
    if (reconciliationInterval) {
        clearInterval(reconciliationInterval);
        logger.info('Reconciliation engine stopped');
    }
};