import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

// Helper to simulate asynchronous work
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const processReportJob = async (job) => {
    const { payload, ownerId } = job.data;
    const reportType = payload.reportType || "GENERAL_SUMMARY";

    logger.info({ jobId: job.id, reportType, ownerId }, 'Starting report generation...');

    //Initialize (25%)
    await sleep(1500);
    await job.updateProgress(25);

    //Querying & aggregation (50%)
    await sleep(1500);
    await job.updateProgress(50);

    //Formatting and compilation (75%)
    await sleep(1500);
    await job.updateProgress(75);

    //Finalizing (100%)
    await sleep(1000);
    await job.updateProgress(100);

    const result = {
        reportType,
        totalRecords: Math.floor(Math.random() * 5000) + 120,
        generatedAt: new Date().toISOString(),
        downloadUrl: `http://localhost:${env.PORT}/api/v1/jobs/${job.data.mongoJobId}/result`,
        status: 'READY',
    }

    logger.info({ jobId: job.id, reportType }, 'Report generation completed successfully');
    return result;
}