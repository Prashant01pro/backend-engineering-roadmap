import express from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { createJob, getMyJobs, getJobById, retryJob, getJobResult, cancelJob, getDashboardStats } from './jobs.controller.js';
import { createJobSchema, validate } from './jobs.validation.js';

const router = express.Router();

// All job routes require authentication
router.use(authenticate);

router.route('/')
    .post(validate(createJobSchema), createJob)
    .get(getMyJobs);

// Mount dashboard stats route before parameterized routes:
router.get('/dashboard/stats', getDashboardStats);

router.route('/:jobId')
    .get(getJobById);

router.post('/:jobId/retry', retryJob);
router.get('/:jobId/result', getJobResult);
router.post('/:jobId/cancel', cancelJob);

export default router;