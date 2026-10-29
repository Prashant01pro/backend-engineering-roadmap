import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

import fs from 'fs/promises';
import path from 'path';

// Helper to simulate asynchronous work
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// export const processReportJob = async (job) => {
//     const { payload, ownerId } = job.data;
//     const reportType = payload.reportType || "GENERAL_SUMMARY";

//     logger.info({ jobId: job.id, reportType, ownerId }, 'Starting report generation...');

//     //Initialize (25%)
//     await sleep(1500);
//     await job.updateProgress(25);

//     //Querying & aggregation (50%)
//     await sleep(1500);
//     await job.updateProgress(50);

//     //Formatting and compilation (75%)
//     await sleep(1500);
//     await job.updateProgress(75);

//     //Finalizing (100%)
//     await sleep(1000);
//     await job.updateProgress(100);

//     const result = {
//         reportType,
//         totalRecords: Math.floor(Math.random() * 5000) + 120,
//         generatedAt: new Date().toISOString(),
//         downloadUrl: `http://localhost:${env.PORT}/api/v1/jobs/${job.data.mongoJobId}/result`,
//         status: 'READY',
//     }

//     logger.info({ jobId: job.id, reportType }, 'Report generation completed successfully');
//     return result;
// }

export const processReportJob = async (jobDocument, bullJob) => {
    const { type } = jobDocument;

    // Data Gathering (25%)
    await bullJob.updateProgress({ percent: 25, stage: 'Querying transactional database' });
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Metric Computation (50%)
    await bullJob.updateProgress({ percent: 50, stage: 'Calculating revenue & tax aggregations' });
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Artifact Generation (75%)
    await bullJob.updateProgress({ percent: 75, stage: 'Serializing dataset to CSV artifact' });
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Generate CSV Content
    const csvContent = [
        'Quarter,Region,Total_Transactions,Gross_Revenue_USD,Net_Profit_USD,Generated_At',
        `Q1,North America,14250,1425000.50,427500.15,${new Date().toISOString()}`,
        `Q2,Europe,11890,1189000.00,356700.00,${new Date().toISOString()}`,
        `Q3,Asia-Pacific,21400,2140000.75,642000.22,${new Date().toISOString()}`,
        `Q4,Latin America,6300,630000.25,189000.08,${new Date().toISOString()}`
    ].join('\n');

    const fileName = `${type}-${jobDocument._id}.csv`;
    const artifactsDir = path.resolve(process.cwd(), 'artifacts');
    await fs.mkdir(artifactsDir, { recursive: true });
    
    const filePath = path.join(artifactsDir, fileName);
    await fs.writeFile(filePath, csvContent, 'utf-8');

    // Completed (100%)
    await bullJob.updateProgress({ percent: 100, stage: 'Report generated successfully' });
    return {
        fileName,
        filePath,
        fileSize: Buffer.byteLength(csvContent, 'utf-8'),
        rowCount: 4,
        generatedAt: new Date().toISOString()
    };
};